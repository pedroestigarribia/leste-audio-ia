import "server-only";

import { promises as fs } from "fs";
import path from "path";

import { execa } from "execa";
import ffmpegStatic from "ffmpeg-static";
import ytdl from "@distube/ytdl-core";

import { ensureTempDir, sanitizeFileName } from "@/lib/temp-files";
import { buildYoutubeWatchUrl } from "@/lib/youtube";

export type YoutubeDownloadInfo = {
  title: string;
  channel: string;
  duration: number;
  audioUrl: string;
  videoUrl: string | null;
  videoId: string;
};

export type SegmentFiles = {
  audioPath: string;
  videoPath: string | null;
};

function getStaticFfmpegCandidates() {
  const executableName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const candidates = [
    process.env.FFMPEG_BIN,
    ffmpegStatic || undefined,
    path.join(process.cwd(), "node_modules", "ffmpeg-static", executableName),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return Array.from(new Set(candidates));
}

async function runFfmpegWithFallback(args: string[]): Promise<void> {
  const failures: string[] = [];

  for (const candidate of getStaticFfmpegCandidates()) {
    try {
      await execa(candidate, args, { windowsHide: true });
      return;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Falha no ffmpeg-static.");
    }
  }

  try {
    await execa("ffmpeg", args, { windowsHide: true });
    return;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "Falha no FFmpeg do sistema.");
  }

  throw new Error(
    `Não foi possível executar o FFmpeg. Verifique ffmpeg-static, FFMPEG_BIN ou a instalação do FFmpeg no sistema. ${failures.join(" | ")}`.trim(),
  );
}

function buildHttpHeaders() {
  return [
    "Referer: https://www.youtube.com/",
    "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept: */*",
    "Accept-Language: pt-BR,pt;q=0.9,en;q=0.8",
  ].join("\r\n");
}

export async function getYoutubeDownloadInfo(videoId: string): Promise<YoutubeDownloadInfo> {
  const watchUrl = buildYoutubeWatchUrl(videoId);

  let info;

  try {
    info = await ytdl.getInfo(watchUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    throw new Error(
      `Não foi possível obter informações do vídeo do YouTube. ${message}. Se o erro persistir, instale yt-dlp no sistema.`,
    );
  }

  const duration = Number.parseInt(info.videoDetails.lengthSeconds ?? "0", 10);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Não foi possível determinar a duração do vídeo.");
  }

  let audioUrl: string | null = null;
  let videoUrl: string | null = null;

  try {
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });
    audioUrl = audioFormat?.url ?? null;
  } catch {
    audioUrl = null;
  }

  try {
    const videoFormat = ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: "audioandvideo",
    });
    videoUrl = videoFormat?.url ?? null;
  } catch {
    videoUrl = null;
  }

  if (!audioUrl) {
    try {
      const anyFormat = ytdl.chooseFormat(info.formats, { quality: "highest" });
      audioUrl = anyFormat?.url ?? null;
      videoUrl = videoUrl ?? audioUrl;
    } catch {
      throw new Error(
        "Não foi possível obter uma URL de download do vídeo. O vídeo pode ser privado, restrito ou o YouTube pode estar bloqueando o acesso.",
      );
    }
  }

  return {
    title: info.videoDetails.title ?? "Vídeo do YouTube",
    channel: info.videoDetails.author?.name ?? "Canal desconhecido",
    duration,
    audioUrl,
    videoUrl,
    videoId,
  };
}

function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toISOString().substring(11, 19);
}

async function downloadSegmentViaUrl(
  inputUrl: string,
  startSeconds: number | null,
  endSeconds: number | null,
  outputPath: string,
  options: { audioOnly: boolean },
): Promise<void> {
  const args: string[] = ["-y"];

  args.push("-headers", `${buildHttpHeaders()}\r\n`);

  if (startSeconds !== null && startSeconds > 0) {
    args.push("-ss", formatTimestamp(startSeconds));
  }

  if (endSeconds !== null && endSeconds > 0) {
    if (startSeconds !== null && startSeconds > 0) {
      const duration = endSeconds - startSeconds;

      if (duration > 0) {
        args.push("-t", formatTimestamp(duration));
      }
    } else {
      args.push("-to", formatTimestamp(endSeconds));
    }
  }

  args.push("-i", inputUrl);

  if (options.audioOnly) {
    args.push("-vn", "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le");
  } else {
    args.push("-c:v", "libx264", "-preset", "fast", "-crf", "28", "-c:a", "aac", "-b:a", "128k");
  }

  args.push(outputPath);

  await runFfmpegWithFallback(args);
}

