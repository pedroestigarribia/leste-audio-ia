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
import type { TranscriptionResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadedAudioFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function buildJsonError(message: string, status: number) {
  return NextResponse.json<TranscriptionResponse>(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

function parseContentDisposition(value: string) {
  const parsed: Record<string, string> = {};

  value.split(";").forEach((item) => {
    const [rawKey, ...rawValueParts] = item.trim().split("=");
    const key = rawKey.toLowerCase();
    const rawValue = rawValueParts.join("=");

    if (!key || !rawValue) {
      return;
    }

    parsed[key] = rawValue.replace(/^"|"$/g, "");
  });

  return parsed;
}

function getHeaderValue(rawHeaders: string, headerName: string) {
  const normalizedHeaderName = headerName.toLowerCase();
  const line = rawHeaders
    .split("\r\n")
    .find((headerLine) => headerLine.toLowerCase().startsWith(`${normalizedHeaderName}:`));

  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

async function parseMultipartFile(request: Request): Promise<UploadedAudioFile | null> {
  const contentType = request.headers.get("content-type") ?? "";
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    return null;
  }

  const bodyBuffer = Buffer.from(await request.arrayBuffer());
  const body = bodyBuffer.toString("latin1");
  const parts = body.split(`--${boundary}`);

  for (const rawPart of parts) {
    const part = rawPart.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEndIndex = part.indexOf("\r\n\r\n");

    if (headerEndIndex === -1) {
      continue;
    }

    const rawHeaders = part.slice(0, headerEndIndex);
    const contentDisposition = getHeaderValue(rawHeaders, "content-disposition");
    const disposition = parseContentDisposition(contentDisposition);

    if (disposition.name !== "file" || !disposition.filename) {
      continue;
    }

    const contentTypeHeader = getHeaderValue(rawHeaders, "content-type");
    const rawContent = part.slice(headerEndIndex + 4).replace(/\r\n--$/, "");
    const fileBuffer = Buffer.from(rawContent, "latin1");
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    );

    return {
      name: disposition.filename,
      type: contentTypeHeader,
      size: fileBuffer.byteLength,
      arrayBuffer: async () => arrayBuffer,
    };
  }

  return null;
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
