import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getGeminiMissingKeyMessage, getServerEnv } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { synthesizeSpeechWithGemini } from "@/lib/gemini-tts";
import type { NarrationOptions, NarrationStyle, PronunciationEntry } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPEECH_ROUTE_VERSION = "milena-voz-enhanced-2026-07-25";

const speechSchema = z.object({
  text: z.string().trim().min(1, "Envie um texto para leitura."),
  title: z.string().trim().max(200).optional(),
  format: z.enum(["mp3", "wav"]).optional().default("mp3"),
  speed: z.number().min(0.5).max(2.0).optional().default(1.0),
  estilo: z
    .enum([
      "natural",
      "formal",
      "emocional",
      "didatica",
      "institucional",
      "audiolivro",
      "noticia",
      "apresentacao",
      "treinamento",
      "podcast",
      "roteiro",
    ])
    .optional()
    .default("natural"),
  pronunciation: z
    .array(z.object({ original: z.string(), pronuncia: z.string() }))
    .optional()
    .default([]),
});

type SpeechChunkMeta = { index: number; text: string; estimatedChars: number };

function splitTextForSpeech(text: string, maxChunkLength = 3800) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks: SpeechChunkMeta[] = [];

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    if (paragraph.length > maxChunkLength) {
      const sentences = paragraph.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [paragraph];
      let buffer = "";

      for (const sentence of sentences) {
        const candidate = buffer ? `${buffer}\n${sentence.trim()}` : sentence.trim();

        if (candidate.length > maxChunkLength && buffer) {
          chunks.push({ index: chunks.length, text: buffer, estimatedChars: buffer.length });
          buffer = sentence.trim();
        } else {
          buffer = candidate;
        }
      }

      if (buffer) {
        chunks.push({ index: chunks.length, text: buffer, estimatedChars: buffer.length });
      }

      continue;
    }

    const candidate = chunks.length > 0 ? `${chunks[chunks.length - 1].text}\n\n${paragraph}` : paragraph;

    if (candidate.length > maxChunkLength && chunks.length > 0) {
      chunks.push({ index: chunks.length, text: paragraph, estimatedChars: paragraph.length });
    } else if (chunks.length > 0) {
      chunks[chunks.length - 1] = {
        ...chunks[chunks.length - 1],
        text: candidate,
        estimatedChars: candidate.length,
      };
    } else {
      chunks.push({ index: 0, text: paragraph, estimatedChars: paragraph.length });
    }
  }

  return chunks.map((chunk, i) => ({ ...chunk, index: i }));
}

const STYLE_PROMPTS: Record<NarrationStyle, string> = {
  natural: "voz natural e ritmo claro",
  formal: "voz formal, com diccao precisa e ritmo moderado",
  emocional: "voz expressiva e emocional, com entonacao variada",
  didatica: "voz didatica, pausada e explicativa, como uma aula",
  institucional: "voz institucional, seria e confiavel",
  audiolivro: "voz de audiolivro, fluida, envolvente e bem articulada",
  noticia: "voz de telejornal, clara, objetiva e com entonacao neutra",
  apresentacao: "voz de apresentacao, energica e com pausas estrategicas",
  treinamento: "voz de treinamento, paciente e encorajadora",
  podcast: "voz de podcast, conversacional e envolvente",
  roteiro: "voz de roteiro, com indicações de pausas e entonação",
};

function buildSpeechPrompt(
  chunkText: string,
  chunkIndex: number,
  totalChunks: number,
  estilo: NarrationStyle,
  pronunciation: PronunciationEntry[],
  title?: string,
): string {
  const styleDesc = STYLE_PROMPTS[estilo] ?? STYLE_PROMPTS.natural;
  let prompt = "";

  if (chunkIndex === 0 && title) {
    prompt += `${title}.\n\n`;
  } else if (totalChunks > 1) {
    prompt += `Parte ${chunkIndex + 1} de ${totalChunks}.\n\n`;
  }

  if (pronunciation.length > 0) {
    const rules = pronunciation
      .map((p) => `"${p.original}" deve ser pronunciado como "${p.pronuncia}"`)
      .join(". ");
    prompt += `Regras de pronúncia: ${rules}.\n\n`;
  }

  prompt += `Leia em português brasileiro, com ${styleDesc}:\n\n${chunkText}`;

  return prompt;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = speechSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { ok: false, error: parsedBody.error.issues[0]?.message ?? "Corpo inválido." },
        {
          status: 400,
          headers: { "X-Leste-Speech-Version": SPEECH_ROUTE_VERSION },
        },
      );
    }

    const cleanedText = normalizePlainText(parsedBody.data.text);
    const chunks = splitTextForSpeech(cleanedText, parsedBody.data.text.length > 10000 ? 3500 : 3800);
    const speechModel =
      parsedBody.data.estilo === "audiolivro"
        ? getServerEnv().geminiTtsAudiobookModel
        : getServerEnv().geminiTtsModel;
    const audioResults = [];

    for (const chunk of chunks) {
      const prompt = buildSpeechPrompt(
        chunk.text,
        chunk.index,
        chunks.length,
        parsedBody.data.estilo,
        parsedBody.data.pronunciation,
        parsedBody.data.title,
      );
      const result = await synthesizeSpeechWithGemini(prompt, { model: speechModel });
      audioResults.push(result);
    }

    const firstResult = audioResults[0];
    let audio = firstResult.audio;
    let contentType = firstResult.contentType;

    if (parsedBody.data.format === "mp3") {
      const allResultsAreMp3 = audioResults.every(
        (item) => item.contentType.includes("mpeg") || item.contentType.includes("mp3"),
      );
      const allResultsAreWav = audioResults.every((item) => item.contentType === "audio/wav");

      if (allResultsAreMp3) {
        audio = Buffer.concat(audioResults.map((item) => item.audio));
        contentType = "audio/mpeg";
      } else if (allResultsAreWav) {
        const { encodeWavBuffersToMp3 } = await import("@/lib/speech-mp3");
        audio = encodeWavBuffersToMp3(audioResults.map((item) => item.audio));
        contentType = "audio/mpeg";
      } else {
        throw new Error("Não foi possível converter todos os blocos de voz para MP3.");
      }
    }

    const audioBody = new Uint8Array(audio);
    const totalChars = cleanedText.length;
    const estimatedDurationSec = Math.round((totalChars / 900) * 60);
    const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;

    return new NextResponse(audioBody, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Leste-Speech-Version": SPEECH_ROUTE_VERSION,
        "X-Leste-Total-Chunks": String(chunks.length),
        "X-Leste-Estimated-Duration-Sec": String(estimatedDurationSec),
        "X-Leste-Total-Chars": String(totalChars),
        "X-Leste-Word-Count": String(wordCount),
      },
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json(
        { ok: false, error: getGeminiMissingKeyMessage() },
        {
          status: 500,
          headers: { "X-Leste-Speech-Version": SPEECH_ROUTE_VERSION },
        },
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao gerar áudio." },
      {
        status: 502,
        headers: { "X-Leste-Speech-Version": SPEECH_ROUTE_VERSION },
      },
    );
  }
}
