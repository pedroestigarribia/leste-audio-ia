"use client";

import { Copy, Download, Headphones, MessageSquareText, Sparkles, Wand2, Volume2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import type { PromptTransformFormat } from "@/types/audio";

type GeneralResultKey = "summary" | "organized" | "analysis" | "tasks" | "keyData" | "reply" | "intent";

type ResultPanelProps = {
  activeSpeechKey: string | null;
  copiedKey: string | null;
  generalAnalysis: string;
  generalIntent: string;
  generalKeyData: string;
  generalOrganizedText: string;
  generalReply: string;
  generalSummary: string;
  generalTasks: string;
  hasPromptSource: boolean;
  hasTranscriptions: boolean;
  isAnalyzeLoading: boolean;
  isCompleteAnalysisLoading: boolean;
  isIntentLoading: boolean;
  isKeyDataLoading: boolean;
  isOrganizeLoading: boolean;
  isPromptLoading: boolean;
  isReplyLoading: boolean;
  isSummaryLoading: boolean;
  isTasksLoading: boolean;
  promptResult: string;
  speechAudioUrls: Record<string, string | undefined>;
  speechAudioTypes: Record<string, string | undefined>;
  speechErrors: Partial<Record<GeneralResultKey, string>>;
  speechLoadingMap: Partial<Record<GeneralResultKey, boolean>>;
  onAnalyzeAll: () => void;
  onCopyAll: () => void;
  onCopyAllTranscriptions: () => void;
  onCopyAnalysis: () => void;
  onCopyIntent: () => void;
  onCopyKeyData: () => void;
  onCopyOrganized: () => void;
  onCopyPrompt: () => void;
  onCopyReply: () => void;
  onCopySummary: () => void;
  onCopyTasks: () => void;
  onDownloadOrganizedDocx: () => void;
  onDownloadOrganizedTxt: () => void;
  onDownloadSpeech: (key: string, label: string) => void;
  onDetectIntentAll: () => void;
  onExtractKeyData: () => void;
  onExtractTasks: () => void;
  onGenerateCompleteAnalysis: () => void;
  onGenerateReply: () => void;
  onOrganizeAll: () => void;
  onSpeakResult: (key: GeneralResultKey, title: string, text: string) => void;
  onStopSpeech: () => void;
  onSummarizeAll: () => void;
  onTransformToPrompt: (format: PromptTransformFormat) => void;
  previewItems: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  taskErrors: {
    analysis?: string;
    intent?: string;
    keyData?: string;
    organize?: string;
    reply?: string;
    summary?: string;
    tasks?: string;
    prompt?: string;
  };
};

const promptFormats: Array<{
  description: string;
  format: PromptTransformFormat;
  label: string;
}> = [
  {
    description: "Para produto completo com requisitos, fluxos, telas e critérios de aceite.",
    format: "app",
    label: "Prompt para construção de aplicativo",
  },
  {
    description: "Para Next.js, React ou outro app web com frontend, backend, APIs e deploy.",
    format: "webApp",
    label: "Prompt para criação de app web",
  },
  {
    description: "Para página de venda, captação, institucional ou campanha.",
    format: "landingPage",
    label: "Prompt para criação de landing page",
  },
  {
    description: "Para corrigir, evoluir ou refatorar um projeto que já existe.",
    format: "existingProject",
    label: "Prompt para atualização de projeto existente",
  },
];

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

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black uppercase text-leste-blue">
            <Volume2 className="h-4 w-4 text-rose-500" />
            Milena Voz
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Transforme textos, respostas, transcrições, imagens, PDFs e documentos completos em áudio.
            Escolha o conteúdo, prepare a narração, ajuste voz e velocidade, acompanhe pelo player e
            baixe o resultado completo ou dividido por capítulos.
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
                Baixar MP3
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
  generalIntent,
  generalKeyData,
  generalOrganizedText,
  generalReply,
  generalSummary,
  generalTasks,
  hasPromptSource,
  hasTranscriptions,
  isAnalyzeLoading,
  isCompleteAnalysisLoading,
  isIntentLoading,
  isKeyDataLoading,
  isOrganizeLoading,
  isPromptLoading,
  isReplyLoading,
  isSummaryLoading,
  isTasksLoading,
  promptResult,
  speechAudioUrls,
  speechAudioTypes,
  speechErrors,
  speechLoadingMap,
  onAnalyzeAll,
  onCopyAll,
  onCopyAllTranscriptions,
  onCopyAnalysis,
  onCopyIntent,
  onCopyKeyData,
  onCopyOrganized,
  onCopyPrompt,
  onCopyReply,
  onCopySummary,
  onCopyTasks,
  onDownloadOrganizedDocx,
  onDownloadOrganizedTxt,
  onDownloadSpeech,
  onDetectIntentAll,
  onExtractKeyData,
  onExtractTasks,
  onGenerateCompleteAnalysis,
  onGenerateReply,
  onOrganizeAll,
  onSpeakResult,
  onStopSpeech,
  onSummarizeAll,
  onTransformToPrompt,
  previewItems,
  taskErrors,
}: ResultPanelProps) {
  const speechResults = [
    { key: "summary" as const, label: "resumo geral", text: generalSummary },
    { key: "organized" as const, label: "organização geral", text: generalOrganizedText },
    { key: "analysis" as const, label: "interpretação geral", text: generalAnalysis },
    { key: "intent" as const, label: "intenção consolidada", text: generalIntent },
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

        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-black uppercase text-slate-900">Análise completa automática</h3>
              <p className="mt-1 text-sm text-slate-600">
                Gera resumo consolidado, temas, interpretação, tarefas, dados-chave, resposta e intenção geral.
              </p>
            </div>
            <ActionButton
              className="lg:w-auto"
              disabled={!hasTranscriptions}
              fullWidth
              loading={isCompleteAnalysisLoading}
              onClick={onGenerateCompleteAnalysis}
              type="button"
              variant="primary"
            >
              <Wand2 className="h-4 w-4" />
              Gerar análise completa
            </ActionButton>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            loading={isIntentLoading}
            onClick={onDetectIntentAll}
            type="button"
            variant="secondary"
          >
            <Sparkles className="h-4 w-4" />
            Identificar intenção geral
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
            onClick={onCopyAllTranscriptions}
            type="button"
            variant="secondary"
          >
            <Copy className="h-4 w-4" />
            {copiedKey === "all-transcriptions" ? "Transcrições copiadas" : "Copiar todas as transcrições"}
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
      !generalIntent &&
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

      {taskErrors.intent ? <ErrorBox message={taskErrors.intent} /> : null}
      {generalIntent ? (
        <ResultSection
          copied={copiedKey === "general-intent"}
          copyLabel="Copiar intenção consolidada"
          onCopy={onCopyIntent}
          onSpeak={onSpeakResult}
          speechError={speechErrors.intent}
          speechKey="intent"
          speechLoading={speechLoadingMap.intent}
          title="Intenção consolidada e recomendações"
          value={generalIntent}
        />
      ) : null}

      <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-black text-slate-950">Transformar em Prompt</h3>
          <p className="text-sm text-slate-600">
            Use o conteúdo já gerado no Painel Geral e, quando houver transcrições disponíveis,
            complete a análise antes de montar uma instrução técnica e funcional pronta para copiar.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {promptFormats.map((item) => (
            <button
              className="rounded-lg border border-amber-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-leste-blue hover:shadow-editorial disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasPromptSource || isPromptLoading || isCompleteAnalysisLoading}
              key={item.format}
              onClick={() => onTransformToPrompt(item.format)}
              type="button"
            >
              <span className="flex items-center gap-2 text-sm font-black text-leste-blue">
                <Wand2 className="h-4 w-4" />
                {item.label}
              </span>
              <span className="mt-2 block text-xs leading-5 text-slate-600">{item.description}</span>
            </button>
          ))}
        </div>

        {isPromptLoading ? (
          <p className="text-sm font-semibold text-leste-blue">Gerando prompt final...</p>
        ) : null}
        {!hasPromptSource ? (
          <p className="text-xs leading-5 text-slate-500">
            Gere ao menos um resumo, interpretação, organização, tarefa, dado-chave, resposta ou transcrição antes de transformar em prompt.
          </p>
        ) : null}
        {taskErrors.prompt ? <ErrorBox message={taskErrors.prompt} /> : null}
      </div>

      {promptResult ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold uppercase text-slate-500">Prompt final pronto para copiar</h3>
            <ActionButton className="sm:w-auto" fullWidth onClick={onCopyPrompt} type="button" variant="secondary">
              <Copy className="h-4 w-4" />
              {copiedKey === "general-prompt" ? "Copiado" : "Copiar prompt"}
            </ActionButton>
          </div>
          <textarea
            className="min-h-[260px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
            readOnly
            value={promptResult}
          />
        </div>
      ) : null}
    </section>
  );
}
