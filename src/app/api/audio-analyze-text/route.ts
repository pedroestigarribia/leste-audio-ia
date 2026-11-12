import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeTranscriptionWithTextAi } from "@/lib/audio-intelligence";
import {
  MissingApiKeyError,
  getTextAIMissingKeyMessage,
} from "@/lib/env";
import { getTextAiModel } from "@/lib/text-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  text: z.string().trim().min(1, "Envie uma transcrição para interpretar."),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.safeParse(await request.json());

    if (!body.success) {
      return NextResponse.json(
        { ok: false, error: body.error.issues[0]?.message ?? "Corpo inválido." },
        { status: 400 },
      );
    }

    const result = await analyzeTranscriptionWithTextAi(body.data.text);

    return NextResponse.json({
      ok: true,
      result,
      model: getTextAiModel(),
    });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getTextAIMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Não foi possível interpretar a transcrição.";

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
