"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, FileAudio2, Headphones, Loader2, Play, RefreshCcw, Sparkles, Trash2, Volume2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import AudioIntelligencePanel from "@/components/AudioIntelligencePanel";
import ErrorBox from "@/components/ErrorBox";
import ProgressBar from "@/components/ProgressBar";
import TranscriptTimeline from "@/components/TranscriptTimeline";
import { formatBytes, formatStatusLabel } from "@/lib/format";
import type { AudioContentKind, AudioItem, AutoDetectedIntent } from "@/types/audio";

type AudioCardProps = {
  activeSpeechKey: string | null;
  audioPreviewUrl?: string;
  item: AudioItem;
  copiedKey: string | null;
  disableRemove?: boolean;
  disableRetry?: boolean;
  isOrganizeLoading?: boolean;
  isSummaryLoading?: boolean;
  isOrganizedSpeechLoading?: boolean;
  isSummarySpeechLoading?: boolean;
  isAudioIntelligenceLoading?: boolean;
  isAutoProcessing?: boolean;
  loadingAudioContentKind?: AudioContentKind;
  onAnalyzeAudio: () => void;
  onCopyAll: () => void;
  onCopyOrganized: () => void;
  onCopySummary: () => void;
  onCopyTranscription: () => void;
  onCopy: (key: string, text: string) => void;
  onDownloadDocx: () => void;
  onDownloadSpeech: (key: string, label: string) => void;
  onExecutePrompt: (prompt: string) => Promise<string>;
  onOrganize: () => void;
  onGenerateAudioContent: (kind: AudioContentKind) => void;
  onRemove: () => void;
  onRetry: () => void;
  onSummarize: () => void;
  onRenameSpeaker: (speakerId: string, label: string) => void;
  onSpeakAdvanced: (key: string, title: string, text: string) => void;
  onStopSpeech: () => void;
  speechAudioUrls: Record<string, string | undefined>;
  speechErrors: Record<string, string | undefined>;
  audioIntelligenceError?: string;
  contentError?: string;
  intentError?: string;
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
  voice,
}: {
  title: string;
  value: string;
  copied: boolean;
  copyLabel: string;
  onCopy: () => void;
  voice?: {
    audioUrl?: string;
    error?: string;
    isActive: boolean;
    isLoading: boolean;
    onDownload: () => void;
    onSpeak: () => void;
    onStop: () => void;
  };
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-semibold uppercase text-slate-500">{title}</h4>
        <div className="grid gap-2 sm:flex sm:items-center">
          {voice ? (
            <ActionButton
              className="sm:w-auto"
              fullWidth
              loading={voice.isLoading}
              onClick={voice.onSpeak}
              type="button"
              variant="secondary"
            >
              <Volume2 className="h-4 w-4" />
              {voice.audioUrl ? "Ouvir com a Milena" : "Transformar em áudio"}
            </ActionButton>
          ) : null}
          <ActionButton className="sm:w-auto" fullWidth onClick={onCopy} type="button" variant="ghost">
            <Copy className="h-4 w-4" />
            {copied ? "Copiado" : copyLabel}
          </ActionButton>
        </div>
      </div>
      <textarea
        className="min-h-[160px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
        readOnly
        value={value}
      />
      {voice?.error ? <ErrorBox message={voice.error} /> : null}
      {voice?.audioUrl ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Headphones className="h-4 w-4 text-leste-blue" />
              Leitura com voz da Milena
            </span>
            <div className="flex gap-2">
              {voice.isActive ? (
                <ActionButton fullWidth={false} onClick={voice.onStop} type="button" variant="ghost">
                  Pausar / parar
                </ActionButton>
              ) : null}
              <ActionButton fullWidth={false} onClick={voice.onDownload} type="button" variant="ghost">
                <Download className="h-4 w-4" />
                Baixar MP3
              </ActionButton>
            </div>
          </div>
          <MilenaAudioPlayer isActive={voice.isActive} url={voice.audioUrl} />
        </div>
      ) : null}
    </div>
  );
}

function MilenaAudioPlayer({ isActive, url }: { isActive: boolean; url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (isActive) {
      void audio.play().catch(() => {
        // Native controls remain available when the browser blocks autoplay.
      });
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }, [isActive, url]);

  return <audio className="w-full" controls preload="metadata" ref={audioRef} src={url} />;
}

