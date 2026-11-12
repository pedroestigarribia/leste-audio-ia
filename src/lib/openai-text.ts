import "server-only";

import OpenAI from "openai";

import { getServerEnv, requireOpenAIApiKey } from "@/lib/env";

type TextTaskParams = {
  system?: string;
  prompt: string;
  temperature?: number;
};

export async function runOpenAITextTask({ system, prompt }: TextTaskParams) {
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
  });
  const result = response.output_text?.trim();

  if (!result) {
    throw new Error("A OpenAI não retornou texto para esta solicitação.");
  }

  return result;
}
