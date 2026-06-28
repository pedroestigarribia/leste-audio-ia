export const ALLOWED_AUDIO_EXTENSIONS = [
  "ogg",
  "opus",
  "m4a",
  "mp3",
  "wav",
  "webm",
  "aac",
  "flac",
] as const;

const MIME_BY_EXTENSION: Record<string, string> = {
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};

const CONVERSION_PRIORITY = new Set(["ogg", "opus", "webm", "m4a", "aac"]);

export function getFileExtension(filename: string): string {
  const cleanName = filename.trim().toLowerCase();
  const lastDotIndex = cleanName.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return "";
  }

  return cleanName.slice(lastDotIndex + 1);
}

export function getMimeTypeFromExtension(extension: string): string {
  return MIME_BY_EXTENSION[extension.toLowerCase()] ?? "application/octet-stream";
}

export function isAllowedAudio(extension: string, mimeType?: string): boolean {
  const normalizedExtension = extension.toLowerCase();
  const normalizedMime = (mimeType ?? "").toLowerCase();

  if (!ALLOWED_AUDIO_EXTENSIONS.includes(normalizedExtension as (typeof ALLOWED_AUDIO_EXTENSIONS)[number])) {
    return false;
  }

  if (!normalizedMime) {
    return true;
  }

  if (normalizedMime.startsWith("audio/")) {
    return true;
  }

  return normalizedExtension === "ogg" && normalizedMime === "application/ogg";
}

export function shouldConvert(extension: string): boolean {
  return CONVERSION_PRIORITY.has(extension.toLowerCase());
}
