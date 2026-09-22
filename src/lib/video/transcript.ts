import "server-only";

import { GoogleGenAI } from "@google/genai";
import { nanoid } from "nanoid";
import { z } from "zod";

import { deleteGeminiRemoteFile, waitForGeminiFileActive } from "@/lib/gemini";
import { getServerEnv, requireGeminiApiKey } from "@/lib/env";
import { buildVideoTranscriptionPrompt } from "@/prompts/videoTranscription";
import type { Participant, TranscriptSegment } from "@/types/video";

const transcriptSchema = z.object({
  language: z.string().default("pt-BR"),
  segments: z.array(
    z.object({
      id: z.string().optional(),
      start: z.number().nonnegative(),
      end: z.number().nonnegative(),
      text: z.string(),
      speakerId: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
      words: z.array(
        z.object({
          word: z.string(),
          start: z.number().nonnegative(),
          end: z.number().nonnegative(),
          confidence: z.number().min(0).max(1).optional(),
          speakerId: z.string().optional(),
        }),
      ).default([]),
    }),
  ),
  participants: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      speakingTime: z.number().nonnegative().optional(),
    }),
  ).default([]),
  semanticHints: z.array(z.object({
    segmentId: z.string(),
    topic: z.string().default(""),
    subtopics: z.array(z.string()).default([]),
    hasQuestion: z.boolean().default(false),
    hasAnswer: z.boolean().default(false),
    hasCTA: z.boolean().default(false),
    hasStory: z.boolean().default(false),
    hasInsight: z.boolean().default(false),
    hasStrongStatement: z.boolean().default(false),
    emotion: z.string().optional(),
    sentiment: z.string().optional(),
  })).default([]),
});

function extractJson(raw: string) {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("A IA não retornou a transcrição estruturada esperada.");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function readText(response: any) {
  if (typeof response?.text === "function") return response.text();
  if (typeof response?.text === "string") return response.text;
  return (response?.candidates?.[0]?.content?.parts ?? [])
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n");
}

function normalizeTranscript(raw: z.infer<typeof transcriptSchema>, durationSec: number) {
  const segments: TranscriptSegment[] = raw.segments
    .filter((segment) => segment.text.trim() && segment.end > segment.start)
    .map((segment, index) => ({
      id: segment.id || `seg-${index + 1}-${nanoid(5)}`,
      start: Math.max(0, Math.min(durationSec, segment.start)),
      end: Math.max(0, Math.min(durationSec, segment.end)),
      text: segment.text.trim(),
      speakerId: segment.speakerId,
      confidence: segment.confidence,
      words: segment.words,
    }))
    .filter((segment) => segment.end > segment.start)
    .sort((a, b) => a.start - b.start);

  if (!segments.length) {
    throw new Error("A IA não encontrou segmentos de fala no vídeo.");
  }

  const participants: Participant[] = raw.participants.length
    ? raw.participants
    : Array.from(new Set(segments.map((segment) => segment.speakerId).filter(Boolean))).map((id) => ({
        id: id as string,
        label: id === "p1" ? "Participante 1" : id === "p2" ? "Participante 2" : String(id),
      }));

  return { language: raw.language || "pt-BR", segments, participants, semanticHints: raw.semanticHints };
}

export async function transcribeVideoStructured(params: {
  audioPath: string;
  title: string;
  durationSec: number;
}) {
  const env = getServerEnv();
  const client = new GoogleGenAI({ apiKey: requireGeminiApiKey() }) as any;
  let uploadedFile: any = null;

  try {
    uploadedFile = await client.files.upload({
      file: params.audioPath,
      config: { mimeType: "audio/wav", displayName: "leste-cuts-audio" },
    });
    const activeFile = await waitForGeminiFileActive(client, uploadedFile);
    const fileUri = activeFile?.uri ?? activeFile?.file?.uri;
    const mimeType = activeFile?.mimeType ?? activeFile?.mime_type ?? "audio/wav";

    if (!fileUri) {
      throw new Error("O Gemini não retornou a URI do áudio.");
    }

    const response = await client.models.generateContent({
      model: env.geminiAudioUnderstandingModel,
      contents: [{
        role: "user",
        parts: [
          { text: buildVideoTranscriptionPrompt({ title: params.title, durationSec: params.durationSec }) },
          { fileData: { fileUri, mimeType } },
        ],
      }],
      config: { responseMimeType: "application/json" },
    });

    const parsed = transcriptSchema.safeParse(extractJson(readText(response)));
    if (!parsed.success) {
      throw new Error("A IA retornou uma transcrição com estrutura inválida.");
    }

    return normalizeTranscript(parsed.data, params.durationSec);
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    throw new Error(`Falha ao transcrever o vídeo. ${message}`);
  } finally {
    await deleteGeminiRemoteFile(client, uploadedFile);
  }
}
