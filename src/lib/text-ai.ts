import "server-only";

import { getServerEnv } from "@/lib/env";
import { runDeepSeekTextTask } from "@/lib/deepseek";
import { runGeminiTextTask } from "@/lib/gemini-text";
import { runOpenAITextTask } from "@/lib/openai-text";

type TextTaskParams = {
  system?: string;
  prompt: string;
  temperature?: number;
};

export async function runTextTask(params: TextTaskParams) {
  const env = getServerEnv();

  if (env.textAiProvider === "deepseek") {
    return runDeepSeekTextTask(params);
  }

  if (env.textAiProvider === "openai") {
    return runOpenAITextTask(params);
  }

  return runGeminiTextTask(params);
}

export function getTextAiModel() {
  const env = getServerEnv();
  if (env.textAiProvider === "deepseek") return env.deepSeekModel;
  if (env.textAiProvider === "openai") return env.openAiTextModel;
  return env.geminiTextModel;
}
