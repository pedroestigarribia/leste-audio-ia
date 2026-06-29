import { NextResponse } from "next/server";

import { getFileExtension } from "@/lib/audio";
import { getMaxFileSizeBytes, getServerEnv } from "@/lib/env";
import { parseMultipartFile } from "@/lib/multipart";
import { extractTextFromPdfBuffer } from "@/lib/pdf";

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
      return buildJsonError("Envie um arquivo PDF em multipart/form-data.", 400);
    }

    const extension = getFileExtension(file.name);
    const mimeType = file.type.toLowerCase();

    if (extension !== "pdf" && mimeType !== "application/pdf") {
      return buildJsonError("Envie um arquivo PDF valido.", 400);
    }

    if (file.size > getMaxFileSizeBytes()) {
      return buildJsonError(`PDF acima do limite permitido de ${getServerEnv().maxFileSizeMb} MB.`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromPdfBuffer(buffer);

    if (!text) {
      return buildJsonError("Nao foi possivel extrair texto pesquisavel deste PDF.", 422);
    }

    return NextResponse.json({
      ok: true,
      text,
      meta: {
        fileName: file.name,
        size: file.size,
      },
    });
  } catch (error) {
    return buildJsonError(
      error instanceof Error ? error.message : "Falha ao extrair texto do PDF.",
      502,
    );
  }
}
