import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  AUDIO_INTELLIGENCE_PROMPT,
  buildTranscriptionIntelligencePrompt,
} from "@/prompts/audioIntelligence";
import { deleteGeminiRemoteFile, waitForGeminiFileActive } from "@/lib/gemini";
import { getServerEnv, requireGeminiApiKey } from "@/lib/env";
import { runTextTask } from "@/lib/text-ai";
import type { AudioIntelligenceResult } from "@/types/audio";

export const audioIntelligenceResultSchema = z.object({
  subject: z.string(),
  context: z.string(),
  language: z.string(),
  primaryIntent: z.string(),
  confidence: z.number().min(0).max(100),
  summary: z.string(),
  topics: z.array(z.string()),
  keyPoints: z.array(z.string()),
  insights: z.array(z.string()),
  tasks: z.array(
    z.object({
      title: z.string(),
      owner: z.string(),
      dueDate: z.string(),
      evidence: z.string(),
    }),
  ),
  decisions: z.array(
    z.object({
      text: z.string(),
      evidence: z.string(),
    }),
  ),
  entities: z.object({
    people: z.array(z.string()),
    companies: z.array(z.string()),
    dates: z.array(z.string()),
    values: z.array(z.string()),
    links: z.array(z.string()),
  }),
  opportunities: z.array(z.string()),
  risks: z.array(z.string()),
  questions: z.array(z.string()),
  suggestedContents: z.array(
    z.object({
      type: z.string(),
      title: z.string(),
      purpose: z.string(),
    }),
  ),
  narrative: z.object({
    title: z.string(),
    premise: z.string(),
    beginning: z.string(),
    middle: z.string(),
    ending: z.string(),
    chapters: z.array(
      z.object({
        title: z.string(),
        synopsis: z.string(),
      }),
    ),
  }),
  diarization: z.object({
    speakers: z.array(z.object({ id: z.string(), label: z.string(), confidence: z.number().optional(), unverified: z.boolean().optional() })).max(12),
    segments: z.array(z.object({ id: z.string(), text: z.string(), startSeconds: z.number().min(0).optional(), endSeconds: z.number().min(0).optional(), speakerId: z.string().optional(), speakerLabel: z.string().optional(), confidence: z.number().optional(), timingApproximate: z.boolean().optional() })).max(600),
  }).optional(),
});

const AUDIO_INTELLIGENCE_RESPONSE_FORMAT = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    context: { type: "string" },
    language: { type: "string" },
    primaryIntent: { type: "string" },
    confidence: { type: "number" },
    summary: { type: "string" },
    topics: { type: "array", items: { type: "string" } },
    keyPoints: { type: "array", items: { type: "string" } },
    insights: { type: "array", items: { type: "string" } },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          owner: { type: "string" },
          dueDate: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["title", "owner", "dueDate", "evidence"],
      },
    },
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["text", "evidence"],
      },
    },
    entities: {
      type: "object",
      additionalProperties: false,
      properties: {
        people: { type: "array", items: { type: "string" } },
        companies: { type: "array", items: { type: "string" } },
        dates: { type: "array", items: { type: "string" } },
        values: { type: "array", items: { type: "string" } },
        links: { type: "array", items: { type: "string" } },
      },
      required: ["people", "companies", "dates", "values", "links"],
    },
    opportunities: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
    suggestedContents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          purpose: { type: "string" },
        },
        required: ["type", "title", "purpose"],
      },
    },
    narrative: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        premise: { type: "string" },
        beginning: { type: "string" },
        middle: { type: "string" },
        ending: { type: "string" },
        chapters: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              synopsis: { type: "string" },
            },
            required: ["title", "synopsis"],
          },
        },
      },
      required: ["title", "premise", "beginning", "middle", "ending", "chapters"],
    },
    diarization: {
      type: "object",
      additionalProperties: false,
      properties: {
        speakers: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, label: { type: "string" }, confidence: { type: "number" }, unverified: { type: "boolean" } }, required: ["id", "label"] } },
        segments: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, text: { type: "string" }, startSeconds: { type: "number" }, endSeconds: { type: "number" }, speakerId: { type: "string" }, speakerLabel: { type: "string" }, confidence: { type: "number" }, timingApproximate: { type: "boolean" } }, required: ["id", "text"] } },
      },
      required: ["speakers", "segments"],
    },
  },
  required: [
    "subject",
    "context",
    "language",
    "primaryIntent",
    "confidence",
    "summary",
    "topics",
    "keyPoints",
    "insights",
    "tasks",
    "decisions",
    "entities",
    "opportunities",
    "risks",
    "questions",
    "suggestedContents",
    "narrative",
  ],
};

function getOutputText(interaction: any): string {
  if (typeof interaction?.outputText === "string") {
    return interaction.outputText;
  }

  if (typeof interaction?.output_text === "string") {
    return interaction.output_text;
  }

  return (interaction?.outputs ?? [])
    .map((output: any) => (typeof output?.text === "string" ? output.text : ""))
    .join("\n");
}

export function parseAudioIntelligenceResult(raw: string): AudioIntelligenceResult {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  const candidate = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;
  const parsed = audioIntelligenceResultSchema.safeParse(JSON.parse(candidate));

  if (!parsed.success) {
    throw new Error("A análise multimodal retornou uma estrutura inválida. Tente novamente.");
  }

  return parsed.data;
}

export async function analyzeTranscriptionWithTextAi(
  transcription: string,
): Promise<AudioIntelligenceResult> {
  const output = await runTextTask({
    system:
      "Você interpreta transcrições em português brasileiro com precisão. Retorne apenas JSON válido e não invente fatos.",
    prompt: buildTranscriptionIntelligencePrompt(transcription),
    temperature: 0.1,
  });

  return parseAudioIntelligenceResult(output);
}

export async function analyzeAudioWithGemini({
  filePath,
  mimeType,
  originalName,
}: {
  filePath: string;
  mimeType: string;
  originalName: string;
}): Promise<AudioIntelligenceResult> {
  const env = getServerEnv();
  const client = new GoogleGenAI({ apiKey: requireGeminiApiKey() }) as any;
  let uploadedFile: any = null;

  try {
    uploadedFile = await client.files.upload({
      file: filePath,
      config: {
        mimeType,
        displayName: originalName,
      },
    });

    const activeFile = await waitForGeminiFileActive(client, uploadedFile);
    const uri = activeFile?.uri ?? activeFile?.file?.uri;
    const activeMimeType = activeFile?.mimeType ?? activeFile?.mime_type ?? mimeType;

    if (!uri) {
      throw new Error("O Gemini não retornou a URI do arquivo para análise.");
    }

    const interaction = await client.interactions.create({
      model: env.geminiAudioUnderstandingModel,
      // Interactions stores data by default. This session must not be retained.
      store: false,
      input: [
        { type: "text", text: AUDIO_INTELLIGENCE_PROMPT },
        {
          type: activeMimeType.startsWith("video/") ? "video" : "audio",
          uri,
          mime_type: activeMimeType,
        },
      ],
      response_format: AUDIO_INTELLIGENCE_RESPONSE_FORMAT,
    });

    const output = getOutputText(interaction);

    if (!output.trim()) {
      throw new Error("O Gemini não retornou conteúdo para a análise multimodal.");
    }

    return parseAudioIntelligenceResult(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    throw new Error(`Falha ao analisar o áudio com Gemini. ${message}`);
  } finally {
    await deleteGeminiRemoteFile(client, uploadedFile);
  }
}
