import type { AnalyzeAllItem } from "@/types/audio";

const MAX_CHUNK_CHARS = 9_000;
const MAX_BATCH_CHARS = 27_000;
const MAX_BATCH_ITEMS = 8;

/** Splits by exact character ranges so every source character is sent to a model call. */
export function splitSessionItems(items: AnalyzeAllItem[]): AnalyzeAllItem[] {
  return items.flatMap((item) => {
    const text = item.transcription;
    if (text.length <= MAX_CHUNK_CHARS) return [item];

    const ranges: string[] = [];
    for (let offset = 0; offset < text.length; offset += MAX_CHUNK_CHARS) {
      ranges.push(text.slice(offset, offset + MAX_CHUNK_CHARS));
    }

    return ranges.map((transcription, index) => ({
      id: item.id ? `${item.id}-parte-${index + 1}` : undefined,
      name: `${item.name} (parte ${index + 1}/${ranges.length})`,
      transcription,
    }));
  });
}

export function groupSessionItems(items: AnalyzeAllItem[]): AnalyzeAllItem[][] {
  const groups: AnalyzeAllItem[][] = [];
  let current: AnalyzeAllItem[] = [];
  let currentChars = 0;

  for (const item of items) {
    const size = item.name.length + item.transcription.length;
    if (current.length && (current.length >= MAX_BATCH_ITEMS || currentChars + size > MAX_BATCH_CHARS)) {
      groups.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(item);
    currentChars += size;
  }

  if (current.length) groups.push(current);
  return groups;
}

export function prepareSessionBatches(items: AnalyzeAllItem[]): AnalyzeAllItem[][] {
  return groupSessionItems(splitSessionItems(items));
}
