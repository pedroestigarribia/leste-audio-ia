import { NextResponse } from "next/server";

import { getMaxFileSizeBytes, getServerEnv, getGeminiMissingKeyMessage, MissingApiKeyError } from "@/lib/env";
import { extractTextFromImageWithGemini, getImageExtension, isAllowedImage } from "@/lib/image";
import { parseMultipartFile } from "@/lib/multipart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildJsonError(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    const file = await parseMultipartFile(request);

    if (!file) {
      return buildJsonError("Envie uma imagem em multipart/form-data.", 400);
    }

    const extension = getImageExtension(file.name);
    const mimeType = file.type.toLowerCase();

    if (!isAllowedImage(extension, mimeType)) {
      return buildJsonError("Envie uma imagem válida em PNG, JPG, JPEG ou WEBP.", 400);
    }

    if (file.size > getMaxFileSizeBytes()) {
      return buildJsonError(
        `Imagem acima do limite permitido de ${getServerEnv().maxFileSizeMb} MB.`,
        400,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromImageWithGemini({
      buffer,
      mimeType,
      originalName: file.name,
    });

    return NextResponse.json({
      ok: true,
      text,
      meta: {
        fileName: file.name,
        size: file.size,
        mimeType,
      },
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return buildJsonError(getGeminiMissingKeyMessage(), 500);
    }

    return buildJsonError(
      error instanceof Error ? error.message : "Falha ao gerar texto da imagem.",
      502,
    );
  }
}
