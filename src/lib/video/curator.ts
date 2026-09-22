import "server-only";

import { nanoid } from "nanoid";
import { z } from "zod";

import { runTextTask } from "@/lib/text-ai";
import { buildClipCuratorPrompt } from "@/prompts/clipCurator";
import type { ClipCandidate, ClipPreferences, RetentionBreakdown, SemanticSegment, VideoMetadata } from "@/types/video";

const breakdownSchema = z.object({
  hook: z.number().min(0).max(100).default(0),
  narrativeFlow: z.number().min(0).max(100).default(0),
  standaloneClarity: z.number().min(0).max(100).default(0),
  practicalValue: z.number().min(0).max(100).default(0),
  emotionalStrength: z.number().min(0).max(100).default(0),
  memorableStatement: z.number().min(0).max(100).default(0),
  endingQuality: z.number().min(0).max(100).default(0),
  transcriptQuality: z.number().min(0).max(100).default(0),
});

const candidateSchema = z.object({
  id: z.string().optional(),
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  duration: z.number().nonnegative().optional(),
  title: z.string().default("Corte sugerido"),
  hook: z.string().default(""),
  summary: z.string().default(""),
  category: z.string().default("Geral"),
  topic: z.string().default(""),
  retentionScore: z.number().min(0).max(100).optional(),
  retentionBreakdown: breakdownSchema.default({}),
  reason: z.string().default(""),
  suggestedCaption: z.string().default(""),
  suggestedCopy: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
  participants: z.array(z.string()).default([]),
  transcriptExcerpt: z.string().default(""),
  sceneIds: z.array(z.string()).default([]),
  hasCTA: z.boolean().default(false),
  hasQuestion: z.boolean().default(false),
  hasStory: z.boolean().default(false),
  hasInsight: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(100).default(60),
});

function parseCandidates(raw: string) {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end <= start) {
    throw new Error("A IA não retornou sugestões de cortes válidas.");
  }
  const parsed = z.array(candidateSchema).safeParse(JSON.parse(trimmed.slice(start, end + 1)));
  if (!parsed.success) {
    throw new Error("As sugestões de cortes vieram com estrutura inválida.");
  }
  return parsed.data;
}

function scoreBreakdown(breakdown: RetentionBreakdown) {
  return breakdown.hook * 0.2 + breakdown.narrativeFlow * 0.15 + breakdown.standaloneClarity * 0.15 + breakdown.practicalValue * 0.15 + breakdown.emotionalStrength * 0.1 + breakdown.memorableStatement * 0.1 + breakdown.endingQuality * 0.1 + breakdown.transcriptQuality * 0.05;
}

function overlapRatio(a: ClipCandidate, b: ClipCandidate) {
  const overlap = Math.max(0, Math.min(a.endTime, b.endTime) - Math.max(a.startTime, b.startTime));
  return overlap / Math.min(a.duration, b.duration);
}

function buildFallbackCandidates(segments: SemanticSegment[], preferences: ClipPreferences) {
  const max = preferences.maxDurationSec ?? 90;
  const min = preferences.minDurationSec ?? 30;
  const sourceDuration = Math.max(...segments.map((segment) => segment.end), 0);
  const effectiveMin = sourceDuration > 0 && sourceDuration < min ? 1 : Math.max(5, min * 0.5);
  const candidates: ClipCandidate[] = [];

  for (const segment of segments) {
    const duration = segment.end - segment.start;
    if (duration < effectiveMin || duration > max * 1.5) continue;
    const queryTerms = (preferences.query ?? "")
      .toLocaleLowerCase("pt-BR")
      .split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter((term) => term.length > 2);
    const queryMatches = queryTerms.filter((term) => segment.transcript.toLocaleLowerCase("pt-BR").includes(term)).length;
    if (preferences.mode === "find" && queryTerms.length && queryMatches === 0) continue;
    const breakdown: RetentionBreakdown = {
      hook: queryMatches ? 90 : segment.hasStrongStatement ? 80 : 55,
      narrativeFlow: segment.hasStory || segment.hasAnswer ? 75 : 55,
      standaloneClarity: segment.hasAnswer || segment.hasInsight ? 75 : 55,
      practicalValue: segment.hasInsight ? 80 : 55,
      emotionalStrength: segment.emotion ? 65 : 45,
      memorableStatement: segment.hasStrongStatement ? 80 : 50,
      endingQuality: segment.hasCTA || segment.hasAnswer ? 70 : 50,
      transcriptQuality: 75,
    };
    candidates.push({
      id: `candidate-${nanoid(8)}`,
      startTime: segment.start,
      endTime: segment.end,
      duration,
      title: segment.topic || "Momento destacado",
      hook: segment.transcript.slice(0, 120),
      summary: segment.transcript,
      category: preferences.genre === "Auto" ? "Geral" : preferences.genre,
      topic: segment.topic,
      retentionScore: Math.round(scoreBreakdown(breakdown)),
      retentionBreakdown: breakdown,
      reason: queryMatches ? "Trecho encontrado por corresponder ao pedido semântico informado." : "Trecho selecionado por conter uma unidade de fala identificável.",
      suggestedCaption: segment.transcript.slice(0, 140),
      suggestedCopy: segment.transcript,
      hashtags: [],
      participants: segment.speakers,
      transcriptExcerpt: segment.transcript,
      sceneIds: segment.sceneIds,
      hasCTA: segment.hasCTA,
      hasQuestion: segment.hasQuestion,
      hasStory: segment.hasStory,
      hasInsight: segment.hasInsight,
      warnings: ["Sugestão gerada por fallback; revise o início e o fim."],
      confidence: 45,
    });
  }

  return candidates;
}

