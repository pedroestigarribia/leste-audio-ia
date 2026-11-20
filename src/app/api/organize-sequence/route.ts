import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getTextAIMissingKeyMessage } from "@/lib/env";
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
  includeDescriptions: z.boolean().optional().default(false),
}).superRefine(({ items }, context) => {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "IDs de arquivo duplicados.", path: ["items"] });
  }
});

const responseSchema = z.object({
  groups: z.array(z.object({
    title: z.string().nullish(),
    itemIds: z.array(z.string()).nullish(),
    explanation: z.string().nullish(),
    confidence: z.unknown().optional(),
  })).nullish(),
  warnings: z.array(z.string()).nullish(),
  descriptions: z.unknown().optional(),
});

function parsePlan(raw: string, itemIds: string[]): { plan: ContinuityPlan; descriptions?: unknown } {
  const candidate = responseSchema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")));
  const remaining = new Set(itemIds);
  const known = new Set(itemIds);
  let duplicate = false;
  let unknown = false;
  const groups = (candidate.groups ?? []).flatMap((group, index) => {
    const validIds = (group.itemIds ?? []).filter((id) => {
      if (!known.has(id)) {
        unknown = true;
        return false;
      }
      if (!remaining.delete(id)) {
        duplicate = true;
        return false;
      }
      return true;
    });
    if (!validIds.length) return [];
    return [{
      id: `grupo-${index + 1}`,
      title: normalizePlainText(group.title ?? "Grupo sem título") || "Grupo sem título",
      itemIds: validIds,
      explanation: normalizePlainText(group.explanation ?? ""),
      confidence: Math.max(0, Math.min(100, Number(group.confidence) || 0)),
    }];
  });
  const missing = remaining.size > 0;
  for (const id of remaining) {
    groups.push({ id: `grupo-${groups.length + 1}`, title: "Arquivo independente", itemIds: [id], explanation: "Arquivo sem conexão confirmada com os demais.", confidence: 0 });
  }
  return {
    plan: {
      groups: groups.map((group, index) => ({ ...group, id: `grupo-${index + 1}` })),
      warnings: [
        ...(candidate.warnings ?? []).map((warning) => normalizePlainText(warning)).filter(Boolean),
        ...(duplicate ? ["IDs duplicados na resposta; repetições ignoradas."] : []),
        ...(unknown ? ["IDs desconhecidos na resposta; valores ignorados."] : []),
        ...(missing ? ["IDs ausentes na resposta foram preservados como arquivos independentes."] : []),
      ],
      generatedAt: new Date().toISOString(),
    },
    descriptions: candidate.descriptions,
  };
}

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
    }
    const { system, prompt } = buildOrganizeSequencePrompt(parsed.data.items, parsed.data.includeDescriptions);
    const result = await runTextTask({ system, prompt, temperature: 0.1, signal: request.signal });
    const parsedResult = parsePlan(result, parsed.data.items.map((item) => item.id));
    return NextResponse.json({
      ok: true,
      result: parsedResult.plan,
      ...(parsed.data.includeDescriptions ? { descriptions: parsedResult.descriptions ?? [] } : {}),
    });
  } catch (error) {
    const message = error instanceof MissingApiKeyError ? getTextAIMissingKeyMessage() : error instanceof Error ? error.message : "Falha ao organizar a sequência.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
