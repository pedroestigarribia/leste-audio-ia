import type { AspectRatio } from "@/types/video";

export type ReframeKeyframe = {
  time: number;
  centerX: number;
  centerY: number;
  confidence?: number;
};

const ASPECTS: Record<AspectRatio, number> = { "9:16": 9 / 16, "1:1": 1, "16:9": 16 / 9 };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function number(value: number) {
  return Number(value.toFixed(4)).toString();
}

export function selectReframeSampleTimes(start: number, end: number, sceneMarkers: number[], maxSamples = 8) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || maxSamples < 2) return [];
  const candidates = Array.from(new Set([
    start,
    ...sceneMarkers.filter((time) => Number.isFinite(time) && time > start && time < end),
    end,
  ])).sort((a, b) => a - b);
  if (candidates.length <= maxSamples) return candidates;

  return Array.from({ length: maxSamples }, (_, index) => {
    const candidateIndex = Math.round(index * (candidates.length - 1) / (maxSamples - 1));
    return candidates[candidateIndex];
  });
}

export function getReframeCropDimensions(sourceWidth: number, sourceHeight: number, aspectRatio: AspectRatio) {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const targetRatio = ASPECTS[aspectRatio];
  if (sourceWidth / sourceHeight <= targetRatio) return null;

  return {
    width: Math.max(1, Math.round(sourceHeight * targetRatio)),
    height: sourceHeight,
  };
}

export function buildCropPositionExpression(
  keyframes: ReframeKeyframe[],
  axis: "x" | "y",
  cropSize: number,
  sourceSize: number,
  durationSec: number,
) {
  const centerKey = axis === "x" ? "centerX" : "centerY";
  const points = keyframes
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point[centerKey]))
    .map((point) => ({
      time: clamp(point.time, 0, Math.max(0, durationSec)),
      center: clamp(point[centerKey], 0, 1),
    }))
    .sort((a, b) => a.time - b.time)
    .filter((point, index, values) => index === 0 || point.time > values[index - 1].time);

  const maxPosition = Math.max(0, sourceSize - cropSize);
  const positionAt = (center: number) => number(clamp(center * sourceSize - cropSize / 2, 0, maxPosition));
  if (!points.length) return positionAt(0.5);

  let expression = positionAt(points.at(-1)!.center);
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const current = points[index];
    const next = points[index + 1];
    const currentPosition = positionAt(current.center);
    const nextPosition = positionAt(next.center);
    const span = Math.max(0.001, next.time - current.time);
    const interpolation = `${currentPosition}+(${nextPosition}-${currentPosition})*(t-${number(current.time)})/${number(span)}`;
    expression = `if(lt(t,${number(next.time)}),${interpolation},${expression})`;
  }

  const first = points[0];
  if (first.time > 0) expression = `if(lt(t,${number(first.time)}),${positionAt(first.center)},${expression})`;
  return `max(0,min(${number(maxPosition)},${expression}))`;
}
