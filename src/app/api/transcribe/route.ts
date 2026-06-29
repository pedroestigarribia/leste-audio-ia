import { NextResponse } from "next/server";

import {
  getFileExtension,
  getMimeTypeFromExtension,
  isAllowedAudio,
  shouldConvert,
} from "@/lib/audio";
import {
  MissingApiKeyError,
  getGeminiMissingKeyMessage,
  getMaxFileSizeBytes,
  getServerEnv,
  requireGeminiApiKey,
} from "@/lib/env";
import { cleanupFiles, saveUploadedFileToTemp } from "@/lib/temp-files";
import { parseMultipartFile } from "@/lib/multipart";
import type { TranscriptionResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildJsonError(message: string, status: number) {
  return NextResponse.json<TranscriptionResponse>(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

export async function POST(request: Request) {
  const filesToCleanup: string[] = [];

  try {
    const fileEntry = await parseMultipartFile(request);

    if (!fileEntry) {
      return buildJsonError("Envie um arquivo de audio valido em multipart/form-data.", 400);
    }

    const extension = getFileExtension(fileEntry.name);
    const mimeType = fileEntry.type || getMimeTypeFromExtension(extension);
    const maxFileSizeBytes = getMaxFileSizeBytes();

    if (!isAllowedAudio(extension, mimeType)) {
      return buildJsonError("Formato de audio nao suportado.", 400);
    }

    if (fileEntry.size > maxFileSizeBytes) {
      return buildJsonError(
        `Arquivo acima do limite permitido de ${getServerEnv().maxFileSizeMb} MB.`,
        400,
      );
    }

    requireGeminiApiKey();

    const { transcribeAudioWithGemini } = await import("@/lib/gemini");

    const savedFile = await saveUploadedFileToTemp(fileEntry);
    filesToCleanup.push(savedFile.filePath);

    let transcription = "";
    let converted = false;

    try {
      transcription = await transcribeAudioWithGemini({
        filePath: savedFile.filePath,
        mimeType: savedFile.mimeType,
        originalName: savedFile.originalName,
      });
    } catch (error) {
      if (error instanceof MissingApiKeyError) {
        throw error;
      }

      if (!shouldConvert(savedFile.extension)) {
        throw error;
      }

      const { convertToWav } = await import("@/lib/audio-convert");
      const convertedFilePath = await convertToWav(savedFile.filePath);
      filesToCleanup.push(convertedFilePath);
      converted = true;

      transcription = await transcribeAudioWithGemini({
        filePath: convertedFilePath,
        mimeType: "audio/wav",
        originalName: `${savedFile.originalName.replace(/\.[^.]+$/, "")}.wav`,
      });
    }

    return NextResponse.json<TranscriptionResponse>({
      ok: true,
      transcription,
      meta: {
        originalFileName: savedFile.originalName,
        converted,
        model: getServerEnv().geminiModel,
      },
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return buildJsonError(getGeminiMissingKeyMessage(), 500);
    }

    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel concluir a transcricao do audio.";

    return buildJsonError(message, 502);
  } finally {
    await cleanupFiles(filesToCleanup);
  }
}
