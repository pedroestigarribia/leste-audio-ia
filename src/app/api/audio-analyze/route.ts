import { NextResponse } from "next/server";

import { getFileExtension, getMimeTypeFromExtension, isAllowedAudio } from "@/lib/audio";
import { analyzeAudioWithGemini } from "@/lib/audio-intelligence";
import {
  MissingApiKeyError,
  getGeminiMissingKeyMessage,
  getMaxFileSizeBytes,
  getServerEnv,
  requireGeminiApiKey,
} from "@/lib/env";
import { parseMultipartFile } from "@/lib/multipart";
import { cleanupFiles, saveUploadedFileToTemp } from "@/lib/temp-files";

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
    const mimeType = file.type || getMimeTypeFromExtension(extension);

    if (!isAllowedAudio(extension, mimeType)) {
      return NextResponse.json({ ok: false, error: "Formato de áudio ou vídeo não suportado." }, { status: 400 });
    }

    if (file.size > getMaxFileSizeBytes()) {
      return NextResponse.json(
        { ok: false, error: `Arquivo acima do limite permitido de ${getServerEnv().maxFileSizeMb} MB.` },
        { status: 400 },
      );
    }

    requireGeminiApiKey();
    const savedFile = await saveUploadedFileToTemp(file);
    filesToCleanup.push(savedFile.filePath);

    const result = await analyzeAudioWithGemini(savedFile);

    return NextResponse.json({
      ok: true,
      result,
      model: getServerEnv().geminiAudioUnderstandingModel,
    });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getGeminiMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Não foi possível analisar o áudio.";

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  } finally {
    await cleanupFiles(filesToCleanup);
  }
}

