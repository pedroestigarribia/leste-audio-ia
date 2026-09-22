import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { runTextTask } from "@/lib/text-ai";
import { buildOrganizeSequencePrompt } from "@/prompts/organizeSequence";
import type { ContinuityPlan } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  items: z
    .array(z.object({ id: z.string().min(1), name: z.string().min(1), transcription: z.string().min(1).max(50000) }))
    .min(1)
    .max(30),
});

function parsePlan(raw: string, itemIds: string[]): ContinuityPlan {
  const candidate = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
    groups?: Array<{ id?: string; title?: string; itemIds?: string[]; explanation?: string; confidence?: number }>;
    warnings?: string[];
  };
  const remaining = new Set(itemIds);
  const groups = (candidate.groups ?? []).flatMap((group, index) => {
    const validIds = (group.itemIds ?? []).filter((id) => remaining.delete(id));
    if (!validIds.length) return [];
    return [{
      id: `grupo-${index + 1}`,
      title: normalizePlainText(group.title ?? "Grupo sem título") || "Grupo sem título",
      itemIds: validIds,
      explanation: normalizePlainText(group.explanation ?? ""),
      confidence: Math.max(0, Math.min(100, Number(group.confidence) || 0)),
    }];
  });
  for (const id of remaining) {
    groups.push({ id: `grupo-${groups.length + 1}`, title: "Arquivo independente", itemIds: [id], explanation: "Arquivo sem conexão confirmada com os demais.", confidence: 0 });
  }
  return {
    groups,
    warnings: (candidate.warnings ?? []).map((warning) => normalizePlainText(warning)).filter(Boolean).slice(0, 12),
    generatedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
    }
    const { system, prompt } = buildOrganizeSequencePrompt(parsed.data.items);
    const result = await runTextTask({ system, prompt, temperature: 0.1 });
    return NextResponse.json({ ok: true, result: parsePlan(result, parsed.data.items.map((item) => item.id)) });
  } catch (error) {
    const message = error instanceof MissingApiKeyError ? getDeepSeekMissingKeyMessage() : error instanceof Error ? error.message : "Falha ao organizar a sequência.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
