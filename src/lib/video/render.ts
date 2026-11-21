import "server-only";

import { promises as fs } from "node:fs";

import { escapeSubtitlePath, runFfmpeg } from "@/lib/video/tools";
import { buildCropPositionExpression, getReframeCropDimensions, type ReframeKeyframe } from "@/lib/video/reframe-math";
import type { AspectRatio, ClipCandidate, RenderOptions, TranscriptSegment } from "@/types/video";

function formatSrtTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1_000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function subtitleText(
  segments: TranscriptSegment[],
  startTime: number,
  endTime: number,
  preset: RenderOptions["captionPreset"] = "simple",
) {
  return segments
    .flatMap((segment) => {
      const start = Math.max(segment.start, startTime);
      const end = Math.min(segment.end, endTime);
      if (end <= start || !segment.text.trim()) return [];

      const words = preset === "dynamic"
        ? segment.words
            .map((word) => ({
              start: Math.max(word.start, startTime, segment.start),
              end: Math.min(word.end, endTime, segment.end),
              text: word.word.trim(),
            }))
            .filter((word) => word.text && word.end > word.start)
        : [];

      if (words.length) {
        return words.map((word) => ({
          start: word.start - startTime,
          end: word.end - startTime,
          text: word.text,
        }));
      }

      return [{
        start: start - startTime,
        end: end - startTime,
        text: segment.speakerId ? `${segment.speakerId}: ${segment.text.trim()}` : segment.text.trim(),
      }];
    })
    .map((segment, index) => `${index + 1}\n${formatSrtTime(segment.start)} --> ${formatSrtTime(segment.end)}\n${segment.text}\n`)
    .join("\n");
}

function aspectFilter(aspectRatio: AspectRatio) {
  if (aspectRatio === "9:16") {
    return "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
  }

  if (aspectRatio === "1:1") {
    return "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080";
  }

  return "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black";
}

type ReframePlan = { sourceWidth: number; sourceHeight: number; durationSec: number; keyframes: ReframeKeyframe[] };

function reframeFilter(aspectRatio: AspectRatio, plan?: ReframePlan) {
  if (!plan?.keyframes.length) return undefined;
  const crop = getReframeCropDimensions(plan.sourceWidth, plan.sourceHeight, aspectRatio);
  if (!crop) return undefined;
  const x = buildCropPositionExpression(plan.keyframes, "x", crop.width, plan.sourceWidth, plan.durationSec);
  const y = buildCropPositionExpression(plan.keyframes, "y", crop.height, plan.sourceHeight, plan.durationSec);
  const outputSize = aspectRatio === "9:16" ? "1080:1920" : aspectRatio === "1:1" ? "1080:1080" : "1920:1080";
  return `crop=${crop.width}:${crop.height}:x='${x}':y='${y}',scale=${outputSize}`;
}

function baseVideoFilter(options: RenderOptions, reframe?: ReframePlan) {
  return reframeFilter(options.aspectRatio, reframe) || aspectFilter(options.aspectRatio);
}

export function buildVideoFilter(options: RenderOptions, srtPath?: string, reframe?: ReframePlan) {
  const filters = [baseVideoFilter(options, reframe)];
  if (options.captionPreset !== "none" && srtPath) {
    const style = options.captionPreset === "dynamic"
      ? "FontName=Montserrat,FontSize=24,PrimaryColour=&H003DD5FF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,MarginV=180,Bold=1"
      : "FontName=Montserrat,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=150";
    filters.push(
      `subtitles=${escapeSubtitlePath(srtPath)}:force_style='${style}'`,
    );
  }
  return filters.join(",");
}

export async function writeSrt(
  segments: TranscriptSegment[],
  candidate: Pick<ClipCandidate, "startTime" | "endTime">,
  outputPath: string,
  preset: RenderOptions["captionPreset"] = "simple",
) {
  const text = subtitleText(segments, candidate.startTime, candidate.endTime, preset);
  await fs.writeFile(outputPath, text || "1\n00:00:00,000 --> 00:00:01,000\n\n", "utf8");
}

export async function renderVideoClip(params: {
  sourcePath: string;
  outputPath: string;
  srtPath?: string;
  candidate: Pick<ClipCandidate, "startTime" | "endTime">;
  options: RenderOptions;
  reframe?: ReframePlan;
}) {
  const duration = params.candidate.endTime - params.candidate.startTime;
  if (!Number.isFinite(duration) || duration < 1) {
    throw new Error("O intervalo do corte precisa ter pelo menos 1 segundo.");
  }

  const args = [
    "-y",
    "-ss",
    params.candidate.startTime.toFixed(3),
    "-i",
    params.sourcePath,
    "-t",
    duration.toFixed(3),
    "-vf",
    buildVideoFilter(params.options, params.srtPath, params.reframe),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    params.outputPath,
  ];

  if (!params.srtPath || params.options.captionPreset === "none") {
    await runFfmpeg(args);
    return { captionsBurned: false, reframeApplied: Boolean(reframeFilter(params.options.aspectRatio, params.reframe)) };
  }

  try {
    await runFfmpeg(args);
    return { captionsBurned: true, reframeApplied: Boolean(reframeFilter(params.options.aspectRatio, params.reframe)) };
  } catch {
    const fallbackArgs = args.slice();
    const filterIndex = fallbackArgs.indexOf("-vf");
    fallbackArgs.splice(filterIndex, 2, "-vf", baseVideoFilter(params.options, params.reframe));
    await runFfmpeg(fallbackArgs);
    return {
      captionsBurned: false,
      reframeApplied: Boolean(reframeFilter(params.options.aspectRatio, params.reframe)),
      warning: "O FFmpeg deste ambiente não conseguiu incorporar a legenda; o arquivo SRT está disponível separadamente.",
    };
  }
}
