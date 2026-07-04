import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getGeminiMissingKeyMessage } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { synthesizeSpeechWithGemini } from "@/lib/gemini-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPEECH_ROUTE_VERSION = "in-memory-mp3-2026-07-04";

const speechSchema = z.object({
  text: z.string().trim().min(1, "Envie um texto para leitura.").max(24000, "Texto muito longo para leitura em voz."),
  title: z.string().trim().max(120).optional(),
  format: z.enum(["mp3", "wav"]).optional().default("mp3"),
});

function splitTextForSpeech(text: string, maxChunkLength = 3600) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    if (paragraph.length > maxChunkLength) {
      const sentences = paragraph.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [paragraph];

      for (const sentence of sentences) {
        const nextChunk = currentChunk ? `${currentChunk}\n${sentence.trim()}` : sentence.trim();

        if (nextChunk.length > maxChunkLength && currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence.trim();
        } else {
          currentChunk = nextChunk;
        }
      }

      continue;
    }

    const nextChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;

    if (nextChunk.length > maxChunkLength && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk = nextChunk;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function buildSpeechAudio(text: string, title?: string) {
  const chunks = splitTextForSpeech(text);
  const audioResults = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunkIntro =
      index === 0 && title
        ? `${title}.\n\n`
        : chunks.length > 1
          ? `Continuação ${index + 1} de ${chunks.length}.\n\n`
          : "";
    const result = await synthesizeSpeechWithGemini(
      `${chunkIntro}Leia em portugues brasileiro, com voz natural e ritmo claro:\n\n${chunks[index]}`,
    );
    audioResults.push(result);
  }

  return audioResults;
}

function buildJsonError(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      version: SPEECH_ROUTE_VERSION,
    },
    {
      status,
      headers: {
        "X-Leste-Speech-Version": SPEECH_ROUTE_VERSION,
      },
    },
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
    const audioResults = await buildSpeechAudio(cleanedText, parsedBody.data.title);
    const result = audioResults[0];

    let audio = result.audio;
    let contentType = result.contentType;
    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
    };

    if (parsedBody.data.format === "mp3") {
      const allResultsAreMp3 = audioResults.every(
        (item) => item.contentType.includes("mpeg") || item.contentType.includes("mp3"),
      );
      const allResultsAreWav = audioResults.every((item) => item.contentType === "audio/wav");

      if (allResultsAreMp3) {
        audio = Buffer.concat(audioResults.map((item) => item.audio));
        contentType = "audio/mpeg";
      } else if (allResultsAreWav) {
        const { convertWavBuffersToMp3 } = await import("@/lib/audio-convert");
        audio = await convertWavBuffersToMp3(audioResults.map((item) => item.audio));
        contentType = "audio/mpeg";
      } else {
        throw new Error("Nao foi possivel converter todos os blocos de voz para MP3.");
      }
    }

    const audioBody = new Uint8Array(audio);

    return new NextResponse(audioBody, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": contentType,
        "X-Leste-Speech-Version": SPEECH_ROUTE_VERSION,
      },
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return buildJsonError(getGeminiMissingKeyMessage(), 500);
    }

    return buildJsonError(
      error instanceof Error ? error.message : "Falha ao gerar audio de leitura.",
      502,
    );
  }
}
