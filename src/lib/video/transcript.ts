import "server-only";

import OpenAI from "openai";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

import { convertToOpenAIChunks } from "@/lib/audio-convert";
import { getServerEnv, requireOpenAIApiKey } from "@/lib/env";
import { ensureTempDir } from "@/lib/temp-files";
import type { TranscriptSegment, TranscriptSemanticHint } from "@/types/video";

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
      const result = await client.audio.transcriptions.create({
        file: createReadStream(chunks[index]),
        // shortcut: Whisper timestamps are scheduled for shutdown on 2027-02-26; replace when a supported OpenAI model returns segment times.
        model: env.openAiTimestampTranscribeModel,
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
        prompt: `Transcreva em português brasileiro com fidelidade. Preserve nomes e números. Vídeo: ${params.title}`,
      });
      language = index === 0 && result.language ? result.language : language;
      for (const segment of result.segments ?? []) {
        const start = Math.max(0, Math.min(params.durationSec, offsetSeconds + segment.start));
        const end = Math.max(0, Math.min(params.durationSec, offsetSeconds + segment.end));
        if (segment.text.trim() && end > start) {
          segments.push({ id: `seg-${index + 1}-${segment.id}-${nanoid(4)}`, start, end, text: segment.text.trim(), words: [] });
        }
      }
      offsetSeconds += result.duration;
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
