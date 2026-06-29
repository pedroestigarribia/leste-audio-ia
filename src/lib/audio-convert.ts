import "server-only";

import { existsSync, promises as fs } from "fs";
import path from "path";

import { execa } from "execa";
import ffmpegStatic from "ffmpeg-static";
import { nanoid } from "nanoid";

import { cleanupFiles, ensureTempDir } from "@/lib/temp-files";

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
      failures.push(`FFmpeg nao encontrado em ${candidate}.`);
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
    `Nao foi possivel executar o FFmpeg. Verifique ffmpeg-static, FFMPEG_BIN ou a instalacao do FFmpeg no sistema. ${failures.join(" | ")}`.trim(),
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

export async function convertWavBufferToMp3(input: Buffer): Promise<Buffer> {
  const tempDir = await ensureTempDir();
  const id = nanoid();
  const inputPath = path.join(tempDir, `${id}-speech.wav`);
  const outputPath = path.join(tempDir, `${id}-speech.mp3`);
  const args = ["-y", "-i", inputPath, "-codec:a", "libmp3lame", "-b:a", "128k", outputPath];

  await fs.writeFile(inputPath, input);

  try {
    await runFfmpegWithFallback(args);
    return await fs.readFile(outputPath);
  } finally {
    await cleanupFiles([inputPath, outputPath]);
  }
}
