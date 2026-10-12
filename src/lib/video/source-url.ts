import "server-only";

import { buildYoutubeWatchUrl, extractYoutubeVideoId } from "@/lib/youtube";

export type PublicVideoSource = {
  platform: "instagram" | "youtube";
  url: string;
  id: string;
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);

export class InvalidVideoSourceUrlError extends Error {}

export function validatePublicVideoUrl(rawUrl: string): PublicVideoSource {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new InvalidVideoSourceUrlError("Cole um link válido do Instagram ou YouTube.");
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new InvalidVideoSourceUrlError("Use um link HTTPS público, sem credenciais embutidas.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(hostname)) {
    const videoId = extractYoutubeVideoId(parsed.toString());
    if (!videoId) {
      throw new InvalidVideoSourceUrlError("Não foi possível identificar um vídeo neste link do YouTube.");
    }

    return {
      platform: "youtube",
      id: videoId,
      url: buildYoutubeWatchUrl(videoId),
    };
  }

  if (INSTAGRAM_HOSTS.has(hostname)) {
    const match = /^\/(?:share\/|[A-Za-z0-9_.]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)\/?$/i.exec(
      parsed.pathname,
    );
    if (!match) {
      throw new InvalidVideoSourceUrlError(
        "Use o link direto de um Reel ou publicação de vídeo pública do Instagram.",
      );
    }

    const kind = parsed.pathname.toLowerCase().includes("/tv/")
      ? "tv"
      : parsed.pathname.toLowerCase().includes("/p/")
        ? "p"
        : "reel";

    return {
      platform: "instagram",
      id: match[1],
      url: `https://www.instagram.com/${kind}/${match[1]}/`,
    };
  }

  throw new InvalidVideoSourceUrlError("Por segurança, são aceitos somente links do Instagram e YouTube.");
}
