"use client";

import { BookAudio, Download, Loader2, Pause, Play, Square, Wand2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import type { PdfAudiobook } from "@/lib/audiobook";
import type { NarrationPrepMode } from "@/types/audio";

type PdfAudiobookPanelProps = {
  activeSpeechKey: string | null;
  audiobook: PdfAudiobook;
  onCancelGeneration: () => void;
  onDownloadChapter: (chapterId: string, title: string) => void;
  onDownloadFull: () => void;
  onGenerateAll: () => void;
  onGenerateChapter: (chapterId: string) => void;
  onPrepare: (mode: NarrationPrepMode) => void;
  onStopSpeech: () => void;
  speechAudioUrls: Record<string, string | undefined>;
};

function getSpeechKey(chapterId: string) {
  return `pdf-audiobook:${chapterId}`;
}

export default function PdfAudiobookPanel({
  activeSpeechKey,
  audiobook,
  onCancelGeneration,
  onDownloadChapter,
  onDownloadFull,
  onGenerateAll,
  onGenerateChapter,
  onPrepare,
  onStopSpeech,
  speechAudioUrls,
}: PdfAudiobookPanelProps) {
  const completed = audiobook.chapters.filter((chapter) => chapter.status === "done").length;
  const total = audiobook.chapters.length;
  const allGenerated = total > 0 && completed === total;
  const totalMinutes = audiobook.chapters.reduce((sum, chapter) => sum + chapter.estimatedMinutes, 0);

  return (
    <section className="space-y-4 rounded-lg border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
            <BookAudio className="h-5 w-5 text-rose-600" />
            Audiolivro com a Milena
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            O livro é dividido em capítulos para gerar, ouvir, pausar e baixar MP3s sem travar a tela.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700 shadow-sm">
          ~{totalMinutes} min | {total} capítulos
        </span>
      </div>

      <div className="rounded-lg border border-white bg-white/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preparar narração</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["fiel", "natural", "adaptada"] as const).map((mode) => (
            <ActionButton
              fullWidth={false}
              key={mode}
              loading={audiobook.isPreparing && audiobook.mode === mode}
              onClick={() => onPrepare(mode)}
              type="button"
              variant={audiobook.mode === mode ? "secondary" : "ghost"}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {mode === "fiel" ? "Leitura fiel" : mode === "natural" ? "Leitura natural" : "Adaptar para ouvir"}
            </ActionButton>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Fonte atual: {audiobook.source === "prepared" ? "texto preparado para narração" : "texto extraído do documento"}.
        </p>
      </div>

      {audiobook.error ? <ErrorBox message={audiobook.error} /> : null}

      <div className="rounded-lg border border-rose-100 bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">Geração do audiolivro</p>
            <p className="text-xs text-slate-500">{completed} de {total} capítulos prontos</p>
          </div>
          <div className="grid gap-2 sm:flex">
            <ActionButton
              className="sm:w-auto"
              disabled={!total || audiobook.isPreparing}
              fullWidth
              loading={audiobook.isGenerating}
              onClick={onGenerateAll}
              type="button"
              variant="primary"
            >
              <Play className="h-4 w-4" />
              Gerar todos em MP3
            </ActionButton>
            {audiobook.isGenerating ? (
              <ActionButton className="sm:w-auto" fullWidth onClick={onCancelGeneration} type="button" variant="ghost">
                <Square className="h-4 w-4" />
                Cancelar fila
              </ActionButton>
            ) : null}
            <ActionButton
              className="sm:w-auto"
              disabled={!allGenerated}
              fullWidth
              onClick={onDownloadFull}
              type="button"
              variant="secondary"
            >
              <Download className="h-4 w-4" />
              Baixar audiobook completo
            </ActionButton>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-100">
          <div
            className="h-full rounded-full bg-rose-500 transition-all"
            style={{ width: `${total ? Math.round((completed / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
        {audiobook.chapters.map((chapter, index) => {
          const speechKey = getSpeechKey(chapter.id);
          const url = speechAudioUrls[speechKey];
          const isActive = activeSpeechKey === speechKey;

          return (
            <article className="rounded-lg border border-slate-200 bg-white p-3" key={chapter.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{index + 1}. {chapter.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {chapter.wordCount.toLocaleString("pt-BR")} palavras | ~{chapter.estimatedMinutes} min
                  </p>
                </div>
                <div className="grid gap-2 sm:flex">
                  <ActionButton
                    className="sm:w-auto"
                    disabled={audiobook.isGenerating || chapter.status === "generating"}
                    fullWidth
                    loading={chapter.status === "generating"}
                    onClick={() => onGenerateChapter(chapter.id)}
                    type="button"
                    variant={url ? "ghost" : "secondary"}
                  >
                    {chapter.status === "generating" ? <Loader2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {url ? "Gerar novamente" : "Gerar MP3"}
                  </ActionButton>
                  {url ? (
                    <ActionButton
                      className="sm:w-auto"
                      fullWidth
                      onClick={() => onDownloadChapter(chapter.id, chapter.title)}
                      type="button"
                      variant="ghost"
                    >
                      <Download className="h-4 w-4" />
                      Baixar
                    </ActionButton>
                  ) : null}
                  {isActive ? (
                    <ActionButton className="sm:w-auto" fullWidth onClick={onStopSpeech} type="button" variant="ghost">
                      <Pause className="h-4 w-4" />
                      Parar
                    </ActionButton>
                  ) : null}
                </div>
              </div>
              {url ? (
                <audio autoPlay={isActive} className="mt-3 w-full" controls preload="metadata" src={url}>
                  Seu navegador não suporta reprodução de áudio.
                </audio>
              ) : null}
              {chapter.status === "error" ? (
                <p className="mt-2 text-xs font-medium text-red-600">Falha ao gerar este capítulo. Tente novamente.</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
