"use client";

import { useEffect, useState } from "react";
import { Headphones, RefreshCw, Wand2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import type { NarrationPrepMode, PronunciationEntry } from "@/types/audio";

type NarrationReviewPanelProps = {
  sourceKey: string;
  title: string;
  text: string;
  isSpeechLoading?: boolean;
  onSpeak: (key: `review:${string}`, title: string, text: string) => void;
};

function applyPronunciation(text: string, entries: PronunciationEntry[]) {
  return entries.reduce((current, entry) => {
    const original = entry.original.trim();
    const pronunciation = entry.pronuncia.trim();
    if (!original || !pronunciation) return current;
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return current.replace(new RegExp(`\\b${escaped}\\b`, "gi"), pronunciation);
  }, text);
}

export default function NarrationReviewPanel({ sourceKey, title, text, isSpeechLoading, onSpeak }: NarrationReviewPanelProps) {
  const [draft, setDraft] = useState(text);
  const [mode, setMode] = useState<NarrationPrepMode>("natural");
  const [pronunciations, setPronunciations] = useState<PronunciationEntry[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(text);
    setError("");
  }, [sourceKey, text]);

  const speechText = applyPronunciation(draft, pronunciations);

  async function prepare() {
    if (!draft.trim()) return;
    setIsPreparing(true);
    setError("");
    try {
      const response = await fetch("/api/prepare-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft, mode }),
      });
      const payload = (await response.json()) as { ok?: boolean; result?: { prepared?: string }; error?: string };
      if (!response.ok || !payload.ok || !payload.result?.prepared) throw new Error(payload.error || "Não foi possível preparar a narração.");
      setDraft(payload.result.prepared);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível preparar a narração.");
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <div>
        <h4 className="text-sm font-bold text-slate-950">Revisão antes da voz da Milena</h4>
        <p className="mt-1 text-xs leading-5 text-slate-600">A revisão altera somente a versão narrada. A transcrição original permanece intacta.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="text-xs font-semibold text-slate-600">
          Versão
          <select className="mt-1 min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" onChange={(event) => setMode(event.target.value as NarrationPrepMode)} value={mode}>
            <option value="fiel">Fiel</option>
            <option value="natural">Natural</option>
            <option value="adaptada">Adaptada</option>
          </select>
        </label>
        <ActionButton className="self-end sm:w-auto" fullWidth loading={isPreparing} onClick={() => void prepare()} type="button" variant="secondary">
          <Wand2 className="h-4 w-4" /> Preparar
        </ActionButton>
      </div>
      <textarea aria-label="Texto revisado para narração" className="min-h-40 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue" onChange={(event) => setDraft(event.target.value)} value={draft} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Termo original<input className="mt-1 min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" onChange={(event) => setPronunciations((current) => [{ original: event.target.value, pronuncia: current[0]?.pronuncia ?? "" }])} value={pronunciations[0]?.original ?? ""} /></label>
        <label className="text-xs font-semibold text-slate-600">Como a Milena deve pronunciar<input className="mt-1 min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" onChange={(event) => setPronunciations((current) => [{ original: current[0]?.original ?? "", pronuncia: event.target.value }])} placeholder="Ex.: Leste Véli" value={pronunciations[0]?.pronuncia ?? ""} /></label>
      </div>
      <ActionButton fullWidth loading={isSpeechLoading} onClick={() => onSpeak(`review:${sourceKey}`, title, speechText)} type="button" variant="primary">
        <Headphones className="h-4 w-4" /> Gerar voz revisada da Milena
      </ActionButton>
      {draft !== text ? <p className="flex items-center gap-1 text-xs text-slate-500"><RefreshCw className="h-3.5 w-3.5" /> O áudio será atualizado usando esta versão revisada.</p> : null}
      {error ? <ErrorBox message={error} /> : null}
    </section>
  );
}
