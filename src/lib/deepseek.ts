import "server-only";

import OpenAI from "openai";

import { MissingApiKeyError, getServerEnv, requireDeepSeekApiKey } from "@/lib/env";

type DeepSeekTextTaskParams = {
  system?: string;
  prompt: string;
  temperature?: number;
};

function flattenContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part: unknown) => {
      if (typeof part === "string") {
        return part;
      }

      if (typeof part === "object" && part !== null && "text" in part) {
        const text = part.text;
        return typeof text === "string" ? text : "";
      }

      return "";
    })
    .join("")
    .trim();
}

export async function runDeepSeekTextTask({
  system,
  prompt,
  temperature = 0.2,
}: DeepSeekTextTaskParams): Promise<string> {
  const env = getServerEnv();
  const apiKey = requireDeepSeekApiKey();

  const client = new OpenAI({
    apiKey,
    baseURL: env.deepSeekBaseUrl,
  });

  try {
    const response = await client.chat.completions.create({
      model: env.deepSeekModel,
      temperature,
      stream: false,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: prompt },
      ],
    });

    const output = flattenContent(response.choices[0]?.message?.content);

    if (!output) {
      throw new Error("A API da DeepSeek nao retornou conteudo.");
    }

    return output;
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    throw new Error(`Falha ao processar texto com DeepSeek. ${message}`);
  }
}
