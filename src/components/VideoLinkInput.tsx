"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";

type VideoLinkInputProps = {
  disabled?: boolean;
  onAdd: (links: string[]) => void;
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);

function isSupportedVideoUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();
    if (YOUTUBE_HOSTS.has(host)) {
      return /(?:youtu\.be\/|[?&]v=|youtube\.com\/(?:embed|shorts|live)\/)[\w-]{11}/i.test(rawUrl);
    }
    return INSTAGRAM_HOSTS.has(host) && /^\/(?:share\/|[A-Za-z0-9_.]+\/)?(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export default function VideoLinkInput({ disabled = false, onAdd }: VideoLinkInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleAdd() {
    const links = Array.from(new Set(value.split(/\r?\n/).map((link) => link.trim()).filter(Boolean)));
    if (!links.length) {
      setError("Cole um link do Instagram ou YouTube.");
      return;
    }
    if (links.some((link) => !isSupportedVideoUrl(link))) {
      setError("Use links HTTPS diretos de Reels/publicações de vídeo ou vídeos do YouTube, um por linha.");
      return;
    }

    setError("");
    setValue("");
    onAdd(links);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-leste-blue">
          <Link2 aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-slate-950">Ou cole links de vídeo</h3>
          <p className="text-xs text-slate-500">Instagram Reels e YouTube · um link por linha</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="sr-only" htmlFor="video-source-urls">Links públicos de vídeo</label>
        <textarea
          className="min-h-20 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-leste-blue focus:ring-2 focus:ring-blue-100"
          disabled={disabled}
          id="video-source-urls"
          onChange={(event) => {
            setValue(event.currentTarget.value);
            if (error) setError("");
          }}
          placeholder={'https://www.instagram.com/reel/...\nhttps://www.youtube.com/watch?v=...'}
          value={value}
        />
        <ActionButton disabled={disabled} fullWidth={false} onClick={handleAdd} type="button" variant="secondary">
          <Link2 aria-hidden="true" className="h-4 w-4" />
          Adicionar links
        </ActionButton>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        O app tenta acessar o conteúdo sem login. Use vídeos seus ou autorizados; links restritos ou bloqueados podem falhar. Se isso acontecer, envie o MP4.
      </p>
      {error ? <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
