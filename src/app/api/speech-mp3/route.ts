import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getGeminiMissingKeyMessage } from "@/lib/env";
import { synthesizeSpeechWithGemini } from "@/lib/gemini-tts";
import { normalizePlainText } from "@/lib/plain-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const speechSchema = z.object({
  text: z.string().trim().min(1, "Envie um texto para leitura.").max(8000, "Texto muito longo para leitura em voz."),
  title: z.string().trim().max(120).optional(),
});

function buildJsonError(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = speechSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return buildJsonError(parsedBody.error.issues[0]?.message ?? "Corpo invalido.", 400);
    }

    const cleanedText = normalizePlainText(parsedBody.data.text);
    const intro = parsedBody.data.title ? `${parsedBody.data.title}.\n\n` : "";
    const result = await synthesizeSpeechWithGemini(
      `${intro}Leia em portugues brasileiro, com voz natural e ritmo claro:\n\n${cleanedText}`,
    );

    let audio = result.audio;

    if (!(result.contentType.includes("mpeg") || result.contentType.includes("mp3"))) {
      if (result.contentType !== "audio/wav") {
        throw new Error(`Nao foi possivel converter ${result.contentType} para MP3.`);
      }

      const { convertWavBufferToMp3 } = await import("@/lib/audio-convert");
      audio = await convertWavBufferToMp3(result.audio);
    }

    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return buildJsonError(getGeminiMissingKeyMessage(), 500);
    }

    return buildJsonError(
      error instanceof Error ? error.message : "Falha ao gerar audio MP3.",
      502,
    );
  }
}
