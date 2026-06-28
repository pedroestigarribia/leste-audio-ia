import "server-only";

import path from "path";

import { execa } from "execa";
import ffmpegStatic from "ffmpeg-static";

async function runFfmpeg(binaryPath: string, args: string[]) {
  await execa(binaryPath, args, {
    windowsHide: true,
  });
}

export async function convertToWav(inputPath: string): Promise<string> {
  const inputFilePath = path.resolve(inputPath);
  const parsedPath = path.parse(inputFilePath);
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}-converted.wav`);
  const args = ["-y", "-i", inputFilePath, "-ac", "1", "-ar", "16000", outputPath];

  const failures: string[] = [];

  if (ffmpegStatic) {
    try {
      await runFfmpeg(ffmpegStatic, args);
      return outputPath;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Falha no ffmpeg-static.");
    }
  }

  try {
    await runFfmpeg("ffmpeg", args);
    return outputPath;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "Falha no FFmpeg do sistema.");
  }

  throw new Error(
    `Nao foi possivel converter o audio com FFmpeg. Verifique ffmpeg-static ou a instalacao do FFmpeg no sistema. ${failures.join(" | ")}`.trim(),
  );
}
