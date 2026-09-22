import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { runTextTask } from "@/lib/text-ai";
import { buildAskFilesPrompt } from "@/prompts/askFiles";
import type { AskFilesAnswer, SourceReference } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chunkSchema = z.object({ chunkId: z.string().min(1), text: z.string().min(1).max(12000), speakerLabel: z.string().max(80).optional(), startSeconds: z.number().min(0).optional(), endSeconds: z.number().min(0).optional() });
const bodySchema = z.object({
  question: z.string().trim().min(2).max(4000),
  sources: z.array(z.object({ sourceId: z.string().min(1), sourceName: z.string().min(1).max(200), sourceType: z.string().min(1).max(50), chunks: z.array(chunkSchema).min(1).max(50) })).min(1).max(30),
});

function parseAnswer(raw: string, sources: z.infer<typeof bodySchema>["sources"]): AskFilesAnswer {
  const candidate = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Partial<AskFilesAnswer>;
  const validChunks = new Map<string, { sourceName: string; chunk: z.infer<typeof chunkSchema> }>();
  for (const source of sources) for (const chunk of source.chunks) validChunks.set(`${source.sourceId}:${chunk.chunkId}`, { sourceName: source.sourceName, chunk });
  const references: SourceReference[] = (candidate.references ?? []).flatMap((reference) => {
    const match = validChunks.get(`${reference.sourceId}:${reference.chunkId}`);
    if (!match) return [];
    return [{ sourceId: reference.sourceId, chunkId: reference.chunkId, sourceName: match.sourceName, quote: normalizePlainText(reference.quote ?? match.chunk.text).slice(0, 500), speakerLabel: match.chunk.speakerLabel, startSeconds: match.chunk.startSeconds, endSeconds: match.chunk.endSeconds }];
  });
  return {
    answer: normalizePlainText(candidate.answer ?? "Não foi possível formular uma resposta com as fontes selecionadas."),
    facts: (candidate.facts ?? []).map(normalizePlainText).filter(Boolean).slice(0, 20),
    inferences: (candidate.inferences ?? []).map(normalizePlainText).filter(Boolean).slice(0, 20),
    notFound: (candidate.notFound ?? []).map(normalizePlainText).filter(Boolean).slice(0, 20),
    references,
  };
}

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
    const { system, prompt } = buildAskFilesPrompt(parsed.data.question, parsed.data.sources);
    const result = await runTextTask({ system, prompt, temperature: 0.1 });
    return NextResponse.json({ ok: true, result: parseAnswer(result, parsed.data.sources) });
  } catch (error) {
    const message = error instanceof MissingApiKeyError ? getDeepSeekMissingKeyMessage() : error instanceof Error ? error.message : "Falha ao responder sobre os arquivos.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