function IntentDetectedSection({
  intent,
  copiedKey,
  onCopyPrompt,
  onExecutePrompt,
}: {
  intent: AutoDetectedIntent;
  copiedKey: string | null;
  onCopyPrompt: (key: string, text: string) => void;
  onExecutePrompt: (prompt: string) => Promise<string>;
}) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  const hasPrompt = Boolean(intent.instrucao_convertida?.trim());

  async function handleBuild() {
    setIsExecuting(true);
    setExecuteResult(null);
    setExecuteError(null);

    try {
      const result = await onExecutePrompt(intent.instrucao_convertida);
      setExecuteResult(result);
    } catch (error) {
      setExecuteError(error instanceof Error ? error.message : "Erro ao executar.");
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-leste-blue" />
        <div>
          <h4 className="text-sm font-black uppercase text-slate-900">Intenção detectada</h4>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-md bg-leste-blue px-2 py-0.5 text-xs font-bold text-white">
              {intent.tipo_de_solicitacao}
            </span>
            <span className="text-xs text-slate-500">Confiança: {intent.nivel_de_confianca}%</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-700">{intent.resposta_para_o_usuario}</p>

      {hasPrompt ? (
        <div className="space-y-3">
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            <h5 className="text-xs font-semibold uppercase text-slate-500">Prompt Gerado</h5>
            <textarea
              className="min-h-[180px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
              readOnly
              value={intent.instrucao_convertida}
            />
          </div>

          {intent.informacoes_faltantes.length > 0 ? (
            <div className="rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-700">
              <strong>Informações ausentes:</strong>{" "}
              {intent.informacoes_faltantes.join(", ")}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <ActionButton
              fullWidth
              onClick={() => onCopyPrompt(`auto-prompt`, intent.instrucao_convertida)}
              type="button"
              variant="ghost"
            >
              <Copy className="h-4 w-4" />
              {copiedKey === "auto-prompt" ? "Copiado" : "Copiar Prompt"}
            </ActionButton>
            <ActionButton
              fullWidth
              loading={isExecuting}
              onClick={() => void handleBuild()}
              type="button"
              variant="primary"
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Construir
            </ActionButton>
          </div>

          {executeError ? <ErrorBox message={executeError} /> : null}

          {executeResult ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold uppercase text-slate-500">Resultado</h5>
                <ActionButton
                  fullWidth={false}
                  onClick={() => onCopyPrompt(`auto-result`, executeResult)}
                  type="button"
                  variant="ghost"
                >
                  <Copy className="h-4 w-4" />
                  {copiedKey === "auto-result" ? "Copiado" : "Copiar resultado"}
                </ActionButton>
              </div>
              <textarea
                className="min-h-[180px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
                readOnly
                value={executeResult}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {intent.tipo_de_solicitacao === "identificar intenção"
            ? "A intenção foi identificada. Nenhuma ação automática solicitada."
            : "Conteúdo analisado. Nenhuma ação clara a executar automaticamente."}
        </p>
      )}
    </div>
  );
}

export default function AudioCard({
  activeSpeechKey,
  audioPreviewUrl,
  item,
  copiedKey,
  disableRemove = false,
  disableRetry = false,
  isOrganizeLoading = false,
  isSummaryLoading = false,
  isOrganizedSpeechLoading = false,
  isSummarySpeechLoading = false,
  isAudioIntelligenceLoading = false,
  isAutoProcessing = false,
  loadingAudioContentKind,
  onAnalyzeAudio,
  onCopyAll,
  onCopyOrganized,
  onCopySummary,
  onCopyTranscription,
  onCopy,
  onDownloadDocx,
  onDownloadSpeech,
  onExecutePrompt,
  onOrganize,
  onGenerateAudioContent,
  onRemove,
  onRetry,
  onSummarize,
  onRenameSpeaker,
  onSpeakAdvanced,
  onStopSpeech,
  speechAudioUrls,
  speechErrors,
  audioIntelligenceError,
  contentError,
  intentError,
  organizeError,
  summaryError,
  showRetry = false,
}: AudioCardProps) {
  return (
    <article className="space-y-5 rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5" id={`audio-card-${item.id}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-leste-blue">
            <FileAudio2 className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-slate-950">{item.name}</h3>
              <span className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-leste-blue">
                {item.extension.toUpperCase() || "ÁUDIO"}
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

      {audioPreviewUrl ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Áudio original</p>
            <a
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-leste-blue transition hover:border-leste-blue hover:bg-blue-50"
              download={item.name}
              href={audioPreviewUrl}
            >
              <Download className="h-3.5 w-3.5" />
              Baixar áudio
            </a>
          </div>
          <audio className="w-full" controls preload="metadata" src={audioPreviewUrl}>
            Seu navegador não suporta reprodução de áudio.
          </audio>
        </div>
      ) : null}

      <ProgressBar value={item.progress} />

      {item.error ? <ErrorBox message={item.error} /> : null}

      {item.transcription ? (
        <div className="space-y-4">
          <TranscriptTimeline
            audioUrl={audioPreviewUrl}
            onRenameSpeaker={onRenameSpeaker}
            segments={item.segments ?? []}
            speakers={item.speakers ?? []}
          />
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
            <ActionButton fullWidth onClick={() => void onDownloadDocx()} type="button" variant="ghost">
              <Download className="h-4 w-4" />
              Baixar resultado completo DOCX
            </ActionButton>
          </div>
          {isAutoProcessing ? (
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950" role="status">
              Transcrição concluída. A IA está gerando automaticamente resumo, organização, interpretação e intenção deste áudio.
            </p>
          ) : null}
        </div>
      ) : null}

      {item.autoDetectedIntent ? (
        <IntentDetectedSection
          copiedKey={copiedKey}
          intent={item.autoDetectedIntent}
          onCopyPrompt={(key, text) => {
            void navigator.clipboard.writeText(text);
          }}
          onExecutePrompt={onExecutePrompt}
        />
      ) : null}

      {item.transcription ? (
        <AudioIntelligencePanel
          activeSpeechKey={activeSpeechKey}
          analysis={item.audioIntelligence}
          copiedKey={copiedKey}
          contentError={contentError}
          generatedContents={item.generatedContents}
          isAnalyzing={isAudioIntelligenceLoading}
          itemId={item.id}
          loadingContentKind={loadingAudioContentKind}
          onAnalyze={onAnalyzeAudio}
          onCopy={onCopy}
          onDownloadDocx={onDownloadDocx}
          onDownloadSpeech={onDownloadSpeech}
          onGenerateContent={onGenerateAudioContent}
          onSpeak={onSpeakAdvanced}
          onStopSpeech={onStopSpeech}
          speechAudioUrls={speechAudioUrls}
          speechErrors={speechErrors}
          taskError={audioIntelligenceError}
        />
      ) : null}

      {summaryError ? <ErrorBox message={summaryError} /> : null}
      {item.summary ? (
        <SectionBlock
          copied={copiedKey === `summary:${item.id}`}
          copyLabel="Copiar resumo"
          onCopy={onCopySummary}
          title="Resumo"
          value={item.summary}
          voice={{
            audioUrl: speechAudioUrls[`advanced:${item.id}:summary`],
            error: speechErrors[`advanced:${item.id}:summary`],
            isActive: activeSpeechKey === `advanced:${item.id}:summary`,
            isLoading: isSummarySpeechLoading,
            onDownload: () => onDownloadSpeech(`advanced:${item.id}:summary`, `resumo-${item.name}`),
            onSpeak: () => onSpeakAdvanced(`advanced:${item.id}:summary`, `Resumo de ${item.name}`, item.summary!),
            onStop: onStopSpeech,
          }}
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
          voice={{
            audioUrl: speechAudioUrls[`advanced:${item.id}:organized`],
            error: speechErrors[`advanced:${item.id}:organized`],
            isActive: activeSpeechKey === `advanced:${item.id}:organized`,
            isLoading: isOrganizedSpeechLoading,
            onDownload: () => onDownloadSpeech(`advanced:${item.id}:organized`, `organizado-${item.name}`),
            onSpeak: () => onSpeakAdvanced(`advanced:${item.id}:organized`, `Conteúdo organizado de ${item.name}`, item.organizedText!),
            onStop: onStopSpeech,
          }}
        />
      ) : null}
      {intentError ? <ErrorBox message={intentError} /> : null}
    </article>
  );
}
