"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, Search } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import { copyToClipboard } from "@/lib/clipboard";

export type SessionSearchEntry = {
  id: string;
  sourceName: string;
  sourceType: string;
  text: string;
  speakerLabel?: string;
  startSeconds?: number;
  endSeconds?: number;
  audioItemId?: string;
};

type SessionSearchPanelProps = {
  entries: SessionSearchEntry[];
  onOpenAudio?: (itemId: string) => void;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function snippet(value: string, query: string) {
  const index = normalize(value).indexOf(normalize(query));
  if (index < 0) return value.slice(0, 280);
  const start = Math.max(0, index - 90);
  const end = Math.min(value.length, index + query.length + 190);
  return `${start ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`;
}

export default function SessionSearchPanel({ entries, onOpenAudio }: SessionSearchPanelProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    if (normalizedQuery.length < 2) return [];
    return entries.filter((entry) => normalize(entry.text).includes(normalizedQuery) || normalize(entry.sourceName).includes(normalizedQuery)).slice(0, 100);
  }, [entries, query]);

  return <section className="space-y-4 rounded-xl border border-blue-100 bg-white p-4 shadow-editorial sm:p-6"><div><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Search className="h-5 w-5 text-leste-blue" /> Busca em toda a sessão</h2><p className="mt-1 text-sm text-slate-600">Localiza palavras, frases, nomes, empresas, datas, valores, assuntos, tarefas e decisões em áudios e documentos carregados.</p></div><label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="min-h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-leste-blue" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar em transcrições, PDFs, DOCX e resultados" value={query} /></label>{query.trim().length >= 2 ? <p className="text-sm font-semibold text-slate-600">{results.length} ocorrência(s) encontrada(s)</p> : null}<div className="space-y-2">{results.map((result) => <article className="rounded-lg border border-slate-200 p-3" key={result.id}><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase text-leste-blue">{result.sourceType}</p><h3 className="text-sm font-bold text-slate-900">{result.sourceName}</h3><p className="mt-1 text-xs text-slate-500">{result.speakerLabel || ""}{typeof result.startSeconds === "number" ? `${result.speakerLabel ? " · " : ""}${result.startSeconds}s${typeof result.endSeconds === "number" ? `–${result.endSeconds}s` : ""}` : ""}</p></div><div className="flex gap-2"><ActionButton fullWidth={false} onClick={() => void copyToClipboard(result.text)} type="button" variant="ghost"><Copy className="h-3.5 w-3.5" /> Copiar</ActionButton>{result.audioItemId && onOpenAudio ? <ActionButton fullWidth={false} onClick={() => onOpenAudio(result.audioItemId!)} type="button" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /> Abrir</ActionButton> : null}</div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{snippet(result.text, query)}</p></article>)}</div>{query.trim().length >= 2 && !results.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Nenhum resultado encontrado nas fontes desta sessão.</p> : null}</section>;
}
