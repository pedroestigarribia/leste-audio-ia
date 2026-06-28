"use client";

import { Copy, FileAudio2, RefreshCcw, Sparkles, Trash2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import ProgressBar from "@/components/ProgressBar";
import { formatBytes, formatStatusLabel } from "@/lib/format";
import type { AudioItem } from "@/types/audio";

type AudioCardProps = {
  item: AudioItem;
  copiedKey: string | null;
  disableRemove?: boolean;
  disableRetry?: boolean;
  isOrganizeLoading?: boolean;
  isSummaryLoading?: boolean;
  onCopyAll: () => void;
  onCopyOrganized: () => void;
  onCopySummary: () => void;
  onCopyTranscription: () => void;
  onOrganize: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onSummarize: () => void;
  organizeError?: string;
  summaryError?: string;
  showRetry?: boolean;
};

function SectionBlock({
  title,
  value,
  copied,
  copyLabel,
  onCopy,
}: {
  title: string;
  value: string;
  copied: boolean;
  copyLabel: string;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-semibold uppercase text-slate-500">{title}</h4>
        <ActionButton className="sm:w-auto" fullWidth onClick={onCopy} type="button" variant="ghost">
          <Copy className="h-4 w-4" />
          {copied ? "Copiado" : copyLabel}
        </ActionButton>
      </div>
      <textarea
        className="min-h-[160px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
        readOnly
        value={value}
      />
    </div>
  );
}

export default function AudioCard({
  item,
  copiedKey,
  disableRemove = false,
  disableRetry = false,
  isOrganizeLoading = false,
  isSummaryLoading = false,
  onCopyAll,
  onCopyOrganized,
  onCopySummary,
  onCopyTranscription,
  onOrganize,
  onRemove,
  onRetry,
  onSummarize,
  organizeError,
  summaryError,
  showRetry = false,
}: AudioCardProps) {
  return (
    <article className="space-y-5 rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-leste-blue">
            <FileAudio2 className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-slate-950">{item.name}</h3>
              <span className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-leste-blue">
                {item.extension.toUpperCase() || "AUDIO"}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              {formatBytes(item.size)} • {formatStatusLabel(item.status)}
            </p>
          </div>
        </div>

        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
          {showRetry ? (
            <ActionButton disabled={disableRetry} fullWidth onClick={onRetry} type="button" variant="ghost">
              <RefreshCcw className="h-4 w-4" />
              Tentar novamente
            </ActionButton>
          ) : null}
          <ActionButton disabled={disableRemove} fullWidth onClick={onRemove} type="button" variant="danger">
            <Trash2 className="h-4 w-4" />
            Remover
          </ActionButton>
        </div>
      </div>

      <ProgressBar value={item.progress} />

      {item.error ? <ErrorBox message={item.error} /> : null}

      {item.transcription ? (
        <div className="space-y-4">
          <SectionBlock
            copied={copiedKey === `transcription:${item.id}`}
            copyLabel="Copiar transcrição"
            onCopy={onCopyTranscription}
            title="Transcrição"
            value={item.transcription}
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ActionButton fullWidth loading={isSummaryLoading} onClick={onSummarize} type="button" variant="secondary">
              <Sparkles className="h-4 w-4" />
              Resumir este áudio
            </ActionButton>
            <ActionButton fullWidth loading={isOrganizeLoading} onClick={onOrganize} type="button" variant="ghost">
              <Sparkles className="h-4 w-4" />
              Organizar este áudio
            </ActionButton>
            <ActionButton fullWidth onClick={onCopyAll} type="button" variant="ghost">
              <Copy className="h-4 w-4" />
              {copiedKey === `audio:${item.id}` ? "Copiado" : "Copiar conteúdo deste áudio"}
            </ActionButton>
          </div>
        </div>
      ) : null}

      {summaryError ? <ErrorBox message={summaryError} /> : null}
      {item.summary ? (
        <SectionBlock
          copied={copiedKey === `summary:${item.id}`}
          copyLabel="Copiar resumo"
          onCopy={onCopySummary}
          title="Resumo"
          value={item.summary}
        />
      ) : null}

      {organizeError ? <ErrorBox message={organizeError} /> : null}
      {item.organizedText ? (
        <SectionBlock
          copied={copiedKey === `organized:${item.id}`}
          copyLabel="Copiar organizado"
          onCopy={onCopyOrganized}
          title="Conteúdo organizado"
          value={item.organizedText}
        />
      ) : null}
    </article>
  );
}
