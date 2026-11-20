import "server-only";

import { getServerEnv } from "@/lib/env";
import { runOpenAITextTask } from "@/lib/openai-text";

type TextTaskParams = {
  system?: string;
  prompt: string;
  temperature?: number;
  signal?: AbortSignal;
};

export async function runTextTask(params: TextTaskParams) {
  return runOpenAITextTask(params);
}

export function getTextAiModel() {
  return getServerEnv().openAiTextModel;
}
