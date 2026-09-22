import "server-only";

import { GoogleGenAI } from "@google/genai";

import { MissingApiKeyError, getServerEnv, requireGeminiApiKey } from "@/lib/env";

type GeminiTextTaskParams = {
  system?: string;
  prompt: string;
  temperature?: number;
};

function readResponseText(response: any) {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  if (typeof response?.text === "function") {
    const text = response.text();
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

export async function runGeminiTextTask({
  system,
  prompt,
  temperature = 0.2,
}: GeminiTextTaskParams): Promise<string> {
  const env = getServerEnv();
  const client = new GoogleGenAI({ apiKey: requireGeminiApiKey() });

  try {
    const config: Record<string, unknown> = {};

    if (system) {
      config.systemInstruction = system;
    }

    // Gemini 3.x controls reasoning internally; do not request or expose hidden thinking.
    if (!env.geminiTextModel.startsWith("gemini-3.")) {
      config.temperature = temperature;
    }

    const response = await client.models.generateContent({
      model: env.geminiTextModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
    });
    const output = readResponseText(response);

    if (!output) {
      throw new Error("A API do Gemini não retornou conteúdo.");
    }

    return output;
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    throw new Error(`Falha ao processar texto com Gemini. ${message}`);
  }
}
