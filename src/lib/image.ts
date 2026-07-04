import "server-only";

import { GoogleGenAI } from "@google/genai";

import { MissingApiKeyError, getServerEnv, requireGeminiApiKey } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";

export const ALLOWED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type ExtractTextFromImageParams = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

function extractTextFromGeminiResponse(response: any): string {
  if (!response) {
    return "";
  }

  if (typeof response.text === "string") {
    return response.text;
  }

  if (typeof response.text === "function") {
    return response.text();
  }

  const parts = response.candidates?.flatMap((candidate: any) => candidate.content?.parts ?? []) ?? [];

  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function getImageExtension(filename: string) {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  return extension.replace(/[^a-z0-9]/g, "");
}

export function isAllowedImage(extension: string, mimeType?: string) {
  const normalizedMimeType = mimeType?.toLowerCase().trim();
  const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.includes(
    extension as (typeof ALLOWED_IMAGE_EXTENSIONS)[number],
  );

  if (!normalizedMimeType) {
    return hasAllowedExtension;
  }

  return hasAllowedExtension && ALLOWED_IMAGE_MIME_TYPES.has(normalizedMimeType);
}

export async function extractTextFromImageWithGemini({
  buffer,
  mimeType,
  originalName,
}: ExtractTextFromImageParams) {
  const env = getServerEnv();
  const apiKey = requireGeminiApiKey();
  const client = new GoogleGenAI({ apiKey }) as any;

  try {
    const response = await client.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Extraia e organize em portugues brasileiro todo texto visivel nesta imagem.

Regras:
- Se houver texto, transcreva com fidelidade.
- Preserve nomes, datas, valores, telefones, e-mails, enderecos e links.
- Nao invente informacoes que nao estejam visiveis.
- Se nao houver texto suficiente, descreva objetivamente o conteudo relevante da imagem.
- Nao use markdown com ** ou ##.
- Entregue apenas texto limpo, organizado e pronto para copiar.

Arquivo: ${originalName}`,
            },
            {
              inlineData: {
                mimeType,
                data: buffer.toString("base64"),
              },
            },
          ],
        },
      ],
    });

    const text = normalizePlainText(extractTextFromGeminiResponse(response));

    if (!text) {
      throw new Error("A IA nao retornou texto para esta imagem.");
    }

    return text;
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    throw new Error(`Falha ao gerar texto da imagem. ${message}`);
  }
}
