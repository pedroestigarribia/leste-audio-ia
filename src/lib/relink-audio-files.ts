import type { AudioItem } from "@/types/audio";

export function relinkAudioFiles(items: AudioItem[], files: File[]) {
  const nextItems = [...items];
  const unmatched: File[] = [];
  const ambiguous: string[] = [];
  const reattached: string[] = [];
  const alreadyPresent: File[] = [];

  for (const file of files) {
    const candidates = nextItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.originalFileAvailable === false && !item.sourceUrl &&
        (item.originalFileName ?? item.name) === file.name && item.size === file.size);

    if (!candidates.length) {
      const present = nextItems.some((item) => item.originalFileAvailable !== false && !item.sourceUrl &&
        (item.originalFileName ?? item.name) === file.name && item.size === file.size &&
        (item.originalLastModified ?? item.file.lastModified) === file.lastModified);
      if (present || unmatched.some((entry) => entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified)) {
        alreadyPresent.push(file);
        continue;
      }
      unmatched.push(file);
      continue;
    }

    const exact = candidates.filter(({ item }) =>
      item.originalLastModified === undefined || item.originalLastModified === file.lastModified,
    );
    if (exact.length !== 1) {
      ambiguous.push(file.name);
      continue;
    }

    const { item, index } = exact[0];
    nextItems[index] = {
      ...item,
      file,
      originalFileAvailable: true,
      originalFileName: file.name,
      originalLastModified: file.lastModified,
      status: item.transcription ? "done" : "idle",
      error: undefined,
    };
    reattached.push(item.id);
  }

  return { items: nextItems, unmatched, ambiguous, reattached, alreadyPresent };
}
