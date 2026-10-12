import { NextResponse } from "next/server";
import { z } from "zod";

import { getGeminiMissingKeyMessage, getDeepSeekMissingKeyMessage, getServerEnv, MissingApiKeyError } from "@/lib/env";
import { getTextAiModel, runTextTask } from "@/lib/text-ai";
import { normalizePlainText } from "@/lib/plain-text";
import { buildVoiceSessionPrompt } from "@/prompts/voiceSession";
import { VOICE_MODES } from "@/types/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stateSchema = z.object({
  intent: z.string(), domain: z.string(), artifact: z.string(),
  requirements: z.array(z.string()), exclusions: z.array(z.string()),
  technologies: z.array(z.string()), corrections: z.array(z.string()),
  openQuestions: z.array(z.string()), normalizedText: z.string(),
  interpretation: z.string(), output: z.string(),
});

const requestSchema = z.object({
  newText: z.string().trim().min(1).max(40_000),
  previous: stateSchema,
  mode: z.enum(VOICE_MODES),
  fullRefresh: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Trecho, modo ou estado semântico inválido (máximo 40.000 caracteres por chamada)." }, { status: 400 });
    }

    const raw = await runTextTask({
      system: "Você interpreta falas em português brasileiro. Gere JSON válido e preserve requisitos, correções e restrições. Não exponha raciocínio interno.",
      prompt: buildVoiceSessionPrompt(parsed.data),
      temperature: 0.1,
    });
    const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const state = stateSchema.parse(JSON.parse(json));
    if (!state.output.trim()) throw new Error("A IA não retornou uma saída utilizável.");

    return NextResponse.json({
      ok: true,
      state: { ...state, normalizedText: normalizePlainText(state.normalizedText), interpretation: normalizePlainText(state.interpretation), output: normalizePlainText(state.output) },
      model: getTextAiModel(),
    });
  } catch (error) {
    const message = error instanceof MissingApiKeyError
      ? getServerEnv().textAiProvider === "deepseek" ? getDeepSeekMissingKeyMessage() : getGeminiMissingKeyMessage()
      : error instanceof z.ZodError || error instanceof SyntaxError
        ? "A IA retornou um formato inválido. Tente novamente."
        : error instanceof Error ? error.message : "Falha ao interpretar a voz.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
