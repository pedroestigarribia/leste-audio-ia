"use client";

import { Copy, Download, Headphones, MessageSquareText, Sparkles, Volume2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";

type GeneralResultKey = "summary" | "organized" | "analysis" | "tasks" | "keyData" | "reply";

type ResultPanelProps = {
  activeSpeechKey: string | null;
  copiedKey: string | null;
  generalAnalysis: string;
  generalKeyData: string;
  generalOrganizedText: string;
  generalReply: string;
  generalSummary: string;
  generalTasks: string;
  hasTranscriptions: boolean;
  isAnalyzeLoading: boolean;
  isKeyDataLoading: boolean;
  isOrganizeLoading: boolean;
  isReplyLoading: boolean;
  isSummaryLoading: boolean;
  isTasksLoading: boolean;
  speechAudioUrls: Record<string, string | undefined>;
  speechAudioTypes: Record<string, string | undefined>;
  speechErrors: Partial<Record<GeneralResultKey, string>>;
  speechLoadingMap: Partial<Record<GeneralResultKey, boolean>>;
  onAnalyzeAll: () => void;
  onCopyAll: () => void;
  onCopyAnalysis: () => void;
  onCopyKeyData: () => void;
  onCopyOrganized: () => void;
  onCopyReply: () => void;
  onCopySummary: () => void;
  onCopyTasks: () => void;
  onDownloadOrganizedDocx: () => void;
  onDownloadOrganizedTxt: () => void;
  onDownloadSpeech: (key: string, label: string) => void;
  onExtractKeyData: () => void;
  onExtractTasks: () => void;
  onGenerateReply: () => void;
  onOrganizeAll: () => void;
  onSpeakResult: (key: GeneralResultKey, title: string, text: string) => void;
  onStopSpeech: () => void;
  onSummarizeAll: () => void;
  previewItems: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  taskErrors: {
    analysis?: string;
    keyData?: string;
    organize?: string;
    reply?: string;
    summary?: string;
    tasks?: string;
  };
};

function ResultSection({
  title,
  value,
  copyLabel,
  copied,
  onCopy,
  onSpeak,
  speechError,
  speechKey,
  speechLoading,
}: {
  title: string;
  value: string;
  copyLabel: string;
  copied: boolean;
  onCopy: () => void;
  onSpeak: (key: GeneralResultKey, title: string, text: string) => void;
  speechError?: string;
  speechKey: GeneralResultKey;
  speechLoading?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold uppercase text-slate-500">{title}</h3>
        <div className="grid gap-2 sm:flex sm:items-center sm:justify-end">
          <ActionButton
            className="sm:w-auto"
            fullWidth
            loading={speechLoading}
            onClick={() => onSpeak(speechKey, title, value)}
            type="button"
            variant="secondary"
          >
            <Volume2 className="h-4 w-4" />
            Ouvir com Milena
          </ActionButton>
          <ActionButton className="sm:w-auto" fullWidth onClick={onCopy} type="button" variant="ghost">
            <Copy className="h-4 w-4" />
            {copied ? "Copiado" : copyLabel}
          </ActionButton>
        </div>
      </div>
      <textarea
        className="min-h-[200px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
        readOnly
        value={value}
      />
      {speechError ? <ErrorBox message={speechError} /> : null}
    </div>
  );
}

function AudioPlaylist({
  items,
}: {
  items: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-leste-blue">
          <Headphones className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase text-slate-500">
            Ouvir áudios da sessão
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Você pode escutar cada arquivo aqui enquanto consulta a organização geral.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <div
            className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            key={item.id}
          >
            <p className="mb-3 line-clamp-2 text-sm font-semibold text-slate-800">{item.name}</p>
            <audio className="w-full" controls preload="metadata" src={item.url}>
              Seu navegador não suporta reprodução de áudio.
            </audio>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpeechQuickActions({
  activeSpeechKey,
  results,
  speechAudioTypes,
  speechAudioUrls,
  speechLoadingMap,
  onDownloadSpeech,
  onSpeak,
  onStopSpeech,
}: {
  activeSpeechKey: string | null;
  results: Array<{
    key: GeneralResultKey;
    label: string;
    text: string;
  }>;
  speechAudioTypes: Record<string, string | undefined>;
  speechAudioUrls: Record<string, string | undefined>;
  speechLoadingMap: Partial<Record<GeneralResultKey, boolean>>;
  onDownloadSpeech: (key: string, label: string) => void;
  onSpeak: (key: GeneralResultKey, title: string, text: string) => void;
  onStopSpeech: () => void;
}) {
  const hasAnyResult = results.some((result) => result.text.trim());
  const activeResult = results.find((result) => result.key === activeSpeechKey);
  const activeUrl = activeResult ? speechAudioUrls[activeResult.key] : undefined;
  const activeContentType = activeResult ? speechAudioTypes[activeResult.key] : undefined;
  const activeExtension =
    activeContentType?.includes("mpeg") || activeContentType?.includes("mp3") ? "MP3" : "WAV";

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase text-leste-blue">
            Leitura com voz IA
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            A Milena lê os textos gerados pela IA. Use o player para pausar e o botão Parar para encerrar.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold uppercase text-slate-500">
          <Volume2 className="h-4 w-4 text-leste-blue" />
          Milena
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((result) => {
          const hasText = Boolean(result.text.trim());
          const hasAudio = Boolean(speechAudioUrls[result.key]);

          return (
            <ActionButton
              disabled={!hasText}
              fullWidth
              key={result.key}
              loading={speechLoadingMap[result.key]}
              onClick={() => onSpeak(result.key, result.label, result.text)}
              type="button"
              variant={hasText ? "secondary" : "ghost"}
            >
              <Volume2 className="h-4 w-4" />
              {hasAudio ? `Ouvir de novo: ${result.label}` : `Ouvir ${result.label}`}
            </ActionButton>
          );
        })}
      </div>

      {!hasAnyResult ? (
        <p className="mt-3 text-xs text-slate-500">
          Os botões ficam disponíveis quando algum texto geral for gerado.
        </p>
      ) : null}

      {activeResult && activeUrl ? (
        <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-white p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Milena lendo: {activeResult.label}
            </p>
            <div className="grid gap-2 sm:flex">
              <ActionButton className="sm:w-auto" fullWidth onClick={onStopSpeech} type="button" variant="ghost">
                Parar
              </ActionButton>
              <ActionButton
                className="sm:w-auto"
                fullWidth
                onClick={() => onDownloadSpeech(activeResult.key, activeResult.label)}
                type="button"
                variant="secondary"
              >
                Baixar {activeExtension}
              </ActionButton>
            </div>
          </div>
          <audio autoPlay className="w-full" controls src={activeUrl}>
            Seu navegador não suporta reprodução de áudio.
          </audio>
        </div>
      ) : null}
    </div>
  );
}

export default function ResultPanel({
  activeSpeechKey,
  copiedKey,
  generalAnalysis,
  generalKeyData,
  generalOrganizedText,
  generalReply,
  generalSummary,
  generalTasks,
  hasTranscriptions,
  isAnalyzeLoading,
  isKeyDataLoading,
  isOrganizeLoading,
  isReplyLoading,
  isSummaryLoading,
  isTasksLoading,
  speechAudioUrls,
  speechAudioTypes,
  speechErrors,
  speechLoadingMap,
  onAnalyzeAll,
  onCopyAll,
  onCopyAnalysis,
  onCopyKeyData,
  onCopyOrganized,
  onCopyReply,
  onCopySummary,
  onCopyTasks,
  onDownloadOrganizedDocx,
  onDownloadOrganizedTxt,
  onDownloadSpeech,
  onExtractKeyData,
  onExtractTasks,
  onGenerateReply,
  onOrganizeAll,
  onSpeakResult,
  onStopSpeech,
  onSummarizeAll,
  previewItems,
  taskErrors,
}: ResultPanelProps) {
  const speechResults = [
    { key: "summary" as const, label: "resumo geral", text: generalSummary },
    { key: "organized" as const, label: "organização geral", text: generalOrganizedText },
    { key: "analysis" as const, label: "interpretação geral", text: generalAnalysis },
    { key: "tasks" as const, label: "tarefas", text: generalTasks },
    { key: "keyData" as const, label: "dados-chave", text: generalKeyData },
    { key: "reply" as const, label: "resposta WhatsApp", text: generalReply },
  ];

  return (
    <section className="space-y-5 rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-6">
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Painel geral</h2>
          <p className="mt-2 text-sm text-slate-600">
            Resuma, organize, interprete, extraia tarefas, mapeie dados-chave e gere resposta para
            WhatsApp a partir de todas as transcrições.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ActionButton
            disabled={!hasTranscriptions}
            fullWidth
            loading={isSummaryLoading}
            onClick={onSummarizeAll}
            type="button"
            variant="secondary"
          >
            <Sparkles className="h-4 w-4" />
            Resumir todos
          </ActionButton>
          <ActionButton
            disabled={!hasTranscriptions}
            fullWidth
            loading={isOrganizeLoading}
            onClick={onOrganizeAll}
            type="button"
            variant="ghost"
          >
            <Sparkles className="h-4 w-4" />
            Organizar todos
          </ActionButton>
          <ActionButton
            disabled={!hasTranscriptions}
            fullWidth
            loading={isAnalyzeLoading}
            onClick={onAnalyzeAll}
            type="button"
            variant="primary"
          >
            <Sparkles className="h-4 w-4" />
            Interpretar todos
          </ActionButton>
          <ActionButton
            disabled={!hasTranscriptions}
            fullWidth
            loading={isTasksLoading}
            onClick={onExtractTasks}
            type="button"
            variant="ghost"
          >
            <Sparkles className="h-4 w-4" />
            Extrair tarefas
          </ActionButton>
          <ActionButton
            disabled={!hasTranscriptions}
            fullWidth
            loading={isKeyDataLoading}
            onClick={onExtractKeyData}
            type="button"
            variant="ghost"
          >
            <Sparkles className="h-4 w-4" />
            Mapear dados-chave
          </ActionButton>
          <ActionButton
            disabled={!hasTranscriptions}
            fullWidth
            loading={isReplyLoading}
            onClick={onGenerateReply}
            type="button"
            variant="ghost"
          >
            <MessageSquareText className="h-4 w-4" />
            Gerar resposta WhatsApp
          </ActionButton>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ActionButton disabled={!hasTranscriptions} fullWidth onClick={onCopyAll} type="button" variant="ghost">
            <Copy className="h-4 w-4" />
            {copiedKey === "all" ? "Copiado" : "Copiar tudo da sessão"}
          </ActionButton>
          <ActionButton
            disabled={!hasTranscriptions}
            fullWidth
            onClick={onDownloadOrganizedTxt}
            type="button"
            variant="ghost"
          >
            <Download className="h-4 w-4" />
            Baixar organizado TXT
          </ActionButton>
          <ActionButton
            disabled={!hasTranscriptions}
            fullWidth
            onClick={onDownloadOrganizedDocx}
            type="button"
            variant="ghost"
          >
            <Download className="h-4 w-4" />
            Baixar organizado DOCX
          </ActionButton>
        </div>
      </div>

      <SpeechQuickActions
        activeSpeechKey={activeSpeechKey}
        onDownloadSpeech={onDownloadSpeech}
        onSpeak={onSpeakResult}
        onStopSpeech={onStopSpeech}
        results={speechResults}
        speechAudioTypes={speechAudioTypes}
        speechAudioUrls={speechAudioUrls}
        speechLoadingMap={speechLoadingMap}
      />

      {!generalSummary &&
      !generalOrganizedText &&
      !generalAnalysis &&
      !generalTasks &&
      !generalKeyData &&
      !generalReply ? (
        <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 px-5 py-6 text-sm text-slate-600">
          Os resultados gerais aparecem aqui depois que houver transcrições prontas.
        </div>
      ) : null}

      <AudioPlaylist items={previewItems} />

      {taskErrors.summary ? <ErrorBox message={taskErrors.summary} /> : null}
      {generalSummary ? (
        <ResultSection
          copied={copiedKey === "general-summary"}
          copyLabel="Copiar resumo geral"
          onCopy={onCopySummary}
          onSpeak={onSpeakResult}
          speechError={speechErrors.summary}
          speechKey="summary"
          speechLoading={speechLoadingMap.summary}
          title="Resumo geral"
          value={generalSummary}
        />
      ) : null}

      {taskErrors.organize ? <ErrorBox message={taskErrors.organize} /> : null}
      {generalOrganizedText ? (
        <ResultSection
          copied={copiedKey === "general-organized"}
          copyLabel="Copiar organização geral"
          onCopy={onCopyOrganized}
          onSpeak={onSpeakResult}
          speechError={speechErrors.organized}
          speechKey="organized"
          speechLoading={speechLoadingMap.organized}
          title="Organização geral"
          value={generalOrganizedText}
        />
      ) : null}

      {taskErrors.analysis ? <ErrorBox message={taskErrors.analysis} /> : null}
      {generalAnalysis ? (
        <ResultSection
          copied={copiedKey === "general-analysis"}
          copyLabel="Copiar interpretação geral"
          onCopy={onCopyAnalysis}
          onSpeak={onSpeakResult}
          speechError={speechErrors.analysis}
          speechKey="analysis"
          speechLoading={speechLoadingMap.analysis}
          title="Interpretação geral"
          value={generalAnalysis}
        />
      ) : null}

      {taskErrors.tasks ? <ErrorBox message={taskErrors.tasks} /> : null}
      {generalTasks ? (
        <ResultSection
          copied={copiedKey === "general-tasks"}
          copyLabel="Copiar tarefas"
          onCopy={onCopyTasks}
          onSpeak={onSpeakResult}
          speechError={speechErrors.tasks}
          speechKey="tasks"
          speechLoading={speechLoadingMap.tasks}
          title="Tarefas e pendências"
          value={generalTasks}
        />
      ) : null}

      {taskErrors.keyData ? <ErrorBox message={taskErrors.keyData} /> : null}
      {generalKeyData ? (
        <ResultSection
          copied={copiedKey === "general-keyData"}
          copyLabel="Copiar dados-chave"
          onCopy={onCopyKeyData}
          onSpeak={onSpeakResult}
          speechError={speechErrors.keyData}
          speechKey="keyData"
          speechLoading={speechLoadingMap.keyData}
          title="Dados-chave"
          value={generalKeyData}
        />
      ) : null}

      {taskErrors.reply ? <ErrorBox message={taskErrors.reply} /> : null}
      {generalReply ? (
        <ResultSection
          copied={copiedKey === "general-reply"}
          copyLabel="Copiar resposta WhatsApp"
          onCopy={onCopyReply}
          onSpeak={onSpeakResult}
          speechError={speechErrors.reply}
          speechKey="reply"
          speechLoading={speechLoadingMap.reply}
          title="Resposta pronta para WhatsApp"
          value={generalReply}
        />
      ) : null}
    </section>
  );
}
