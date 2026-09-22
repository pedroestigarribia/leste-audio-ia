import "server-only";

import { promises as fs } from "node:fs";

import { escapeSubtitlePath, runFfmpeg } from "@/lib/video/tools";
import type { AspectRatio, ClipCandidate, RenderOptions, TranscriptSegment } from "@/types/video";

function formatSrtTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1_000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function subtitleText(segments: TranscriptSegment[], startTime: number, endTime: number) {
  return segments
    .map((segment) => {
      const start = Math.max(segment.start, startTime);
      const end = Math.min(segment.end, endTime);
      if (end <= start || !segment.text.trim()) return null;

      return {
        start: start - startTime,
        end: end - startTime,
        text: segment.speakerId ? `${segment.speakerId}: ${segment.text.trim()}` : segment.text.trim(),
      };
    })
    .filter((segment): segment is { start: number; end: number; text: string } => Boolean(segment))
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

function buildVideoFilter(options: RenderOptions, srtPath?: string) {
  const filters = [aspectFilter(options.aspectRatio)];
  if (options.captionPreset !== "none" && srtPath) {
    filters.push(
      `subtitles=${escapeSubtitlePath(srtPath)}:force_style='FontName=Montserrat,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=150'`,
    );
  }
  return filters.join(",");
}

export async function writeSrt(
  segments: TranscriptSegment[],
  candidate: Pick<ClipCandidate, "startTime" | "endTime">,
  outputPath: string,
) {
  const text = subtitleText(segments, candidate.startTime, candidate.endTime);
  await fs.writeFile(outputPath, text || "1\n00:00:00,000 --> 00:00:01,000\n\n", "utf8");
}

export async function renderVideoClip(params: {
  sourcePath: string;
  outputPath: string;
  srtPath?: string;
  candidate: Pick<ClipCandidate, "startTime" | "endTime">;
  options: RenderOptions;
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
    buildVideoFilter(params.options, params.srtPath),
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

  try {
    await runFfmpeg(args);
  } catch (error) {
    if (!params.srtPath || params.options.captionPreset === "none") {
      throw error;
    }

    // A minimal FFmpeg build may not include libass. The video remains usable
    // without burned captions, while the SRT is still offered for download.
    const fallbackArgs = args.slice();
    const filterIndex = fallbackArgs.indexOf("-vf");
    fallbackArgs.splice(filterIndex, 2, "-vf", aspectFilter(params.options.aspectRatio));
    await runFfmpeg(fallbackArgs);
  }
}
