import type { TranscriptSegment, TranscriptWord } from "@/types/video";

type ChunkSegment = { id: string | number; start: number; end: number; text: string };
type ChunkWord = { start: number; end: number; word: string };

export function mapTranscriptChunk(params: {
  idPrefix: string;
  offsetSeconds: number;
  durationSec: number;
  segments: ChunkSegment[];
  words: ChunkWord[];
}): TranscriptSegment[] {
  const mapTime = (value: number) => Math.max(0, Math.min(params.durationSec, params.offsetSeconds + value));
  const words: TranscriptWord[] = params.words
    .map((word) => ({ word: word.word.trim(), start: mapTime(word.start), end: mapTime(word.end) }))
    .filter((word) => word.word && word.end > word.start)
    .sort((a, b) => a.start - b.start);

  return params.segments.flatMap((segment, index) => {
    const start = mapTime(segment.start);
    const end = mapTime(segment.end);
    const text = segment.text.trim();
    if (!text || end <= start) return [];

    return [{
      id: `${params.idPrefix}-${segment.id}-${index}`,
      start,
      end,
      text,
      words: words.filter((word) => word.start < end && word.end > start),
    }];
  });
}