export async function generateClipCandidates(params: {
  metadata: VideoMetadata;
  segments: SemanticSegment[];
  preferences: ClipPreferences;
}) {
  let candidates: ClipCandidate[] = [];

  try {
    const raw = await runTextTask({
      system: "Você é um curador de cortes de vídeo. Retorne somente JSON válido e não invente fatos.",
      prompt: buildClipCuratorPrompt(params),
      temperature: 0.2,
    });
    candidates = parseCandidates(raw).map((candidate) => ({
      ...candidate,
      id: candidate.id || `candidate-${nanoid(8)}`,
      duration: Math.max(0, candidate.endTime - candidate.startTime),
      retentionScore: Math.round(scoreBreakdown(candidate.retentionBreakdown)),
    }));
  } catch {
    candidates = buildFallbackCandidates(params.segments, params.preferences);
  }

  const maxDuration = params.preferences.maxDurationSec ?? 180;
  const normalized = candidates
    .map((candidate) => ({
      ...candidate,
      startTime: Math.max(0, Math.min(params.metadata.durationSec, candidate.startTime)),
      endTime: Math.max(0, Math.min(params.metadata.durationSec, candidate.endTime)),
    }))
    .map((candidate) => ({ ...candidate, duration: Math.max(0, candidate.endTime - candidate.startTime) }))
    .filter((candidate) => candidate.duration >= (params.metadata.durationSec < 10 ? 1 : 5) && candidate.duration <= maxDuration)
    .sort((a, b) => b.retentionScore - a.retentionScore);

  const diverse: ClipCandidate[] = [];
  for (const candidate of normalized) {
    if (diverse.some((selected) => overlapRatio(candidate, selected) > 0.75)) continue;
    diverse.push(candidate);
    if (diverse.length >= (params.preferences.desiredCount ?? 8)) break;
  }

  if (!diverse.length) {
    throw new Error("Não foi possível encontrar trechos adequados para corte.");
  }

  return diverse;
}

export function buildSemanticSegments(
  transcript: Awaited<ReturnType<typeof import("@/lib/video/transcript")["transcribeVideoStructured"]>>,
  sceneMarkers: number[] = [0],
) {
  const hints = new Map(transcript.semanticHints.map((hint) => [hint.segmentId, hint]));
  return transcript.segments.map((segment, index) => {
    const hint = hints.get(segment.id);
    return {
      id: segment.id,
      start: segment.start,
      end: segment.end,
      transcript: segment.text,
      speakers: segment.speakerId ? [segment.speakerId] : [],
      topic: hint?.topic || "",
      subtopics: hint?.subtopics || [],
      sceneIds: [`scene-${Math.max(0, sceneMarkers.filter((marker) => marker <= segment.start).length - 1) + 1}`],
      sentiment: hint?.sentiment,
      emotion: hint?.emotion,
      hasQuestion: hint?.hasQuestion ?? /\?/.test(segment.text),
      hasAnswer: hint?.hasAnswer ?? false,
      hasCTA: hint?.hasCTA ?? false,
      hasStory: hint?.hasStory ?? false,
      hasInsight: hint?.hasInsight ?? false,
      hasStrongStatement: hint?.hasStrongStatement ?? false,
      semanticStartConfidence: segment.confidence ?? 0.6,
      semanticEndConfidence: segment.confidence ?? 0.6,
    } satisfies SemanticSegment;
  });
}
