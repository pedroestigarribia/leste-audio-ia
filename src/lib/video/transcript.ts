import "server-only";

import OpenAI from "openai";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

import { convertToOpenAIChunks } from "@/lib/audio-convert";
import { getServerEnv, requireOpenAIApiKey } from "@/lib/env";
import { ensureTempDir } from "@/lib/temp-files";
import { runFfprobe } from "@/lib/video/tools";
import { mapTranscriptChunk } from "@/lib/video/transcript-utils";
import type { TranscriptSegment, TranscriptSemanticHint } from "@/types/video";

async function getChunkDuration(filePath: string) {
  const output = await runFfprobe([
    "-v", "error", "-show_entries", "format=duration", "-of", "json", filePath,
  ]);
  const duration = Number((JSON.parse(output) as { format?: { duration?: string } }).format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Não foi possível conferir a duração de uma parte do áudio.");
  }
  return duration;
}

export async function transcribeVideoStructured(params: {
  audioPath: string;
  title: string;
  durationSec: number;
}) {
  const env = getServerEnv();
  const client = new OpenAI({ apiKey: requireOpenAIApiKey(), maxRetries: 0, timeout: 240_000 });
  const tempDir = await fs.mkdtemp(path.join(await ensureTempDir(), "openai-video-transcribe-"));

  try {
    const chunks = await convertToOpenAIChunks(params.audioPath, tempDir);
    const segments: TranscriptSegment[] = [];
    const semanticHints: TranscriptSemanticHint[] = [];
    let offsetSeconds = 0;
    let language = "pt-BR";

    for (let index = 0; index < chunks.length; index += 1) {
      const chunkDuration = await getChunkDuration(chunks[index]);
      const result = await client.audio.transcriptions.create({
        file: createReadStream(chunks[index]),
        // shortcut: Whisper timestamps are scheduled for shutdown on 2027-02-26; replace when a supported OpenAI model returns segment times.
        model: env.openAiTimestampTranscribeModel,
        response_format: "verbose_json",
        timestamp_granularities: ["segment", "word"],
        prompt: `Transcreva em português brasileiro com fidelidade. Preserve nomes e números. Vídeo: ${params.title}`,
      });
      language = index === 0 && result.language ? result.language : language;
      segments.push(...mapTranscriptChunk({
        idPrefix: `seg-${index + 1}-${nanoid(4)}`,
        offsetSeconds,
        durationSec: params.durationSec,
        segments: result.segments ?? [],
        words: result.words ?? [],
      }));
      offsetSeconds += chunkDuration;
    }

    if (!segments.length) throw new Error("A OpenAI não retornou segmentos de fala com marcação temporal.");
    return { language, segments, participants: [], semanticHints };
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 300) : "erro desconhecido";
    throw new Error(`Falha ao transcrever vídeo com OpenAI. ${detail}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
