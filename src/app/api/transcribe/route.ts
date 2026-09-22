import { NextResponse } from "next/server";
import { stat } from "node:fs/promises";

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

const INLINE_FALLBACK_SOURCE_MAX_BYTES = 100 * 1024 * 1024;
const INLINE_REQUEST_MAX_BYTES = 18 * 1024 * 1024;

function needsCompressedInlineFallback(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /arquivo remoto.*grande demais|modo alternativo/i.test(message);
}

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
      return buildJsonError("Envie um arquivo de áudio válido em multipart/form-data.", 400);
    }

    const extension = getFileExtension(fileEntry.name);
    const receivedMimeType = fileEntry.type.trim().toLowerCase();
    const mimeType =
      !receivedMimeType ||
      receivedMimeType === "application/octet-stream" ||
      receivedMimeType === "binary/octet-stream"
        ? getMimeTypeFromExtension(extension)
        : receivedMimeType;
    const maxFileSizeBytes = getMaxFileSizeBytes();

    if (!isAllowedAudio(extension, mimeType)) {
      return buildJsonError("Formato de áudio não suportado.", 400);
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

      if (needsCompressedInlineFallback(error)) {
        if (savedFile.size > INLINE_FALLBACK_SOURCE_MAX_BYTES) {
          throw new Error(
            "A Files API do Gemini foi recusada e o modo alternativo aceita arquivos de origem de até 100 MB. Para este arquivo, libere a Files API no projeto Google.",
          );
        }

        const { convertToInlineOpus } = await import("@/lib/audio-convert");
        const compactFilePath = await convertToInlineOpus(savedFile.filePath);
        filesToCleanup.push(compactFilePath);
        const compactSize = (await stat(compactFilePath)).size;

        if (compactSize > INLINE_REQUEST_MAX_BYTES) {
          throw new Error(
            "O áudio foi compactado, mas ainda excede o limite de envio do Gemini. Divida o arquivo ou libere a Files API no projeto Google para transcrever arquivos longos.",
          );
        }

        converted = true;
        transcription = await transcribeAudioWithGemini({
          filePath: compactFilePath,
          mimeType: "audio/ogg",
          originalName: `${savedFile.originalName.replace(/\.[^.]+$/, "")}.opus`,
        });
      } else {
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
    }

    return NextResponse.json<TranscriptionResponse>({
      ok: true,
      transcription,
      meta: {
        originalFileName: savedFile.originalName,
        converted,
        model: getServerEnv().geminiTranscribeModel,
      },
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return buildJsonError(getGeminiMissingKeyMessage(), 500);
    }

    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a transcrição do áudio.";

    return buildJsonError(message, 502);
  } finally {
    await cleanupFiles(filesToCleanup);
  }
}
