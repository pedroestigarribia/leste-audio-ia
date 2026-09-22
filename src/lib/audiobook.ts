import type { NarrationPrepMode } from "@/types/audio";

export type AudiobookChapterState = "pending" | "generating" | "done" | "error";

export type AudiobookChapter = {
  id: string;
  title: string;
  text: string;
  wordCount: number;
  estimatedMinutes: number;
  status: AudiobookChapterState;
};

export type PdfAudiobook = {
  source: "original" | "prepared";
  mode: NarrationPrepMode;
  chapters: AudiobookChapter[];
  isPreparing: boolean;
  isGenerating: boolean;
  error?: string;
};

const MAX_CHAPTER_CHARS = 9_000;
const MIN_CHAPTER_CHARS = 700;

function getWordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function toChapter(title: string, text: string, index: number): AudiobookChapter {
  const normalizedText = text.trim();
  const wordCount = getWordCount(normalizedText);

  return {
    id: `chapter-${index + 1}`,
    title: title.trim() || `Capítulo ${index + 1}`,
    text: normalizedText,
    wordCount,
    estimatedMinutes: Math.max(1, Math.ceil(wordCount / 150)),
    status: "pending",
  };
}

function splitLongText(text: string, title: string, startIndex: number): AudiobookChapter[] {
  const paragraphs = text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buffer = "";

  const append = (value: string) => {
    const candidate = buffer ? `${buffer}\n\n${value}` : value;

    if (candidate.length <= MAX_CHAPTER_CHARS) {
      buffer = candidate;
      return;
    }

    if (buffer) {
      chunks.push(buffer);
      buffer = "";
    }

    if (value.length <= MAX_CHAPTER_CHARS) {
      buffer = value;
      return;
    }

    const sentences = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [value];

    for (const sentence of sentences) {
      if (buffer && `${buffer} ${sentence}`.length > MAX_CHAPTER_CHARS) {
        chunks.push(buffer);
        buffer = sentence.trim();
      } else {
        buffer = buffer ? `${buffer} ${sentence.trim()}` : sentence.trim();
      }
    }
  };

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    append(paragraph);
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks
    .filter(Boolean)
    .map((chunk, index) =>
      toChapter(
        chunks.length === 1 ? title : `${title} - Parte ${index + 1}`,
        chunk,
        startIndex + index,
      ),
    );
}

export function buildAudiobookChapters(text: string): AudiobookChapter[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  // Headings commonly preserved by text-based book PDFs.
  const headingPattern = /^(?:cap[ií]tulo|parte|livro)\s+(?:[\divxlcdm]+|\d+|[\p{L}][\p{L}\s-]{0,80})$/gimu;
  const matches = Array.from(normalized.matchAll(headingPattern));
  const sections: Array<{ title: string; text: string }> = [];

  if (matches.length) {
    const firstHeading = matches[0];
    const intro = normalized.slice(0, firstHeading.index).trim();

    if (intro.length >= MIN_CHAPTER_CHARS) {
      sections.push({ title: "Introdução", text: intro });
    }

    for (let index = 0; index < matches.length; index += 1) {
      const current = matches[index];
      const next = matches[index + 1];
      const start = (current.index ?? 0) + current[0].length;
      const end = next?.index ?? normalized.length;
      const sectionText = normalized.slice(start, end).trim();

      if (sectionText) {
        sections.push({ title: current[0], text: sectionText });
      }
    }
  }

  if (!sections.length) {
    sections.push({ title: "Leitura", text: normalized });
  }

  return sections.flatMap((section, index) => splitLongText(section.text, section.title, index * 100));
}

export function createPdfAudiobook(text: string, mode: NarrationPrepMode = "natural"): PdfAudiobook {
  return {
    source: "original",
    mode,
    chapters: buildAudiobookChapters(text),
    isPreparing: false,
    isGenerating: false,
  };
}
