import "server-only";

import OpenAI from "openai";

import { getServerEnv, requireOpenAIApiKey } from "@/lib/env";

type TextTaskParams = {
  system?: string;
  prompt: string;
  temperature?: number;
  signal?: AbortSignal;
};

export async function runOpenAITextTask({ system, prompt, signal }: TextTaskParams) {
  const client = new OpenAI({
    apiKey: requireOpenAIApiKey(),
    maxRetries: 0,
    timeout: 120_000,
  });
  const response = await client.responses.create({
    model: getServerEnv().openAiTextModel,
    instructions: system,
    input: prompt,
    reasoning: { effort: "low" },
  }, { signal });
  const result = response.output_text?.trim();

  if (!result) {
    throw new Error("A OpenAI não retornou texto para esta solicitação.");
  }

  return result;
}
