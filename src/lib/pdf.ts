import "server-only";

import { createRequire } from "module";

import { normalizePlainText } from "@/lib/plain-text";

type PdfParseResult = {
  text?: string;
};

type PdfParse = (buffer: Buffer) => Promise<PdfParseResult>;

const requirePdfParse = createRequire(import.meta.url);
const pdfParse = requirePdfParse("pdf-parse/lib/pdf-parse.js") as PdfParse;

export async function extractTextFromPdfBuffer(buffer: Buffer) {
  const parsed = await pdfParse(buffer);
  return normalizePlainText(parsed.text ?? "");
}
