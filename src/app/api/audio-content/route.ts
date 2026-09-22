import { NextResponse } from "next/server";
import { z } from "zod";

import { audioIntelligenceResultSchema } from "@/lib/audio-intelligence";
import { MissingApiKeyError, getGeminiMissingKeyMessage } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { getTextAiModel, runTextTask } from "@/lib/text-ai";
import { buildAudioContentPrompt } from "@/prompts/audioContent";
import type { AudioContentKind } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum([
    "article",
    "businessPlan",
    "copy",
    "marketingStrategy",
    "post",
    "script",
    "storytelling",
    "whatsapp",
    "audiobookOutline",
  ]),
  transcription: z.string().trim().min(1, "Envie a transcrição de origem.").max(1_000_000),
  analysis: audioIntelligenceResultSchema,
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const result = await runTextTask({
      system:
        "Você cria conteúdo em português brasileiro de forma fiel, objetiva e segura. Não inventa informações nem expõe raciocínio oculto.",
      prompt: buildAudioContentPrompt({
        kind: parsed.data.kind as AudioContentKind,
        transcription: parsed.data.transcription,
        analysis: parsed.data.analysis,
      }),
      temperature: 0.35,
    });

    return NextResponse.json({ ok: true, result: normalizePlainText(result), model: getTextAiModel() });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getGeminiMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Não foi possível gerar o conteúdo.";

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
