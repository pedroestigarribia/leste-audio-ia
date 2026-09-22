import "server-only";

import { runFfmpeg, runFfprobe } from "@/lib/video/tools";
import type { VideoMetadata, VideoSourceType } from "@/types/video";

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  channels?: number;
  sample_rate?: string;
};

function parseFps(value?: string) {
  if (!value || !value.includes("/")) {
    return undefined;
  }

  const [numerator, denominator] = value.split("/").map(Number);
  if (!numerator || !denominator) {
    return undefined;
  }

  return numerator / denominator;
}

export async function probeVideo(
  filePath: string,
  sourceType: VideoSourceType,
  extra: Pick<VideoMetadata, "title" | "channel" | "thumbnail">,
): Promise<VideoMetadata> {
  const output = await runFfprobe([
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,channels,sample_rate",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(output) as {
    format?: { duration?: string; size?: string };
    streams?: ProbeStream[];
  };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.find((stream) => stream.codec_type === "audio");
  const durationSec = Number(parsed.format?.duration ?? 0);

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("Não foi possível determinar a duração real do vídeo.");
  }

  if (!video) {
    throw new Error("O arquivo não contém uma faixa de vídeo válida.");
  }

  return {
    sourceType,
    title: extra.title,
    channel: extra.channel,
    thumbnail: extra.thumbnail,
    durationSec,
    width: Number(video.width ?? 0),
    height: Number(video.height ?? 0),
    fps: parseFps(video.r_frame_rate),
    videoCodec: video.codec_name,
    audioCodec: audio?.codec_name,
    audioChannels: audio?.channels,
    sampleRate: audio?.sample_rate ? Number(audio.sample_rate) : undefined,
    fileSize: parsed.format?.size ? Number(parsed.format.size) : undefined,
  };
}

export async function extractAudioForVideo(inputPath: string, outputPath: string, signal?: AbortSignal) {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-acodec",
    "pcm_s16le",
    outputPath,
  ], signal);
}
