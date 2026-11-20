import { NextResponse } from "next/server";

import { getFileExtension, getMimeTypeFromExtension, isAllowedAudio } from "@/lib/audio";
import { analyzeTranscriptionWithTextAi } from "@/lib/audio-intelligence";
import {
  getMaxFileSizeBytes,
  getOpenAIMissingKeyMessage,
  getServerEnv,
  MissingApiKeyError,
  requireOpenAIApiKey,
} from "@/lib/env";
import { parseMultipartFile } from "@/lib/multipart";
import { cleanupFiles, saveUploadedFileToTemp } from "@/lib/temp-files";
import { transcribeAudioWithOpenAI } from "@/lib/openai-audio";
import { getTextAiModel } from "@/lib/text-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const filesToCleanup: string[] = [];

  try {
    const file = await parseMultipartFile(request);
    if (!file) {
      return NextResponse.json({ ok: false, error: "Envie um áudio ou vídeo válido." }, { status: 400 });
    }

    const extension = getFileExtension(file.name);
    const receivedMimeType = file.type.trim().toLowerCase();
    const mimeType = !receivedMimeType || receivedMimeType === "application/octet-stream"
      ? getMimeTypeFromExtension(extension)
      : receivedMimeType;
    if (!isAllowedAudio(extension, mimeType)) {
      return NextResponse.json({ ok: false, error: "Formato de áudio ou vídeo não suportado." }, { status: 400 });
    }
    if (file.size > getMaxFileSizeBytes()) {
      return NextResponse.json(
        { ok: false, error: `Arquivo acima do limite permitido de ${getServerEnv().maxFileSizeMb} MB.` },
        { status: 400 },
      );
    }

    requireOpenAIApiKey();
    const savedFile = await saveUploadedFileToTemp(file);
    filesToCleanup.push(savedFile.filePath);
    const transcription = await transcribeAudioWithOpenAI({ filePath: savedFile.filePath });
    const result = await analyzeTranscriptionWithTextAi(transcription.transcription);

    return NextResponse.json({
      ok: true,
      result,
      model: getTextAiModel(),
      transcriptionModel: getServerEnv().openAiTranscribeModel,
    });
  } catch (error) {
    const message = error instanceof MissingApiKeyError
      ? getOpenAIMissingKeyMessage()
      : error instanceof Error
        ? error.message
        : "Não foi possível analisar o áudio.";
    return NextResponse.json({ ok: false, error: message }, { status: error instanceof MissingApiKeyError ? 500 : 502 });
  } finally {
    await cleanupFiles(filesToCleanup);
  }
}
