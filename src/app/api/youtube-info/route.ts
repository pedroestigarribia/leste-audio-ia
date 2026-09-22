import { NextResponse } from "next/server";

import {
  buildYoutubeThumbnail,
  extractYoutubeVideoId,
  fetchYoutubeOEmbed,
} from "@/lib/youtube";
import type { YoutubeVideoInfo } from "@/types/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { url?: string } | null;
    const rawUrl = body?.url?.trim() ?? "";

    if (!rawUrl) {
      return NextResponse.json(
        { ok: false, error: "Envie um link do YouTube." },
        { status: 400 },
      );
    }

    const videoId = extractYoutubeVideoId(rawUrl);

    if (!videoId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Link inválido. Cole um link no formato youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/... ou youtube.com/embed/...",
        },
        { status: 400 },
      );
    }

    const oembed = await fetchYoutubeOEmbed(videoId);

    let duration = 0;

    try {
      const { getYoutubeDownloadInfo } = await import("@/lib/youtube-download");
      const info = await getYoutubeDownloadInfo(videoId);
      duration = info.duration;
    } catch {
      duration = 0;
    }

    const video: YoutubeVideoInfo = {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: oembed.title,
      channel: oembed.author_name,
      thumbnail: oembed.thumbnail_url || buildYoutubeThumbnail(videoId),
      duration,
    };

    return NextResponse.json({ ok: true, video });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível obter as informações do vídeo.";

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
