"use client";

import { useRef, useState } from "react";
import { Clock3, UserRound } from "lucide-react";

import type { AudioSpeaker, TranscriptSegment } from "@/types/audio";

type TranscriptTimelineProps = {
  segments: TranscriptSegment[];
  speakers: AudioSpeaker[];
  audioUrl?: string;
  onRenameSpeaker: (speakerId: string, label: string) => void;
};

function formatTime(seconds?: number) {
  if (typeof seconds !== "number") return "Tempo não disponível";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

export default function TranscriptTimeline({ segments, speakers, audioUrl, onRenameSpeaker }: TranscriptTimelineProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  if (!segments.length) return null;

  function playSegment(segment: TranscriptSegment) {
    if (!audioRef.current || typeof segment.startSeconds !== "number") return;
    audioRef.current.currentTime = segment.startSeconds;
    setActiveSegmentId(segment.id);
    void audioRef.current.play();
  }

  return <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4"><div><h4 className="text-sm font-bold text-slate-950">Falantes e trechos</h4><p className="mt-1 text-xs leading-5 text-slate-600">Os nomes podem ser corrigidos. Clique em um trecho com tempo disponível para iniciar a reprodução nesse ponto.</p></div>{audioUrl ? <audio className="w-full" controls onPause={() => setActiveSegmentId(null)} ref={audioRef} src={audioUrl} /> : null}{speakers.length ? <div className="grid gap-2 sm:grid-cols-2">{speakers.map((speaker) => <label className="flex items-center gap-2 rounded-md bg-white p-2 text-xs font-semibold text-slate-600" key={speaker.id}><UserRound className="h-4 w-4 text-leste-blue" /><input className="min-h-8 min-w-0 flex-1 rounded border border-slate-200 px-2 text-sm text-slate-800" onChange={(event) => onRenameSpeaker(speaker.id, event.target.value)} value={speaker.label} /></label>)}</div> : null}<div className="space-y-2">{segments.map((segment) => <button className={`block w-full rounded-lg border p-3 text-left disabled:cursor-default ${activeSegmentId === segment.id ? "border-leste-blue bg-blue-100" : "border-slate-200 bg-white"}`} disabled={!audioUrl || typeof segment.startSeconds !== "number"} key={segment.id} onClick={() => playSegment(segment)} type="button"><div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500"><span>{segment.speakerLabel || "Falante não identificado"}</span><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatTime(segment.startSeconds)}{typeof segment.endSeconds === "number" ? ` – ${formatTime(segment.endSeconds)}` : ""}</span></div><p className="text-sm leading-6 text-slate-800">{segment.text}</p></button>)}</div></section>;
}
