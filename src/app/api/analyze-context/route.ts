import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { runTextTask } from "@/lib/text-ai";
import { normalizePlainText } from "@/lib/plain-text";
import { buildAnalyzeContextPrompt, type AnalyzeMode } from "@/prompts/analyzeContext";
import type { TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN_MODES = [
  "compreensao_global",
  "interpretacao",
  "extracao",
  "mapeamentos",
  "diagnostico",
  "recomendacoes",
  "criacao",
  "processo_criativo",
  "comparacao",
] as const satisfies AnalyzeMode[];

const analyzeContextSchema = z.object({
  text: z.string().trim().min(1, "Envie um texto para analisar."),
  mode: z.enum(KNOWN_MODES),
  formato: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = analyzeContextSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        { ok: false, error: parsedBody.error.issues[0]?.message ?? "Corpo inválido." },
        { status: 400 },
      );
    }

    const extraParams: Record<string, string> = {};
    if (parsedBody.data.formato) {
      extraParams.formato = parsedBody.data.formato;
    }

    const { system, prompt } = buildAnalyzeContextPrompt(
      parsedBody.data.mode,
      parsedBody.data.text,
      extraParams,
    );

    const result = await runTextTask({
      system,
      prompt,
      temperature: 0.1,
    });

    return NextResponse.json<TextProcessResponse>({
      ok: true,
      result: normalizePlainText(result),
    });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getDeepSeekMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Falha ao analisar o contexto.";

    return NextResponse.json<TextProcessResponse>({ ok: false, error: message }, { status: 502 });
  }
}
