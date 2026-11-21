import "server-only";

import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "@derhuerst/ffprobe-static";
import path from "node:path";

import { getServerEnv } from "@/lib/env";
import { runCommand } from "@/lib/run-command";

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function describeFfmpegFailure(error: unknown) {
  const failure = error && typeof error === "object" ? error as { code?: string | number; signal?: string; stderr?: string } : {};
  const detail = failure.stderr ?? "";
  if (failure.code === "ENOENT") return "executável não encontrado";
  if (failure.signal) return `processo interrompido (${failure.signal})`;
  if (/resource temporarily unavailable|cannot allocate memory|out of memory|pthread_create/i.test(detail)) return "recursos insuficientes para processar o vídeo";
  if (/no space left on device/i.test(detail)) return "armazenamento temporário cheio";
  if (/permission denied/i.test(detail)) return "permissão insuficiente para processar o arquivo";
  if (/no such filter/i.test(detail)) return "filtro de vídeo indisponível neste FFmpeg";
  if (/error while opening encoder|error initializing output stream/i.test(detail)) return "o codificador de vídeo não pôde ser iniciado";
  if (/invalid data found/i.test(detail)) return "arquivo de mídia inválido ou não suportado";
  return typeof failure.code === "number" ? `FFmpeg encerrou com código ${failure.code}` : "falha ao processar a mídia";
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
    ffprobeStatic || undefined,
    path.join(process.cwd(), "node_modules", "@derhuerst", "ffprobe-static", executableName),
    "ffprobe",
  ]);
}

export async function runFfmpeg(args: string[], signal?: AbortSignal) {
  const failures: string[] = [];

  for (const executable of getFfmpegCandidates()) {
    try {
      await runCommand(executable, args, {
        signal,
        timeout: getServerEnv().processTimeoutMs,
      });
      return;
    } catch (error) {
      failures.push(describeFfmpegFailure(error));
    }
  }

  throw new Error(
    `Não foi possível processar o vídeo com FFmpeg: ${unique(failures).join("; ")}.`,
  );
}

export async function runFfmpegWithOutput(args: string[], signal?: AbortSignal) {
  const failures: string[] = [];

  for (const executable of getFfmpegCandidates()) {
    try {
      return await runCommand(executable, args, {
        signal,
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
      const result = await runCommand(executable, args, {
        signal,
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
