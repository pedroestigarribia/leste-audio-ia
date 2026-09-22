import "server-only";

export const YOUTUBE_OEMBED_ENDPOINT = "https://www.youtube.com/oembed";

const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/i,
  /(?:youtu\.be\/)([\w-]{11})/i,
  /(?:youtube\.com\/embed\/)([\w-]{11})/i,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/i,
  /(?:youtube\.com\/live\/)([\w-]{11})/i,
  /(?:music\.youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/i,
];

export function extractYoutubeVideoId(rawUrl: string): string | null {
  const url = rawUrl.trim();

  if (!url) {
    return null;
  }

  if (/^[\w-]{11}$/.test(url)) {
    return url;
  }

  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = pattern.exec(url);

    if (match?.[1]) {
      return match[1];
    }
  }

  try {
    const parsed = new URL(url);
    const vParam = parsed.searchParams.get("v");

    if (vParam && /^[\w-]{11}$/.test(vParam)) {
      return vParam;
    }
  } catch {
    return null;
  }

  return null;
}

export function isYoutubeUrl(rawUrl: string): boolean {
  return extractYoutubeVideoId(rawUrl) !== null;
}

export function buildYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function buildYoutubeEmbedUrl(videoId: string, startTime?: number): string {
  const base = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`;
  return startTime && startTime > 0 ? `${base}&start=${Math.floor(startTime)}` : base;
}

export function buildYoutubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

type OEmbedResponse = {
  title: string;
  author_name: string;
  thumbnail_url: string;
};

export async function fetchYoutubeOEmbed(videoId: string): Promise<OEmbedResponse> {
  const watchUrl = buildYoutubeWatchUrl(videoId);
  const endpoint = `${YOUTUBE_OEMBED_ENDPOINT}?url=${encodeURIComponent(watchUrl)}&format=json`;

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(
      `Não foi possível obter os metadados do vídeo (HTTP ${response.status}). Verifique se o link é público.`,
    );
  }

  return (await response.json()) as OEmbedResponse;
}
