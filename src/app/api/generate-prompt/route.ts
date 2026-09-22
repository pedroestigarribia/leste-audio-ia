import { NextResponse } from "next/server";
import { z } from "zod";

import { runTextTask } from "@/lib/text-ai";
import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { buildUnifiedPromptGeneratorPrompt } from "@/prompts/generatePrompt";
import type { TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const generatePromptSchema = z.object({
  painelGeral: z.object({
    summary: z.string().optional().default(""),
    organized: z.string().optional().default(""),
    analysis: z.string().optional().default(""),
    tasks: z.string().optional().default(""),
    keyData: z.string().optional().default(""),
    reply: z.string().optional().default(""),
  }),
  transcriptions: z.array(z.string().trim().min(1)).default([]),
  videoContext: z.string().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = generatePromptSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        { ok: false, error: parsedBody.error.issues[0]?.message ?? "Corpo inválido." },
        { status: 400 },
      );
    }

    const { painelGeral, transcriptions, videoContext } = parsedBody.data;

    const hasContent =
      painelGeral.summary.trim() ||
      painelGeral.organized.trim() ||
      painelGeral.analysis.trim() ||
      painelGeral.tasks.trim() ||
      painelGeral.keyData.trim() ||
      painelGeral.reply.trim() ||
      transcriptions.some((t) => t.trim()) ||
      videoContext.trim();

    if (!hasContent) {
      return NextResponse.json<TextProcessResponse>(
        {
          ok: false,
          error: "Gere ao menos um resumo, organização, interpretação ou transcrição antes de gerar o prompt.",
        },
        { status: 400 },
      );
    }

    const result = await runTextTask({
      system:
        "Você é um gerador de prompts inteligente em português brasileiro. Analisa transcrições, resumos e análises para gerar prompts claros, técnicos e reutilizáveis. Não inventa fatos.",
      prompt: buildUnifiedPromptGeneratorPrompt({
        painelGeral,
        transcriptions,
        videoContext,
      }),
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
          : "Falha ao gerar o prompt.";

    return NextResponse.json<TextProcessResponse>(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
