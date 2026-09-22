import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { getTextAiModel, runTextTask } from "@/lib/text-ai";
import { normalizePlainText } from "@/lib/plain-text";
import { buildAnalyzeAllPrompt } from "@/prompts/analyzeAll";
import type { AnalyzeAllItem, AnalyzeAllMode, TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const analyzeAllSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        transcription: z.string().trim().min(1),
      }),
    )
    .min(1, "Envie ao menos uma transcrição."),
  mode: z.enum(["analysis", "tasks", "keyData", "reply", "intent"]).default("analysis"),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = analyzeAllSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        {
          ok: false,
          error: parsedBody.error.issues[0]?.message ?? "Corpo inválido.",
        },
        { status: 400 },
      );
    }

    const result = await runTextTask({
      system:
        "Você analisa várias transcrições em português brasileiro sem inventar fatos e sem expor raciocínio oculto.",
      prompt: buildAnalyzeAllPrompt(
        parsedBody.data.items as AnalyzeAllItem[],
        parsedBody.data.mode as AnalyzeAllMode,
      ),
      temperature: 0.2,
    });

    return NextResponse.json<TextProcessResponse>({
      ok: true,
      result: normalizePlainText(result),
      model: getTextAiModel(),
    });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getDeepSeekMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Falha ao interpretar as transcrições.";

    return NextResponse.json<TextProcessResponse>(
      {
        ok: false,
        error: message,
      },
      { status: 502 },
    );
  }
}
