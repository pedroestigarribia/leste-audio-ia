import { z } from "zod";

import type { ClipPreferences } from "@/types/video";

export const clipPreferencesSchema = z.object({
  mode: z.enum(["discover", "find"]).default("discover"),
  query: z.string().trim().max(500).optional(),
  genre: z.string().trim().min(1).max(80).default("Auto"),
  durationPreset: z.enum(["30", "30-60", "60-90", "90-180", "custom"]).default("30-60"),
  minDurationSec: z.number().int().min(5).max(3_600).optional(),
  maxDurationSec: z.number().int().min(5).max(3_600).optional(),
  desiredCount: z.number().int().min(1).max(20).default(8),
}).superRefine((value, context) => {
  if (value.mode === "find" && !value.query) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["query"], message: "Descreva o momento que você quer encontrar." });
  }
  if (value.minDurationSec && value.maxDurationSec && value.minDurationSec > value.maxDurationSec) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["maxDurationSec"], message: "A duração máxima precisa ser maior que a mínima." });
  }
});

export function normalizeClipPreferences(input: unknown): ClipPreferences {
  const parsed = clipPreferencesSchema.parse(input);
  if (parsed.durationPreset !== "custom") {
    const presetBounds: Record<Exclude<ClipPreferences["durationPreset"], "custom">, [number, number]> = {
      "30": [15, 45],
      "30-60": [30, 60],
      "60-90": [60, 90],
      "90-180": [90, 180],
    };
    const [minDurationSec, maxDurationSec] = presetBounds[parsed.durationPreset];
    return { ...parsed, minDurationSec, maxDurationSec };
  }

  return {
    ...parsed,
    minDurationSec: parsed.minDurationSec ?? 15,
    maxDurationSec: parsed.maxDurationSec ?? 180,
  };
}

export function parseJsonObject(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("As preferências de corte não estão em um JSON válido.");
  }
}
