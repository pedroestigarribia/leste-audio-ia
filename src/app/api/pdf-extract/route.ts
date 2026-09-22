import { NextResponse } from "next/server";
import mammoth from "mammoth";

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
      return buildJsonError("Envie um arquivo PDF ou DOCX em multipart/form-data.", 400);
    }

    const extension = getFileExtension(file.name);
    const mimeType = file.type.toLowerCase();

    const isPdf = extension === "pdf" || mimeType === "application/pdf";
    const isDocx =
      extension === "docx" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (!isPdf && !isDocx) {
      return buildJsonError("Envie um arquivo PDF ou DOCX válido.", 400);
    }

    if (file.size > getMaxFileSizeBytes()) {
      return buildJsonError(`Documento acima do limite permitido de ${getServerEnv().maxFileSizeMb} MB.`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = isPdf
      ? await extractTextFromPdfBuffer(buffer)
      : (await mammoth.extractRawText({ buffer })).value;

    if (!text) {
      return buildJsonError(
        isPdf
          ? "Não foi possível extrair texto pesquisável deste PDF."
          : "Não foi possível extrair texto legível deste DOCX.",
        422,
      );
    }

    return NextResponse.json({
      ok: true,
      text,
      meta: {
        fileName: file.name,
        size: file.size,
        type: isDocx ? "docx" : "pdf",
      },
    });
  } catch (error) {
    return buildJsonError(
      error instanceof Error ? error.message : "Falha ao extrair texto do PDF ou DOCX.",
      502,
    );
  }
}
