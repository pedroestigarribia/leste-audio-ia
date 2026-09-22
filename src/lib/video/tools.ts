import "server-only";

import { execa } from "execa";
import ffmpegStatic from "ffmpeg-static";
import path from "node:path";

import { getServerEnv } from "@/lib/env";

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getFfmpegCandidates() {
  const executableName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return unique([
    getServerEnv().ffmpegBin,
    ffmpegStatic || undefined,
    path.join(process.cwd(), "node_modules", "ffmpeg-static", executableName),
    "ffmpeg",
  ]);
}

function getFfprobeCandidates() {
  const executableName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  return unique([
    getServerEnv().ffprobeBin,
    path.join(process.cwd(), "node_modules", "ffprobe-static", "bin", executableName),
    "ffprobe",
  ]);
}

export async function runFfmpeg(args: string[], signal?: AbortSignal) {
  const failures: string[] = [];

  for (const executable of getFfmpegCandidates()) {
    try {
      await execa(executable, args, {
        windowsHide: true,
        cancelSignal: signal,
        timeout: getServerEnv().processTimeoutMs,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao executar FFmpeg.";
      failures.push(message.slice(0, 240));
    }
  }

  throw new Error(
    `Não foi possível executar o FFmpeg. Configure FFMPEG_BIN ou instale FFmpeg no sistema. ${failures.join(" | ")}`,
  );
}

export async function runFfmpegWithOutput(args: string[], signal?: AbortSignal) {
  const failures: string[] = [];

  for (const executable of getFfmpegCandidates()) {
    try {
      return await execa(executable, args, {
        windowsHide: true,
        cancelSignal: signal,
        timeout: getServerEnv().processTimeoutMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao executar FFmpeg.";
      failures.push(message.slice(0, 240));
    }
  }

  throw new Error(`Não foi possível executar o FFmpeg. ${failures.join(" | ")}`);
}

export async function runFfprobe(args: string[], signal?: AbortSignal) {
  const failures: string[] = [];

  for (const executable of getFfprobeCandidates()) {
    try {
      const result = await execa(executable, args, {
        windowsHide: true,
        cancelSignal: signal,
        timeout: getServerEnv().processTimeoutMs,
      });
      return result.stdout;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao executar FFprobe.";
      failures.push(message.slice(0, 240));
    }
  }

  throw new Error(
    `Não foi possível executar o FFprobe. Configure FFPROBE_BIN ou instale FFprobe no sistema. ${failures.join(" | ")}`,
  );
}

export function escapeSubtitlePath(filePath: string) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}
