export function normalizePlainText(text: string): string {
  if (!text.trim()) {
    return "";
  }

  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s*/g, "")
        .replace(/^\s*>\s?/g, "")
        .replace(/^\s*[•●▪]\s+/g, "- ")
        .replace(/^\s*[-+*]\s+/g, "- ")
        .replace(/\s+$/g, ""),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized;
}
