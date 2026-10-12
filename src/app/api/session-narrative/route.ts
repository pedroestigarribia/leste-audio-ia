import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { getTextAiModel, runTextTask } from "@/lib/text-ai";
import { normalizePlainText } from "@/lib/plain-text";
import { buildSessionNarrativePrompt } from "@/prompts/sessionNarrative";
import type { SessionNarrativeFormat, TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  items: z.array(z.object({
    name: z.string().trim().min(1),
    transcription: z.string().min(1).max(9_000),
  })).min(1).max(8),
  format: z.enum([
    "faithful", "chronological", "biography", "storytelling", "script",
    "professionalProfile", "report", "whatsapp",
  ]),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json<TextProcessResponse>({
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      }, { status: 400 });
    }

    const result = await runTextTask({
      system: "Você organiza fontes em narrativas fiéis, identifica origem e separa fatos de transições editoriais sugeridas.",
      prompt: buildSessionNarrativePrompt(parsed.data.items, parsed.data.format as SessionNarrativeFormat),
      temperature: 0.2,
    });

    return NextResponse.json<TextProcessResponse>({
      ok: true,
      result: normalizePlainText(result),
      model: getTextAiModel(),
    });
  } catch (error) {
    const message = error instanceof MissingApiKeyError
      ? getDeepSeekMissingKeyMessage()
      : error instanceof Error
        ? error.message
        : "Falha ao gerar a narrativa da sessão.";
    return NextResponse.json<TextProcessResponse>({ ok: false, error: message }, { status: 502 });
  }
}
