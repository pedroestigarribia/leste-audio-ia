import "server-only";

import { existsSync } from "fs";
import path from "path";

import { execa } from "execa";
import ffmpegStatic from "ffmpeg-static";

async function runFfmpeg(binaryPath: string, args: string[]) {
  await execa(binaryPath, args, {
    windowsHide: true,
  });
}

function getStaticFfmpegCandidates() {
  const executableName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const candidates = [
    process.env.FFMPEG_BIN,
    ffmpegStatic || undefined,
    path.join(process.cwd(), "node_modules", "ffmpeg-static", executableName),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return Array.from(new Set(candidates));
}

async function runFfmpegWithFallback(args: string[]) {
  const failures: string[] = [];

  for (const candidate of getStaticFfmpegCandidates()) {
    if (!existsSync(candidate)) {
      failures.push(`FFmpeg não encontrado em ${candidate}.`);
      continue;
    }

    try {
      await runFfmpeg(candidate, args);
      return;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Falha no ffmpeg-static.");
    }
  }

  try {
    await runFfmpeg("ffmpeg", args);
    return;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "Falha no FFmpeg do sistema.");
  }

  throw new Error(
    `Não foi possível executar o FFmpeg. Verifique ffmpeg-static, FFMPEG_BIN ou a instalação do FFmpeg no sistema. ${failures.join(" | ")}`.trim(),
  );
}

export async function convertToWav(inputPath: string): Promise<string> {
  const inputFilePath = path.resolve(inputPath);
  const parsedPath = path.parse(inputFilePath);
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}-converted.wav`);
  const args = ["-y", "-i", inputFilePath, "-ac", "1", "-ar", "16000", outputPath];

  await runFfmpegWithFallback(args);
  return outputPath;
}

/**
 * Produces a compact speech-focused track for Gemini's inline request limit.
 * It also removes video streams from MP4/WebM uploads.
 */
export async function convertToInlineOpus(inputPath: string): Promise<string> {
  const inputFilePath = path.resolve(inputPath);
  const parsedPath = path.parse(inputFilePath);
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}-inline.opus`);
  const args = [
    "-y",
    "-i",
    inputFilePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libopus",
    "-b:a",
    "24k",
    outputPath,
  ];

  await runFfmpegWithFallback(args);
  return outputPath;
}
