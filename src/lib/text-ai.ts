import "server-only";

import { getServerEnv } from "@/lib/env";
import { runDeepSeekTextTask } from "@/lib/deepseek";
import { runGeminiTextTask } from "@/lib/gemini-text";

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

  return runGeminiTextTask(params);
}

export function getTextAiModel() {
  const env = getServerEnv();
  return env.textAiProvider === "deepseek" ? env.deepSeekModel : env.geminiTextModel;
}
