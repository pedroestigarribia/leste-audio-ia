import "server-only";

import { GoogleGenAI } from "@google/genai";

import { MissingApiKeyError, getServerEnv, requireGeminiApiKey } from "@/lib/env";
import { waitForGeminiFileActive } from "@/lib/gemini";
import { buildYoutubeTranscriptionPrompt } from "@/prompts/youtubeTranscription";
import type { YoutubeGeminiResult, YoutubeParticipant, YoutubeSegment } from "@/types/youtube";

type AnalyzeYoutubeParams = {
  audioPath: string;
  audioMimeType: string;
  videoPath: string | null;
  videoMimeType: string;
  title: string;
  channel: string;
  cutStart: number | null;
  cutEnd: number | null;
};

type UploadedGeminiFile = {
  name?: string;
  uri?: string;
  mimeType?: string;
};

function extractJsonFromResponse(response: any): unknown {
  if (!response) {
    throw new Error("O Gemini não retornou resposta.");
  }

  let text = "";

  if (typeof response.text === "function") {
    text = response.text();
  } else if (typeof response.text === "string") {
    text = response.text;
  } else {
    const parts = response.candidates?.flatMap(
      (candidate: any) => candidate.content?.parts ?? [],
    ) ?? [];
    text = parts
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (!text) {
    throw new Error("O Gemini não retornou conteúdo de texto.");
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return JSON.parse(text);
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeParticipants(
  raw: unknown,
  segments: YoutubeSegment[],
): YoutubeParticipant[] {
  const rawList = Array.isArray(raw) ? raw : [];
  const segmentCounts = new Map<string, { count: number; total: number }>();

  for (const seg of segments) {
    const key = seg.participant;
    const entry = segmentCounts.get(key) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += Math.max(0, seg.endTime - seg.startTime);
    segmentCounts.set(key, entry);
  }

  if (rawList.length === 0) {
    const labels = Array.from(segmentCounts.keys());
    return labels.map((label, index) => ({
      id: `p${index + 1}`,
      label,
      name: undefined,
      segmentsCount: segmentCounts.get(label)?.count ?? 0,
      totalTime: segmentCounts.get(label)?.total ?? 0,
      evidence: undefined,
    }));
  }

  return rawList.map((entry: any, index: number) => {
    const label = asString(entry?.label ?? entry?.name, `Participante ${index + 1}`);
    const name = asString(entry?.name, "");
    const stats = segmentCounts.get(label) ?? { count: 0, total: 0 };

    return {
      id: `p${index + 1}`,
      label,
      name: name && name !== label ? name : undefined,
      segmentsCount: stats.count,
      totalTime: stats.total,
      evidence: asString(entry?.evidence) || undefined,
    };
  });
}

function normalizeGeminiResult(raw: unknown): YoutubeGeminiResult {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const rawSegments = Array.isArray(obj.segments) ? obj.segments : [];
  const segments: YoutubeSegment[] = rawSegments.map((entry: any) => ({
    startTime: asNumber(entry?.startTime ?? entry?.start, 0),
    endTime: asNumber(entry?.endTime ?? entry?.end, 0),
    participant: asString(entry?.participant ?? entry?.speaker, "Participante 1"),
    text: asString(entry?.text ?? entry?.transcript),
    tone: asString(entry?.tone ?? entry?.toneDescription),
    confidence: Math.max(0, Math.min(1, asNumber(entry?.confidence, 0.7))),
  }));

  const participants = normalizeParticipants(obj.participants, segments);

  return {
    language: asString(obj.language, "pt-BR"),
    segments,
    participants,
    sceneNotes: asString(obj.sceneNotes ?? obj.scenes),
    toneChanges: asString(obj.toneChanges ?? obj.tone_changes),
  };
}

async function deleteGeminiRemoteFile(client: any, uploadedFile: UploadedGeminiFile | null) {
  if (!uploadedFile?.name || !client?.files?.delete) {
    return;
  }

  try {
    await client.files.delete({ name: uploadedFile.name });
  } catch {
    try {
      await client.files.delete(uploadedFile.name);
    } catch {
      return;
    }
  }
}

async function uploadFile(
  client: any,
  filePath: string,
  mimeType: string,
  displayName: string,
): Promise<UploadedGeminiFile | null> {
  try {
    const uploaded = await client.files.upload({
      file: filePath,
      config: { mimeType, displayName },
    });
    return uploaded;
  } catch {
    return null;
  }
}

export async function analyzeYoutubeWithGemini(
  params: AnalyzeYoutubeParams,
): Promise<YoutubeGeminiResult> {
  const env = getServerEnv();
  const apiKey = requireGeminiApiKey();
  const client = new GoogleGenAI({ apiKey }) as any;

  let audioFile: UploadedGeminiFile | null = null;
  let videoFile: UploadedGeminiFile | null = null;

  try {
    if (!client?.files?.upload) {
      throw new Error("A versão instalada de @google/genai não expõe a Files API.");
    }

    const uploadedAudioFile = await uploadFile(
      client,
      params.audioPath,
      params.audioMimeType,
      "youtube-audio",
    );

    audioFile = uploadedAudioFile
      ? await waitForGeminiFileActive(client, uploadedAudioFile)
      : null;

    if (!audioFile?.uri) {
      throw new Error("O upload do áudio para o Gemini falhou.");
    }

    if (params.videoPath) {
      const uploadedVideoFile = await uploadFile(
        client,
        params.videoPath,
        params.videoMimeType,
        "youtube-video",
      );
      videoFile = uploadedVideoFile
        ? await waitForGeminiFileActive(client, uploadedVideoFile)
        : null;
    }

    const prompt = buildYoutubeTranscriptionPrompt({
      title: params.title,
      channel: params.channel,
      cutStart: params.cutStart,
      cutEnd: params.cutEnd,
      hasVideo: Boolean(videoFile?.uri),
    });

    const parts: any[] = [{ text: prompt }];

    parts.push({
      fileData: {
        fileUri: audioFile.uri,
        mimeType: audioFile.mimeType ?? params.audioMimeType,
      },
    });

    if (videoFile?.uri) {
      parts.push({
        fileData: {
          fileUri: videoFile.uri,
          mimeType: videoFile.mimeType ?? params.videoMimeType,
        },
      });
    }

    const response = await client.models.generateContent({
      model: env.geminiModel,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const raw = extractJsonFromResponse(response);
    const result = normalizeGeminiResult(raw);

    if (!result.segments.length) {
      throw new Error("O Gemini não retornou segmentos de transcrição.");
    }

    return result;
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    throw new Error(`Falha ao analisar o vídeo com Gemini. ${message}`);
  } finally {
    await deleteGeminiRemoteFile(client, audioFile);
    await deleteGeminiRemoteFile(client, videoFile);
  }
}
