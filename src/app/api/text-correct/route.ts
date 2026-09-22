import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { runTextTask } from "@/lib/text-ai";
import { normalizePlainText } from "@/lib/plain-text";
import { buildTextCorrectPrompt } from "@/prompts/textCorrect";
import type { TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const textCorrectSchema = z.object({
  text: z.string().trim().min(1, "Envie um texto para processar."),
  mode: z.enum([
    "corrigir",
    "reescrever",
    "encurtar",
    "expandir",
    "profissional",
    "informal",
    "clareza",
    "remover_repeticoes",
    "pontuacao",
    "humanizar",
  ]),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = textCorrectSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        { ok: false, error: parsedBody.error.issues[0]?.message ?? "Corpo inválido." },
        { status: 400 },
      );
    }

    const { system, prompt } = buildTextCorrectPrompt(parsedBody.data.text, parsedBody.data.mode);

    const result = await runTextTask({
      system,
      prompt,
      temperature: 0.2,
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
          : "Falha ao processar o texto.";

    return NextResponse.json<TextProcessResponse>({ ok: false, error: message }, { status: 502 });
  }
}
