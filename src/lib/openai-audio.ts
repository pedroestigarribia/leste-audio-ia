import "server-only";

import OpenAI from "openai";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

import { convertToOpenAIChunks } from "@/lib/audio-convert";
import { getServerEnv, requireOpenAIApiKey } from "@/lib/env";
import { ensureTempDir } from "@/lib/temp-files";

const TRANSCRIPTION_PROMPT =
  "Transcreva com fidelidade em português brasileiro. Não resuma nem invente. Preserve nomes, datas e valores. Marque trechos incertos como [trecho incerto] e inaudíveis como [inaudível].";

export async function transcribeAudioWithOpenAI(params: { filePath: string }) {
  const apiKey = requireOpenAIApiKey();
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 240_000 });
  const tempDir = await fs.mkdtemp(path.join(await ensureTempDir(), "openai-transcribe-"));

  try {
    const chunks = await convertToOpenAIChunks(params.filePath, tempDir);
    const transcriptions: string[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      try {
        const result = await client.audio.transcriptions.create({
          file: createReadStream(chunks[index]),
          model: getServerEnv().openAiTranscribeModel,
          prompt: TRANSCRIPTION_PROMPT,
          response_format: "json",
        });
        const text = result.text.trim();

        if (!text) {
          throw new Error("A API não retornou texto para esta parte.");
        }
        transcriptions.push(text);
      } catch (error) {
        const detail = error instanceof Error ? error.message.slice(0, 300) : "erro desconhecido";
        throw new Error(`Falha na parte ${index + 1} de ${chunks.length} da transcrição OpenAI: ${detail}`);
      }
    }

    return { transcription: transcriptions.join("\n\n"), converted: true };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
