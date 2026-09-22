import "server-only";

import { runFfmpegWithOutput } from "@/lib/video/tools";

export async function detectSceneChanges(filePath: string, durationSec: number, signal?: AbortSignal) {
  try {
    const result = await runFfmpegWithOutput([
      "-hide_banner",
      "-i",
      filePath,
      "-vf",
      "select=gt(scene\\,0.35),showinfo",
      "-an",
      "-f",
      "null",
      "-",
    ], signal);
    const markers = Array.from(result.stderr.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g))
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value) && value > 0 && value < durationSec);
    return Array.from(new Set([0, ...markers])).sort((a, b) => a - b);
  } catch {
    return [0];
  }
}
