import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getDeepSeekMissingKeyMessage, getServerEnv } from "@/lib/env";
import { runDeepSeekTextTask } from "@/lib/deepseek";
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
    .min(1, "Envie ao menos uma transcricao."),
  mode: z.enum(["analysis", "tasks", "keyData", "reply"]).default("analysis"),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = analyzeAllSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        {
          ok: false,
          error: parsedBody.error.issues[0]?.message ?? "Corpo invalido.",
        },
        { status: 400 },
      );
    }

    const result = await runDeepSeekTextTask({
      system:
        "Voce analisa varias transcricoes em portugues brasileiro sem inventar fatos e sem expor raciocinio oculto.",
      prompt: buildAnalyzeAllPrompt(
        parsedBody.data.items as AnalyzeAllItem[],
        parsedBody.data.mode as AnalyzeAllMode,
      ),
      temperature: 0.2,
    });

    return NextResponse.json<TextProcessResponse>({
      ok: true,
      result: normalizePlainText(result),
      model: getServerEnv().deepSeekModel,
    });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getDeepSeekMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Falha ao interpretar as transcricoes.";

    return NextResponse.json<TextProcessResponse>(
      {
        ok: false,
        error: message,
      },
      { status: 502 },
    );
  }
}
