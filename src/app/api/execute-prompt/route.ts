import { NextResponse } from "next/server";
import { z } from "zod";

import { runTextTask } from "@/lib/text-ai";
import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import type { TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const executePromptSchema = z.object({
  prompt: z.string().trim().min(1, "Envie um prompt para executar."),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = executePromptSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        { ok: false, error: parsedBody.error.issues[0]?.message ?? "Corpo inválido." },
        { status: 400 },
      );
    }

    const result = await runTextTask({
      system:
        "Você executa prompts técnicos em português brasileiro com precisão, clareza e fidelidade ao solicitado. Não inventa informações ausentes — indica o que faltaria.",
      prompt: parsedBody.data.prompt,
      temperature: 0.3,
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
          : "Falha ao executar o prompt.";

    return NextResponse.json<TextProcessResponse>(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
