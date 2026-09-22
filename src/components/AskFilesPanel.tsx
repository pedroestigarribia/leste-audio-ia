"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Headphones, Search, Send } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import NarrationReviewPanel from "@/components/NarrationReviewPanel";
import { copyToClipboard } from "@/lib/clipboard";
import { buildDocxBlob } from "@/lib/export-docx";
import type { AskFilesAnswer } from "@/types/audio";

export type AskFileSource = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  chunks: Array<{ chunkId: string; text: string; speakerLabel?: string; startSeconds?: number; endSeconds?: number }>;
};

type AskFilesPanelProps = {
  sources: AskFileSource[];
  onSpeak: (key: `review:${string}`, title: string, text: string) => void;
  isSpeechLoading?: boolean;
};

function formatAnswer(answer: AskFilesAnswer) {
  return [
    "RESPOSTA",
    answer.answer,
    answer.facts.length ? `FATOS ENCONTRADOS\n${answer.facts.map((item) => `- ${item}`).join("\n")}` : "",
    answer.inferences.length ? `INFERÊNCIAS\n${answer.inferences.map((item) => `- ${item}`).join("\n")}` : "",
    answer.notFound.length ? `NÃO LOCALIZADO\n${answer.notFound.map((item) => `- ${item}`).join("\n")}` : "",
    answer.references.length ? `FONTES\n${answer.references.map((reference) => `- ${reference.sourceName}${reference.speakerLabel ? `, ${reference.speakerLabel}` : ""}${typeof reference.startSeconds === "number" ? `, ${reference.startSeconds}s` : ""}: ${reference.quote}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

export default function AskFilesPanel({ sources, onSpeak, isSpeechLoading }: AskFilesPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskFilesAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setSelectedIds(sources.map((source) => source.sourceId)), [sources]);
  const selectedSources = useMemo(() => sources.filter((source) => selectedIds.includes(source.sourceId)), [selectedIds, sources]);
  const answerText = answer ? formatAnswer(answer) : "";

  async function ask() {
    if (!question.trim() || !selectedSources.length) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ask-files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, sources: selectedSources }) });
      const payload = (await response.json()) as { ok?: boolean; result?: AskFilesAnswer; error?: string };
      if (!response.ok || !payload.ok || !payload.result) throw new Error(payload.error || "Não foi possível responder à pergunta.");
      setAnswer(payload.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível responder à pergunta.");
    } finally { setIsLoading(false); }
  }

  async function downloadDocx() {
    if (!answer) return;
    const blob = await buildDocxBlob({ fileTitle: "Pergunta sobre os arquivos - Leste Audio IA", sections: [{ title: "Pergunta", content: question }, { title: "Resposta com fontes", content: answerText }] });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "pergunta-arquivos-leste-audio-ia.docx"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="space-y-4 rounded-xl border border-blue-100 bg-white p-4 shadow-editorial sm:p-6"><div><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Search className="h-5 w-5 text-leste-blue" /> Perguntar sobre os arquivos</h2><p className="mt-1 text-sm leading-6 text-slate-600">A resposta usa apenas as fontes selecionadas e aponta os trechos que sustentam cada conclusão.</p></div>
    {!sources.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Envie ou transcreva ao menos um arquivo para fazer perguntas sobre ele.</p> : <><div className="grid gap-2 md:grid-cols-2">{sources.map((source) => <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm" key={source.sourceId}><input checked={selectedIds.includes(source.sourceId)} className="mt-1" onChange={() => setSelectedIds((current) => current.includes(source.sourceId) ? current.filter((id) => id !== source.sourceId) : [...current, source.sourceId])} type="checkbox" /><span><strong className="block text-slate-900">{source.sourceName}</strong><span className="text-xs text-slate-500">{source.sourceType} · {source.chunks.length} trecho(s)</span></span></label>)}</div><textarea className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-leste-blue" onChange={(event) => setQuestion(event.target.value)} placeholder="Ex.: Quais decisões e prazos foram citados?" value={question} /><ActionButton disabled={!question.trim() || !selectedSources.length} fullWidth loading={isLoading} onClick={() => void ask()} type="button" variant="primary"><Send className="h-4 w-4" /> Perguntar às fontes selecionadas</ActionButton></>}
    {error ? <ErrorBox message={error} /> : null}
    {answer ? <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4"><div className="flex flex-wrap gap-2"><ActionButton fullWidth={false} onClick={() => void copyToClipboard(answerText)} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar resposta</ActionButton><ActionButton fullWidth={false} onClick={() => void downloadDocx()} type="button" variant="ghost"><Download className="h-4 w-4" /> Baixar DOCX</ActionButton><ActionButton fullWidth={false} onClick={() => onSpeak("review:pergunta-arquivos", "Resposta sobre os arquivos", answerText)} type="button" variant="secondary"><Headphones className="h-4 w-4" /> Ouvir com a Milena</ActionButton></div><textarea className="min-h-56 w-full rounded-lg border border-blue-100 bg-white p-3 text-sm leading-6" readOnly value={answerText} /><NarrationReviewPanel isSpeechLoading={isSpeechLoading} onSpeak={onSpeak} sourceKey="pergunta-arquivos" text={answerText} title="Resposta sobre os arquivos" /></div> : null}
  </section>;
}
