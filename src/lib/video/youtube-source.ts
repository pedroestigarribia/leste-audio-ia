import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { execa } from "execa";
import { nanoid } from "nanoid";
import ytdl from "@distube/ytdl-core";

import { getServerEnv } from "@/lib/env";
import { extractYoutubeVideoId, fetchYoutubeOEmbed, buildYoutubeThumbnail } from "@/lib/youtube";
import { getJobDir } from "@/lib/video/paths";
import { runFfmpeg } from "@/lib/video/tools";
import type { VideoMetadata } from "@/types/video";

function getYoutubeUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function validateYoutubeUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Link do YouTube inválido.");
  }

  const allowedHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"]);
  if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error("Use um link HTTPS público do YouTube.");
  }

  const videoId = extractYoutubeVideoId(rawUrl);
  if (!videoId) {
    throw new Error("Não foi possível identificar o vídeo neste link do YouTube.");
  }

  return { videoId, url: getYoutubeUrl(videoId) };
}

type YoutubeDump = {
  id?: string;
  title?: string;
  channel?: string;
  uploader?: string;
  thumbnail?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  filesize?: number;
};

async function getYtDlpInfo(videoUrl: string) {
  const env = getServerEnv();
  const result = await execa(env.ytDlpBin, ["--dump-single-json", "--no-playlist", "--no-warnings", videoUrl], {
    shell: false,
    windowsHide: true,
    timeout: env.processTimeoutMs,
  });
  const info = JSON.parse(result.stdout) as YoutubeDump;

  if (!info.duration || info.duration <= 0) {
    throw new Error("O YouTube não informou uma duração válida para este vídeo.");
  }

  return info;
}

async function downloadWithYtDlp(videoUrl: string, outputPath: string) {
  const env = getServerEnv();
  await execa(
    env.ytDlpBin,
    [
      "--no-playlist",
      "--no-warnings",
      "--restrict-filenames",
      "-f",
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format",
      "mp4",
      "-o",
      outputPath,
      videoUrl,
    ],
    {
      shell: false,
      windowsHide: true,
      timeout: env.processTimeoutMs,
    },
  );
}

async function downloadWithYtdl(videoUrl: string, outputPath: string) {
  const info = await ytdl.getInfo(videoUrl);
  const format = ytdl.chooseFormat(info.formats, {
    quality: "highest",
    filter: "audioandvideo",
  });
  if (!format?.url) {
    throw new Error("O YouTube não ofereceu um formato de vídeo com áudio.");
  }

  const rawPath = `${outputPath}.download`;
  const writeStream = (await import("node:fs")).createWriteStream(rawPath, { flags: "wx" });
  try {
    await new Promise<void>((resolve, reject) => {
      const stream = ytdl.downloadFromInfo(info, { format });
      stream.on("error", reject);
      writeStream.on("error", reject);
      writeStream.on("finish", resolve);
      stream.pipe(writeStream);
    });
    await runFfmpeg(["-y", "-i", rawPath, "-c", "copy", outputPath]);
  } finally {
    await fs.rm(rawPath, { force: true }).catch(() => undefined);
  }

  return {
    id: info.videoDetails.videoId,
    title: info.videoDetails.title,
    channel: info.videoDetails.author?.name,
    uploader: info.videoDetails.author?.name,
    thumbnail: info.videoDetails.thumbnails?.at(-1)?.url,
    duration: Number(info.videoDetails.lengthSeconds ?? 0),
    width: format.width,
    height: format.height,
  } satisfies YoutubeDump;
}

export async function acquireYoutubeVideo(jobId: string, rawUrl: string) {
  const { videoId, url } = validateYoutubeUrl(rawUrl);
  const jobDir = getJobDir(jobId);
  const outputPath = path.join(jobDir, `source-${nanoid(10)}.mp4`);
  let info: YoutubeDump;

  try {
    info = await getYtDlpInfo(url);
    await downloadWithYtDlp(url, outputPath);
  } catch (ytDlpError) {
    try {
      info = await downloadWithYtdl(url, outputPath);
    } catch (ytdlError) {
      const first = ytDlpError instanceof Error ? ytDlpError.message.split("\n")[0].slice(0, 140) : "yt-dlp indisponível";
      const second = ytdlError instanceof Error ? ytdlError.message.split("\n")[0].slice(0, 140) : "fallback indisponível";
      await fs.rm(outputPath, { force: true }).catch(() => undefined);
      throw new Error(`Não foi possível obter este vídeo diretamente (${first}; fallback: ${second}). Você pode continuar enviando o arquivo MP4.`);
    }
  }

  if (!info) {
    await fs.rm(outputPath, { force: true }).catch(() => undefined);
    throw new Error("Não foi possível obter os metadados do vídeo.");
  }

  let title = info.title ?? `Vídeo ${videoId}`;
  let channel = info.channel ?? info.uploader ?? "Canal desconhecido";
  let thumbnail = info.thumbnail ?? buildYoutubeThumbnail(videoId);

  try {
    const oembed = await fetchYoutubeOEmbed(videoId);
    title = oembed.title || title;
    channel = oembed.author_name || channel;
    thumbnail = oembed.thumbnail_url || thumbnail;
  } catch {
    // yt-dlp metadata is sufficient when oEmbed is unavailable.
  }

  return {
    sourcePath: outputPath,
    metadata: {
      sourceType: "youtube" as const,
      title,
      channel,
      thumbnail,
      durationSec: Number(info.duration ?? 0),
      width: Number(info.width ?? 0),
      height: Number(info.height ?? 0),
      fps: info.fps,
      fileSize: info.filesize,
    } satisfies VideoMetadata,
  };
}