async function downloadFullStreamToFile(
  videoId: string,
  audioUrl: string,
  tempDir: string,
): Promise<string> {
  const fullPath = path.join(tempDir, `${videoId}-full.mp4`);
  const writeStream = (await import("fs")).createWriteStream(fullPath);

  return new Promise<string>((resolve, reject) => {
    const stream = ytdl(audioUrl);
    stream.pipe(writeStream);
    stream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", () => resolve(fullPath));
  });
}

async function cutLocalFile(
  inputPath: string,
  startSeconds: number | null,
  endSeconds: number | null,
  outputPath: string,
  options: { audioOnly: boolean },
): Promise<void> {
  const args: string[] = ["-y"];

  if (startSeconds !== null && startSeconds > 0) {
    args.push("-ss", formatTimestamp(startSeconds));
  }

  if (endSeconds !== null && endSeconds > 0) {
    if (startSeconds !== null && startSeconds > 0) {
      const duration = endSeconds - startSeconds;

      if (duration > 0) {
        args.push("-t", formatTimestamp(duration));
      }
    } else {
      args.push("-to", formatTimestamp(endSeconds));
    }
  }

  args.push("-i", inputPath);

  if (options.audioOnly) {
    args.push("-vn", "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le");
  } else {
    args.push("-c:v", "libx264", "-preset", "fast", "-crf", "28", "-c:a", "aac", "-b:a", "128k");
  }

  args.push(outputPath);

  await runFfmpegWithFallback(args);
}

export async function downloadAndCutSegment(
  downloadInfo: YoutubeDownloadInfo,
  startSeconds: number | null,
  endSeconds: number | null,
  onProgress?: (message: string, progress: number) => void,
): Promise<SegmentFiles> {
  const tempDir = await ensureTempDir();
  const baseName = sanitizeFileName(downloadInfo.title).slice(0, 40) || downloadInfo.videoId;
  const audioPath = path.join(tempDir, `${baseName}-audio.wav`);
  const videoPath = path.join(tempDir, `${baseName}-video.mp4`);

  onProgress?.("Baixando e cortando o trecho selecionado (somente áudio)...", 20);

  let usedFallback = false;

  try {
    await downloadSegmentViaUrl(downloadInfo.audioUrl, startSeconds, endSeconds, audioPath, {
      audioOnly: true,
    });
  } catch (audioError) {
    onProgress?.(
      "Download direto falhou. Tentando baixar o arquivo completo para recorte...",
      25,
    );
    usedFallback = true;

    try {
      const fullPath = await downloadFullStreamToFile(
        downloadInfo.videoId,
        downloadInfo.audioUrl,
        tempDir,
      );

      await cutLocalFile(fullPath, startSeconds, endSeconds, audioPath, { audioOnly: true });

      await fs.unlink(fullPath).catch(() => {});
    } catch {
      throw new Error(
        `Não foi possível baixar o áudio do vídeo. ${
          audioError instanceof Error ? audioError.message : ""
        }. Se o erro persistir, instale yt-dlp no sistema e tente novamente.`,
      );
    }
  }

  let resolvedVideoPath: string | null = null;

  if (downloadInfo.videoUrl && !usedFallback) {
    onProgress?.("Baixando o trecho de vídeo para análise de cenas...", 40);

    try {
      await downloadSegmentViaUrl(downloadInfo.videoUrl, startSeconds, endSeconds, videoPath, {
        audioOnly: false,
      });
      resolvedVideoPath = videoPath;
    } catch {
      resolvedVideoPath = null;
    }
  }

  return {
    audioPath,
    videoPath: resolvedVideoPath,
  };
}
