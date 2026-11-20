import "server-only";

import OpenAI from "openai";

import { getServerEnv, requireOpenAIApiKey } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";

export const ALLOWED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type ExtractTextFromImageParams = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

export function getImageExtension(filename: string) {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  return extension.replace(/[^a-z0-9]/g, "");
}

export function isAllowedImage(extension: string, mimeType?: string) {
  const normalizedMimeType = mimeType?.toLowerCase().trim();
  const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.includes(
    extension as (typeof ALLOWED_IMAGE_EXTENSIONS)[number],
  );

  if (!normalizedMimeType) return hasAllowedExtension;
  return hasAllowedExtension && ALLOWED_IMAGE_MIME_TYPES.has(normalizedMimeType);
}

export async function extractTextFromImageWithOpenAI({
  buffer,
  mimeType,
  originalName,
}: ExtractTextFromImageParams) {
  const client = new OpenAI({ apiKey: requireOpenAIApiKey(), maxRetries: 0, timeout: 120_000 });

  try {
    const response = await client.responses.create({
      model: getServerEnv().openAiTextModel,
      instructions: `Extraia e organize em português brasileiro todo texto visível nesta imagem.

Regras:
- Se houver texto, transcreva com fidelidade.
- Preserve nomes, datas, valores, telefones, e-mails, endereços e links.
- Não invente informações que não estejam visíveis.
- Se não houver texto suficiente, descreva objetivamente o conteúdo relevante da imagem.
- Não use markdown com ** ou ##.
- Entregue apenas texto limpo, organizado e pronto para copiar.

Arquivo: ${originalName}`,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Leia a imagem anexada: ${originalName}` },
          { type: "input_image", image_url: `data:${mimeType};base64,${buffer.toString("base64")}`, detail: "auto" },
        ],
      }],
    });

    const text = normalizePlainText(response.output_text ?? "");
    if (!text) throw new Error("A IA não retornou texto para esta imagem.");
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    throw new Error(`Falha ao gerar texto da imagem com OpenAI. ${message}`);
  }
}
