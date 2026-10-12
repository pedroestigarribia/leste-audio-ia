"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Check,
  CheckSquare,
  Copy,
  Download,
  Layers,
  Lightbulb,
  ListTree,
  Pause,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Wand2,
} from "lucide-react";
import { nanoid } from "nanoid";

import ActionButton from "@/components/ActionButton";
import AppHeader from "@/components/AppHeader";
import AudioList from "@/components/AudioList";
import AskFilesPanel, { type AskFileSource } from "@/components/AskFilesPanel";
import ContinuityPanel from "@/components/ContinuityPanel";
import EditorialWorkflowPanel from "@/components/EditorialWorkflowPanel";
import LocalProjectsPanel from "@/components/LocalProjectsPanel";
import LiveVoicePanel from "@/components/LiveVoicePanel";
import ProductionFlowNav, { type ProductionStage } from "@/components/ProductionFlowNav";
import SessionSearchPanel, { type SessionSearchEntry } from "@/components/SessionSearchPanel";
import ErrorBox from "@/components/ErrorBox";
import PdfAudiobookPanel from "@/components/PdfAudiobookPanel";
import PdfPanel from "@/components/PdfPanel";
import ProgressBar from "@/components/ProgressBar";
import ResultPanel from "@/components/ResultPanel";
import MilenaVozPanel from "@/components/MilenaVozPanel";
import UploadArea from "@/components/UploadArea";
import YoutubePanel from "@/components/YoutubePanel";
import SmartClipsPanel from "@/components/SmartClipsPanel";
import VideoLinkInput from "@/components/VideoLinkInput";
import type { PdfResultKey, PdfSpeechKey } from "@/components/PdfPanel";
import type {
  ImageSpeechKey,
  ImageTextState,
  TextVoiceSpeechKey,
} from "@/components/MilenaVozPanel";
import {
  ALLOWED_AUDIO_EXTENSIONS,
  getFileExtension,
  getMimeTypeFromExtension,
  isAllowedAudio,
  shouldConvert,
} from "@/lib/audio";
import { copyToClipboard } from "@/lib/clipboard";
import { buildDocxBlob } from "@/lib/export-docx";
import {
  buildExportFileBaseName,
  buildExportText,
  buildOrganizedExportText,
  buildSingleAudioExportSection,
  buildTranscriptionsOnlyText,
} from "@/lib/export-txt";
import { normalizePlainText } from "@/lib/plain-text";
import { runDynamicQueue, type DynamicQueueStatus } from "@/lib/queue";
import { prepareSessionBatches } from "@/lib/session-batches";
import type {
  AnalyzeAllItem,
  AnalyzeAllMode,
  AudioContentKind,
  AudioIntelligenceResult,
  AudioItem,
  ContinuityPlan,
  ContentSource,
  PromptTransformFormat,
  NarrationPrepMode,
  NarrationStyle,
  PreparedText,
  SessionNarrativeFormat,
  TextProcessResponse,
  TranscriptionResponse,
  UnifiedAction,
} from "@/types/audio";
import type { EditorialWorkflowSnapshot, LocalProjectSnapshot, SavedAudioItem } from "@/types/local-project";
import { buildAudiobookChapters, createPdfAudiobook, type PdfAudiobook } from "@/lib/audiobook";

type LesteAudioAppProps = {
  config: {
    appName: string;
    maxParallelTranscriptions: number;
    maxFileSizeMb: number;
  };
  hasLogo: boolean;
};

type GeneralResultKey = "summary" | "organized" | "analysis" | "tasks" | "keyData" | "reply" | "intent";
type AudiobookSpeechKey = `pdf-audiobook:${string}`;
type SpeechTargetKey =
  | GeneralResultKey
  | PdfSpeechKey
  | TextVoiceSpeechKey
  | ImageSpeechKey
  | AudiobookSpeechKey
  | `review:${string}`
  | `advanced:${string}`;
type SpeechOptions = {
  speed?: number;
  style?: NarrationStyle;
  autoplay?: boolean;
};
type BatchQueueStatus = DynamicQueueStatus;
type SessionDocxKey =
  | "transcriptions"
  | "unifiedTranscript"
  | "individualSummaries"
  | "individualInterpretations"
  | "individualOrganization"
  | "sessionSummary"
  | "sessionOrganization"
  | "sessionInterpretation"
  | "tasks"
  | "keyData"
  | "reply"
  | "intent"
  | "narrative";

const SESSION_DOCX_OPTIONS: Array<{ key: SessionDocxKey; label: string }> = [
  { key: "transcriptions", label: "Transcrições completas" },
  { key: "unifiedTranscript", label: "Texto integral unificado" },
  { key: "individualSummaries", label: "Resumos individuais" },
  { key: "individualInterpretations", label: "Interpretações individuais" },
  { key: "individualOrganization", label: "Organização individual" },
  { key: "sessionSummary", label: "Resumo consolidado" },
  { key: "sessionOrganization", label: "Organização geral por contexto" },
  { key: "sessionInterpretation", label: "Interpretação geral" },
  { key: "tasks", label: "Tarefas e decisões" },
  { key: "keyData", label: "Dados-chave" },
  { key: "reply", label: "Resposta para WhatsApp" },
  { key: "intent", label: "Intenção geral" },
  { key: "narrative", label: "Narrativa final revisada" },
];

const EMPTY_GENERAL_RESULTS: Record<GeneralResultKey, string> = {
  summary: "",
  organized: "",
  analysis: "",
  tasks: "",
  keyData: "",
  reply: "",
  intent: "",
};

const MODE_DISPLAY_LABELS: Partial<Record<UnifiedAction, string>> = {
  analisar_e_criar: "Análise geral",
  entender_intencao: "Intenção detectada",
  extrair_tarefas: "Tarefas extraídas",
  extrair_dados: "Dados extraídos",
  corrigir_texto: "Texto Corrigido",
  reescrever: "Texto Reescrito",
  humanizar: "Texto Humanizado",
  profissionalizar: "Texto Profissional",
  melhorar_clareza: "Clareza Melhorada",
  encurtar: "Texto Encurtado",
  expandir: "Texto Expandido",
  remover_repeticoes: "Sem repetições",
  compreensao_global: "Compreensão global",
  interpretacao: "Interpretação",
  extracao: "Extração",
  mapeamentos: "Mapeamentos",
  diagnostico: "Diagnóstico",
  recomendacoes: "Recomendações",
  criacao: "Criação",
  processo_criativo: "Processo Criativo",
  comparacao: "Comparação",
};

const EMPTY_PDF_RESULTS: Record<PdfResultKey, string> = {
  analysis: "",
  summary: "",
  interpretation: "",
  organized: "",
  grammar: "",
  clean: "",
};

type PdfState = {
  fileName: string;
  fileSize: number;
  text: string;
  results: Record<PdfResultKey, string>;
};

type AudioAnalysisResponse = {
  ok: boolean;
  result?: AudioIntelligenceResult;
  error?: string;
  model?: string;
};

const SOURCE_TYPE_LABELS: Record<ContentSource["type"], string> = {
  audio: "Áudio",
  text: "Texto",
  pdf: "PDF",
  docx: "DOCX",
  image: "Imagem",
  youtube: "YouTube",
  url: "URL",
  generated: "Gerado",
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildApiErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Ocorreu um erro inesperado.";
}

function isActiveStatus(status: AudioItem["status"]) {
  return status === "downloading" || status === "uploading" || status === "converting" || status === "transcribing";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function LesteAudioApp({ config, hasLogo }: LesteAudioAppProps) {
  const [items, setItems] = useState<AudioItem[]>([]);
  const [generalResults, setGeneralResults] =
    useState<Record<GeneralResultKey, string>>(EMPTY_GENERAL_RESULTS);
  const [promptResult, setPromptResult] = useState("");
  const [batchRunStatus, setBatchRunStatus] = useState<BatchQueueStatus>("idle");
  const [queueNotice, setQueueNotice] = useState("");
  const [aggregateStale, setAggregateStale] = useState(false);
  const [aggregateStaleReason, setAggregateStaleReason] = useState<"new-items" | "full">("full");
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [lastAnalysisBlocks, setLastAnalysisBlocks] = useState(0);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [taskErrors, setTaskErrors] = useState<Record<string, string | undefined>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<PdfState | null>(null);
  const [pdfError, setPdfError] = useState<string | undefined>();
  const [pdfAudiobook, setPdfAudiobook] = useState<PdfAudiobook | null>(null);
  const [freeTextValue, setFreeTextValue] = useState("");
  const [imageTextState, setImageTextState] = useState<ImageTextState | null>(null);
  const [imageTextError, setImageTextError] = useState<string | undefined>();
  const [audioPreviewUrls, setAudioPreviewUrls] = useState<Record<string, string>>({});
  const [speechAudioUrls, setSpeechAudioUrls] = useState<Record<string, string | undefined>>({});
  const [speechAudioTypes, setSpeechAudioTypes] = useState<Record<string, string | undefined>>({});
  const [speechErrors, setSpeechErrors] = useState<Record<string, string | undefined>>({});
  const [activeSpeechKey, setActiveSpeechKey] = useState<string | null>(null);
  const [continuityPlan, setContinuityPlan] = useState<ContinuityPlan | null>(null);
  const [sessionTranscriptOrder, setSessionTranscriptOrder] = useState<"original" | "context">("context");
  const [sessionNarrative, setSessionNarrative] = useState("");
  const [sessionNarrativeStale, setSessionNarrativeStale] = useState(false);
  const [sessionNarrativeFormat, setSessionNarrativeFormat] = useState<SessionNarrativeFormat>("faithful");
  const [workflowHasOutput, setWorkflowHasOutput] = useState(false);
  const [workflowResetKey, setWorkflowResetKey] = useState(0);
  const [docxSelection, setDocxSelection] = useState<Record<SessionDocxKey, boolean>>({
    transcriptions: true,
    unifiedTranscript: true,
    individualSummaries: true,
    individualInterpretations: true,
    individualOrganization: true,
    sessionSummary: true,
    sessionOrganization: true,
    sessionInterpretation: true,
    tasks: true,
    keyData: true,
    reply: true,
    intent: true,
    narrative: true,
  });

  const [sources, setSources] = useState<ContentSource[]>([]);
  const [contextText, setContextText] = useState("");
  const [lastActionResult, setLastActionResult] = useState<string | null>(null);
  const [lastActionMode, setLastActionMode] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const contextEditorRef = useRef<HTMLTextAreaElement>(null);

  const itemsRef = useRef<AudioItem[]>([]);
  const cancelledIdsRef = useRef<Set<string>>(new Set());
  const batchQueueRef = useRef<{
    status: BatchQueueStatus;
    pendingIds: string[];
    itemIds: Set<string>;
    controllers: Map<string, AbortController>;
    lastEnqueuedAt: number;
    wake: Set<() => void>;
  }>({ status: "idle", pendingIds: [], itemIds: new Set(), controllers: new Map(), lastEnqueuedAt: 0, wake: new Set() });
  const analyzedItemIdsRef = useRef<Set<string>>(new Set());
  const sessionEpochRef = useRef(0);
  const aggregateStaleRef = useRef(false);
  const aggregateStaleReasonRef = useRef<"new-items" | "full">("full");
  const addMoreInputRef = useRef<HTMLInputElement | null>(null);
  const audioPreviewUrlsRef = useRef<Record<string, string>>({});
  const speechAudioUrlsRef = useRef<Record<string, string | undefined>>({});
  const pdfAudiobookRef = useRef<PdfAudiobook | null>(null);
  const cancelPdfAudiobookRef = useRef(false);
  const imagePreviewUrlRef = useRef<string | null>(null);
  const pdfOperationIdRef = useRef<string | null>(null);
  const editorialSnapshotRef = useRef<EditorialWorkflowSnapshot | null>(null);
  const [editorialRestoreSnapshot, setEditorialRestoreSnapshot] = useState<EditorialWorkflowSnapshot | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    audioPreviewUrlsRef.current = audioPreviewUrls;
  }, [audioPreviewUrls]);

  useEffect(() => {
    speechAudioUrlsRef.current = speechAudioUrls;
  }, [speechAudioUrls]);

  useEffect(() => {
    pdfAudiobookRef.current = pdfAudiobook;
  }, [pdfAudiobook]);

  useEffect(() => {
    setAudioPreviewUrls((current) => {
      const next = { ...current };
      const activeIds = new Set(items.map((item) => item.id));
      let changed = false;

      for (const item of items) {
        if (!next[item.id] && item.originalFileAvailable !== false) {
          next[item.id] = URL.createObjectURL(item.file);
          changed = true;
        }
      }

      for (const id of Object.keys(next)) {
        if (!activeIds.has(id)) {
          URL.revokeObjectURL(next[id]);
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [items]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(audioPreviewUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }

      for (const url of Object.values(speechAudioUrlsRef.current)) {
        if (url) {
          URL.revokeObjectURL(url);
        }
      }

      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
      }
    };
  }, []);

  function setLoadingState(key: string, value: boolean) {
    setLoadingMap((current) => {
      const nextState = { ...current };

      if (value) {
        nextState[key] = true;
      } else {
        delete nextState[key];
      }

      return nextState;
    });
  }

  function setTaskErrorState(key: string, message?: string) {
    setTaskErrors((current) => {
      const nextState = { ...current };

      if (message) {
        nextState[key] = message;
      } else {
        delete nextState[key];
      }

      return nextState;
    });
  }

  function clearSpeechResult(key: SpeechTargetKey) {
    setSpeechErrors((current) => {
      const nextState = { ...current };
      delete nextState[key];
      return nextState;
    });

    setSpeechAudioUrls((current) => {
      const currentUrl = current[key];

      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      const nextState = { ...current };
      delete nextState[key];
      return nextState;
    });

    setSpeechAudioTypes((current) => {
      const nextState = { ...current };
      delete nextState[key];
      return nextState;
    });

    setActiveSpeechKey((current) => (current === key ? null : current));
  }

  function clearAllSpeechResults() {
    for (const url of Object.values(speechAudioUrlsRef.current)) {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }

    setSpeechAudioUrls({});
    setSpeechAudioTypes({});
    setSpeechErrors({});
    setActiveSpeechKey(null);
  }

  function updateGeneralResult(key: GeneralResultKey, value: string) {
    clearSpeechResult(key);
    setGeneralResults((current) => ({
      ...current,
      [key]: normalizePlainText(value),
    }));
  }

  function updateItem(
    itemId: string,
    nextValue: Partial<AudioItem> | ((item: AudioItem) => Partial<AudioItem>),
  ) {
    setItems((current) => {
      const nextItems = current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const patch = typeof nextValue === "function" ? nextValue(item) : nextValue;
        return { ...item, ...patch };
      });

      itemsRef.current = nextItems;
      return nextItems;
    });
  }

  function markAggregateStale(reason: "new-items" | "full") {
    const nextReason = aggregateStaleRef.current && reason === "new-items"
      ? aggregateStaleReasonRef.current
      : reason;
    aggregateStaleRef.current = true;
    aggregateStaleReasonRef.current = nextReason;
    setAggregateStale(true);
    setAggregateStaleReason(nextReason);
    setSessionNarrativeStale(true);
  }

  function markAggregateFresh() {
    aggregateStaleRef.current = false;
    aggregateStaleReasonRef.current = "full";
    setAggregateStale(false);
    setAggregateStaleReason("full");
  }

  function buildValidationError(file: File) {
    const extension = getFileExtension(file.name);
    const mimeType = file.type || getMimeTypeFromExtension(extension);
    const maxFileSizeBytes = config.maxFileSizeMb * 1024 * 1024;

    if (!isAllowedAudio(extension, mimeType)) {
      return "Formato não suportado para este áudio.";
    }

    if (file.size > maxFileSizeBytes) {
      return `Arquivo acima do limite de ${config.maxFileSizeMb} MB.`;
    }

    return undefined;
  }

  function createAudioItem(file: File): AudioItem {
    const extension = getFileExtension(file.name);
    const type = file.type || getMimeTypeFromExtension(extension);
    const error = buildValidationError(file);

    return {
      id: nanoid(),
      file,
      name: file.name,
      size: file.size,
      type,
      extension,
      status: error ? "error" : "idle",
      progress: 0,
      includeInAnalysis: true,
      isDuplicate: false,
      error,
    };
  }

  function appendAudioItems(selectedFiles: File[], enqueueForBatch = true) {
    const newItems = selectedFiles.map(createAudioItem);
    const queue = batchQueueRef.current;
    const isQueueActive = enqueueForBatch && (queue.status === "running" || queue.status === "paused");
    const queuedIds = new Set(
      isQueueActive ? newItems.filter(canTranscribeItem).map((item) => item.id) : [],
    );
    const nextItems = [
      ...itemsRef.current,
      ...newItems.map((item) =>
        queuedIds.has(item.id) ? { ...item, status: "queued" as const, progress: 5 } : item,
      ),
    ];

    if (queuedIds.size) {
      queue.pendingIds.push(...queuedIds);
      queuedIds.forEach((id) => queue.itemIds.add(id));
      queue.lastEnqueuedAt = Date.now();
      setQueueNotice(`${queuedIds.size} novo(s) áudio(s) adicionado(s) à fila.`);
    }

    itemsRef.current = nextItems;
    setItems(nextItems);
    markAggregateStale("new-items");

    return newItems;
  }

  function handleVideoLinksAdded(links: string[]) {
    const addedItems = links.map((sourceUrl) => {
      const parsed = new URL(sourceUrl);
      const isInstagram = /(^|\.)instagram\.com$/i.test(parsed.hostname);
      const sourcePlatform = isInstagram ? "instagram" as const : "youtube" as const;
      const id = nanoid();
      const sourceId = sourcePlatform === "instagram"
        ? parsed.pathname.split("/").filter(Boolean).at(-1) ?? id
        : parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).at(-1) ?? id;
      const sourceName = sourcePlatform === "instagram" ? "Instagram Reel" : "YouTube";
      const name = `${sourceName} · ${sourceId}.mp4`;
      const file = new File([], name, { type: "video/mp4" });

      return {
        id,
        file,
        sourceUrl,
        sourcePlatform,
        name,
        size: 0,
        type: "video/mp4",
        extension: "mp4",
        status: "idle" as const,
        progress: 0,
        includeInAnalysis: true,
        isDuplicate: false,
      };
    });

    const queue = batchQueueRef.current;
    const queueIsActive = queue.status === "running" || queue.status === "paused";
    const queuedIds = new Set(queueIsActive ? addedItems.map((item) => item.id) : []);
    const nextItems = [
      ...itemsRef.current,
      ...addedItems.map((item) => queuedIds.has(item.id) ? { ...item, status: "queued" as const, progress: 5 } : item),
    ];
    if (queuedIds.size) {
      queue.pendingIds.push(...queuedIds);
      queuedIds.forEach((id) => queue.itemIds.add(id));
      queue.lastEnqueuedAt = Date.now();
      setQueueNotice(`${queuedIds.size} link(s) adicionado(s) à fila.`);
    }
    itemsRef.current = nextItems;
    setItems(nextItems);
    markAggregateStale("new-items");
  }

  function handleFilesSelected(selectedFiles: File[]) {
    if (!selectedFiles.length) {
      return;
    }

    setAppError(null);
    appendAudioItems(selectedFiles);
  }

  async function handleRecordedAudio(file: File) {
    setAppError(null);
    const queueIsActive = batchQueueRef.current.status === "running" || batchQueueRef.current.status === "paused";
    const [recording] = appendAudioItems([file], queueIsActive);

    if (!recording) {
      throw new Error("Não foi possível preparar a gravação para transcrição.");
    }

    if (recording.error) {
      throw new Error(recording.error);
    }

    if (queueIsActive) return;
    await transcribeItem(recording.id);
  }

  async function handleLiveTranscriptReady(file: File, rawTranscription: string) {
    const transcription = normalizePlainText(rawTranscription);
    if (!transcription) {
      await handleRecordedAudio(file);
      return;
    }

    const epoch = sessionEpochRef.current;
    const [recording] = appendAudioItems([file], false);
    if (!recording) throw new Error("Não foi possível preparar a escuta ao vivo.");
    if (recording.error) throw new Error(recording.error);

    const segmentData = buildTranscriptSegments(transcription);
    updateItem(recording.id, {
      status: "done",
      progress: 100,
      transcription,
      segments: segmentData.segments,
      speakers: segmentData.speakers,
      error: undefined,
    });
    addSource("audio", recording.name, transcription, undefined, { audioItemId: recording.id, origin: "live" });

    if (epoch !== sessionEpochRef.current) return;
    await Promise.allSettled([
      handleSummarizeItem(recording.id, transcription),
      handleOrganizeItem(recording.id, transcription),
      handleAnalyzeAudioItem(recording.id, transcription),
      detectIntentForItem(recording.id, transcription),
    ]);
  }

  function getCurrentItem(itemId: string) {
    return itemsRef.current.find((item) => item.id === itemId);
  }

  function canTranscribeItem(item: AudioItem) {
    return item.originalFileAvailable !== false && !isActiveStatus(item.status) && !item.transcription && !buildValidationError(item.file);
  }

  function buildExportItems() {
    return itemsRef.current.map((item) => ({
      name: item.name,
      transcription: item.transcription,
      segments: item.segments,
      summary: item.summary,
      organizedText: item.organizedText,
      audioIntelligence: item.audioIntelligence,
      generatedContents: item.generatedContents,
    }));
  }

  function buildSessionExportPayload() {
    return {
      items: buildExportItems(),
      generalSummary: generalResults.summary,
      generalOrganizedText: generalResults.organized,
      generalAnalysis: generalResults.analysis,
      generalTasks: generalResults.tasks,
      generalKeyData: generalResults.keyData,
      generalReply: generalResults.reply,
      generalIntent: generalResults.intent,
      generalNarrative: sessionNarrative,
      promptResult,
    };
  }

  async function parseJsonResponse<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
  }

  async function transcribeItem(itemId: string, signal?: AbortSignal) {
    const sessionEpoch = sessionEpochRef.current;
    const item = getCurrentItem(itemId);

    if (!item || cancelledIdsRef.current.has(itemId) || !canTranscribeItem(item)) {
      return;
    }

    setTaskErrorState(`summary:${itemId}`);
    setTaskErrorState(`organize:${itemId}`);
    setAppError(null);

    try {
      updateItem(itemId, {
        status: item.sourceUrl ? "downloading" : shouldConvert(item.extension) ? "converting" : "uploading",
        progress: item.sourceUrl ? 12 : shouldConvert(item.extension) ? 15 : 25,
        error: undefined,
        transcription: undefined,
        summary: undefined,
        organizedText: undefined,
        audioIntelligence: undefined,
        generatedContents: undefined,
      });

      if (!item.sourceUrl && shouldConvert(item.extension)) {
        await sleep(70);
      }

      updateItem(itemId, { status: item.sourceUrl ? "downloading" : "uploading", progress: 35 });

      const responsePromise = item.sourceUrl
        ? fetch("/api/transcribe-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: item.sourceUrl }),
            signal,
          })
        : (() => {
            const formData = new FormData();
            formData.append("file", item.file);
            return fetch("/api/transcribe", { method: "POST", body: formData, signal });
          })();

      await sleep(90);
      if (!item.sourceUrl) {
        updateItem(itemId, { status: "transcribing", progress: 72 });
      }

      const response = await responsePromise;
      const payload = await parseJsonResponse<TranscriptionResponse>(response);

      if (!response.ok || !payload.ok || !payload.transcription) {
        throw new Error(payload.error || "Falha ao transcrever o áudio.");
      }
      if (sessionEpoch !== sessionEpochRef.current) return;

      const transcription = normalizePlainText(payload.transcription);
      const segmentData = buildTranscriptSegments(transcription);

      updateItem(itemId, {
        name: payload.meta?.originalFileName ?? item.name,
        size: payload.meta?.sourceSizeBytes ?? item.size,
        sourcePlatform: payload.meta?.sourcePlatform ?? item.sourcePlatform,
        status: "done",
        progress: 100,
        error: undefined,
        transcription,
        segments: segmentData.segments,
        speakers: segmentData.speakers,
        summary: undefined,
        organizedText: undefined,
        audioIntelligence: undefined,
        generatedContents: undefined,
      });
      markAggregateStale("new-items");

      const completedItem = itemsRef.current.find((currentItem) => currentItem.id === itemId);
      const itemName = payload.meta?.originalFileName ?? completedItem?.name ?? "Áudio";
      const sourceType = item.sourcePlatform === "youtube"
        ? "youtube"
        : item.sourcePlatform === "instagram"
          ? "url"
          : "audio";
      addSource(sourceType, itemName, transcription, undefined, {
        audioItemId: itemId,
        sourceUrl: item.sourceUrl,
        sourcePlatform: payload.meta?.sourcePlatform ?? item.sourcePlatform,
      });

      // Texto e entendimento são produzidos automaticamente após a transcrição.
      // A geração de voz continua opcional e só ocorre quando a pessoa clicar.
      await Promise.allSettled([
        handleSummarizeItem(itemId, transcription),
        handleOrganizeItem(itemId, transcription),
        handleAnalyzeAudioItem(itemId, transcription),
        detectIntentForItem(itemId, transcription),
      ]);
    } catch (error) {
      if (signal?.aborted) {
        if (getCurrentItem(itemId)) {
          updateItem(itemId, { status: "idle", progress: 0, error: undefined });
        }
        return;
      }

      if (getCurrentItem(itemId)) {
        updateItem(itemId, {
          status: "error",
          progress: 0,
          error: buildApiErrorMessage(error),
        });
      }

      throw error;
    }
  }

  async function handleTranscribeBatch() {
    const queue = batchQueueRef.current;

    if (queue.status === "paused") {
      queue.status = "running";
      queue.wake.forEach((wake) => wake());
      queue.wake.clear();
      setBatchRunStatus("running");
      setQueueNotice("Fila retomada.");
      return;
    }

    if (queue.status !== "idle") {
      return;
    }

    const targets = itemsRef.current.filter(canTranscribeItem);

    if (!targets.length) {
      setAppError("Selecione ao menos um áudio válido para transcrever.");
      return;
    }

    setAppError(null);
    setQueueNotice("");

    const targetIds = new Set(targets.map((item) => item.id));
    queue.status = "running";
    queue.pendingIds = targets.map((item) => item.id);
    queue.itemIds = new Set(targets.map((item) => item.id));
    queue.lastEnqueuedAt = Date.now();
    setBatchRunStatus("running");
    const queuedItems = itemsRef.current.map((item) =>
      targetIds.has(item.id) ? { ...item, status: "queued" as const, progress: 5, error: undefined } : item,
    );
    itemsRef.current = queuedItems;
    setItems(queuedItems);

    const workerCount = Math.max(1, Math.min(config.maxParallelTranscriptions, targets.length));
    await runDynamicQueue(queue, workerCount, async (itemId) => {
      if (cancelledIdsRef.current.has(itemId)) return;
      const controller = new AbortController();
      queue.controllers.set(itemId, controller);
      try {
        await transcribeItem(itemId, controller.signal);
      } finally {
        queue.controllers.delete(itemId);
      }
    });

    const wasCancelled = (queue.status as BatchQueueStatus) === "cancelling";
    queue.status = "idle";
    queue.pendingIds = [];
    setBatchRunStatus("idle");
    const failedCount = itemsRef.current.filter((item) => queue.itemIds.has(item.id) && item.status === "error").length;
    queue.itemIds.clear();
    setQueueNotice(
      wasCancelled
        ? "Fila cancelada. Próximos áudios não serão iniciados; análises automáticas já iniciadas podem concluir."
        : failedCount
          ? `${failedCount} áudio(s) falharam. Os demais foram processados; você pode tentar novamente os arquivos com erro.`
          : "Fila concluída.",
    );
  }

  function pauseTranscriptionQueue() {
    const queue = batchQueueRef.current;
    if (queue.status !== "running") return;
    queue.status = "paused";
    setBatchRunStatus("paused");
    setQueueNotice("Fila pausada. Os áudios já iniciados serão concluídos antes da pausa.");
  }

  function cancelTranscriptionQueue() {
    const queue = batchQueueRef.current;
    if (queue.status === "idle") return;
    queue.status = "cancelling";
    const pendingIds = new Set(queue.pendingIds);
    queue.pendingIds = [];
    for (const controller of queue.controllers.values()) controller.abort();
    queue.wake.forEach((wake) => wake());
    queue.wake.clear();
    const nextItems = itemsRef.current.map((item) =>
      pendingIds.has(item.id) ? { ...item, status: "idle" as const, progress: 0 } : item,
    );
    itemsRef.current = nextItems;
    setItems(nextItems);
    setBatchRunStatus("cancelling");
    setQueueNotice("Cancelando os próximos áudios. Uploads de transcrição podem ser interrompidos; análises automáticas já iniciadas podem concluir.");
  }

  const runTextTask = useCallback(async (endpoint: string, body: unknown) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await parseJsonResponse<TextProcessResponse>(response);

    if (!response.ok || !payload.ok || !payload.result) {
      throw new Error(payload.error || "Falha ao processar o texto.");
    }

    return normalizePlainText(payload.result);
  }, []);

  const runChunkedSessionTask = useCallback(async (
    endpoint: "/api/summarize" | "/api/organize" | "/api/analyze-all",
    items: AnalyzeAllItem[],
    mode: AnalyzeAllMode | "all" | "single",
    label: string,
    reportProgress = true,
  ) => {
    let batches = prepareSessionBatches(items);
    let completedCalls = 0;
    let pass = 1;

    while (batches.length) {
      const batchCount = batches.length;
      const results: AnalyzeAllItem[] = [];

      for (let index = 0; index < batches.length; index += 1) {
        if (reportProgress) setAnalysisProgress(`${label}: bloco ${index + 1} de ${batchCount}, etapa ${pass}.`);
        const batch = batches[index];
        const result = endpoint === "/api/analyze-all"
          ? await runTextTask(endpoint, { items: batch, mode })
          : await runTextTask(endpoint, {
              text: batch.map((item) => `ÁUDIO: ${item.name}\n\n${item.transcription}`).join("\n\n========================\n\n"),
              mode: mode === "single" ? "single" : "all",
            });
        completedCalls += 1;
        results.push({ name: `Resultado parcial ${completedCalls}`, transcription: result });
      }

      if (results.length === 1) {
        setLastAnalysisBlocks(completedCalls);
        return { result: results[0].transcription, blocks: completedCalls };
      }

      const nextBatches = prepareSessionBatches(results);
      if (pass >= 10 || nextBatches.length >= batches.length) {
        throw new Error("A consolidação excedeu o limite seguro. Nenhum áudio foi descartado; reduza os arquivos ou consolide em grupos menores.");
      }

      batches = nextBatches;
      pass += 1;
    }

    throw new Error("Não foi possível consolidar as transcrições desta sessão.");
  }, [runTextTask]);

  async function handleSpeakText(
    key: SpeechTargetKey,
    title: string,
    text: string,
    options?: SpeechOptions,
  ): Promise<string | null> {
    const normalizedText = normalizePlainText(text);

    if (!normalizedText) {
      setAppError("Não há texto para ouvir.");
      return null;
    }

    const existingUrl = speechAudioUrlsRef.current[key];

    if (existingUrl) {
      if (options?.autoplay !== false) {
        setActiveSpeechKey(null);
        window.setTimeout(() => setActiveSpeechKey(key), 0);
      }
      return existingUrl;
    }

    setLoadingState(`speech:${key}`, true);
    setSpeechErrors((current) => {
      const nextState = { ...current };
      delete nextState[key];
      return nextState;
    });

    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format: "mp3",
          estilo: options?.style ?? "natural",
          speed: options?.speed ?? 1,
          title,
          text: normalizedText,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as TextProcessResponse | null;
        throw new Error(payload?.error || "Falha ao gerar a voz com IA.");
      }

      const responseContentType = response.headers.get("Content-Type") || "";
      const blob = await response.blob();
      const resolvedContentType = blob.type || responseContentType;

      if (!resolvedContentType.includes("mpeg") && !resolvedContentType.includes("mp3")) {
        throw new Error("A leitura foi gerada, mas o servidor não entregou MP3. Reinicie o app na Hostinger e tente novamente.");
      }

      const url = URL.createObjectURL(blob);

      setSpeechAudioUrls((current) => {
        const currentUrl = current[key];

        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }

        return {
          ...current,
          [key]: url,
        };
      });

      setSpeechAudioTypes((current) => ({
        ...current,
        [key]: "audio/mpeg",
      }));
      if (options?.autoplay !== false) setActiveSpeechKey(key);
      return url;
    } catch (error) {
      setSpeechErrors((current) => ({
        ...current,
        [key]: buildApiErrorMessage(error),
      }));
      return null;
    } finally {
      setLoadingState(`speech:${key}`, false);
    }
  }

  function handleStopSpeech() {
    setActiveSpeechKey(null);
  }

  function handleDownloadSpeech(key: string, label: string) {
    const url = speechAudioUrlsRef.current[key];

    if (!url) {
      setAppError("Gere a leitura com voz da Milena antes de baixar o áudio.");
      return;
    }

    const safeLabel = label
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `milena-${safeLabel || "voz-ia"}.mp3`;
    anchor.click();
  }

  async function handleSummarizeItem(itemId: string, transcriptionOverride?: string): Promise<boolean> {
    const item = getCurrentItem(itemId);
    const transcription = transcriptionOverride ?? item?.transcription;

    if (!item || !transcription) {
      return false;
    }

    const taskKey = `summary:${itemId}`;
    setLoadingState(taskKey, true);
    setTaskErrorState(taskKey);

    try {
      const { result } = await runChunkedSessionTask(
        "/api/summarize",
        [{ name: item.name, transcription }],
        "single",
        `Resumo de ${item.name}`,
        false,
      );

      updateItem(itemId, { summary: result });
      return true;
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
      return false;
    } finally {
      setLoadingState(taskKey, false);
    }
  }

  async function handleOrganizeItem(itemId: string, transcriptionOverride?: string): Promise<boolean> {
    const item = getCurrentItem(itemId);
    const transcription = transcriptionOverride ?? item?.transcription;

    if (!item || !transcription) {
      return false;
    }

    const taskKey = `organize:${itemId}`;
    setLoadingState(taskKey, true);
    setTaskErrorState(taskKey);

    try {
      const { result } = await runChunkedSessionTask(
        "/api/organize",
        [{ name: item.name, transcription }],
        "single",
        `Organização de ${item.name}`,
        false,
      );

      updateItem(itemId, { organizedText: result });
      return true;
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
      return false;
    } finally {
      setLoadingState(taskKey, false);
    }
  }

  async function detectIntentForItem(itemId: string, transcription: string): Promise<boolean> {
    if (!transcription.trim()) {
      return false;
    }

    const taskKey = `intent:${itemId}`;
    setLoadingState(taskKey, true);
    setTaskErrorState(taskKey);

    try {
      const response = await fetch("/api/detect-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcription }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        result?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(payload.error || "Falha ao identificar a intenção do áudio.");
      }

      const parsed = JSON.parse(payload.result) as import("@/types/audio").AutoDetectedIntent;

      updateItem(itemId, { autoDetectedIntent: parsed });
      return true;
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
      return false;
    } finally {
      setLoadingState(taskKey, false);
    }
  }

  async function handleExecutePrompt(promptText: string): Promise<string> {
    const response = await fetch("/api/execute-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText }),
    });

    const payload = await parseJsonResponse<TextProcessResponse>(response);

    if (!response.ok || !payload.ok || !payload.result) {
      throw new Error(payload.error || "Falha ao executar o prompt.");
    }

    return normalizePlainText(payload.result);
  }

  function getCompletedItems(): AnalyzeAllItem[] {
    const completed = itemsRef.current.filter(
      (item) => item.transcription && item.includeInAnalysis !== false,
    );
    const orderedIds = continuityPlan?.groups.flatMap((group) => group.itemIds) ?? [];
    const byId = new Map(completed.map((item) => [item.id, item]));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((item): item is AudioItem => Boolean(item));
    const remaining = completed.filter((item) => !orderedIds.includes(item.id));

    return [...ordered, ...remaining]
      .map((item) => ({
        id: item.id,
        name: item.name,
        transcription: item.transcription as string,
      }));
  }

  function buildMergedTranscriptions() {
    return getCompletedItems()
      .map((item) => `ÁUDIO: ${item.name}\n\n${item.transcription}`)
      .join("\n\n========================\n\n");
  }

  function buildFullUnifiedTranscript() {
    const allItems = itemsRef.current.filter((item) => item.transcription);
    const ids = continuityPlan?.groups.flatMap((group) => group.itemIds) ?? [];
    const byId = new Map(allItems.map((item) => [item.id, item]));
    const orderedItems = sessionTranscriptOrder === "context"
      ? [
          ...ids.map((id) => byId.get(id)).filter((item): item is AudioItem => Boolean(item)),
          ...allItems.filter((item) => !ids.includes(item.id)),
        ]
      : allItems;
    return orderedItems
      .map((item) => `ÁUDIO: ${item.name}\n\n${item.transcription}`)
      .join("\n\n========================\n\n");
  }

  async function handleSummarizeAll() {
    const mergedText = buildMergedTranscriptions();

    if (!mergedText) {
      setAppError("Transcreva ao menos um áudio antes de resumir todos.");
      return;
    }

    const taskKey = "summary:all";
    setLoadingState(taskKey, true);
    setTaskErrorState(taskKey);

    try {
      const { result } = await runChunkedSessionTask(
        "/api/summarize",
        getCompletedItems(),
        "all",
        "Resumo consolidado",
      );

      updateGeneralResult("summary", result);
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
    } finally {
      setAnalysisProgress("");
      setLoadingState(taskKey, false);
    }
  }

  async function handleOrganizeAll() {
    const mergedText = buildMergedTranscriptions();

    if (!mergedText) {
      setAppError("Transcreva ao menos um áudio antes de organizar todos.");
      return;
    }

    const taskKey = "organize:all";
    setLoadingState(taskKey, true);
    setTaskErrorState(taskKey);

    try {
      const { result } = await runChunkedSessionTask(
        "/api/organize",
        getCompletedItems(),
        "all",
        "Organização por contexto",
      );

      updateGeneralResult("organized", result);
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
    } finally {
      setAnalysisProgress("");
      setLoadingState(taskKey, false);
    }
  }

  async function runAnalyzeMode(
    mode: AnalyzeAllMode,
    resultKey: GeneralResultKey,
    loadingKey: string,
    emptyMessage: string,
  ) {
    const completedItems = getCompletedItems();

    if (!completedItems.length) {
      setAppError(emptyMessage);
      return;
    }

    setLoadingState(loadingKey, true);
    setTaskErrorState(loadingKey);

    try {
      const { result } = await runChunkedSessionTask(
        "/api/analyze-all",
        completedItems,
        mode,
        "Interpretação da sessão",
      );

      updateGeneralResult(resultKey, result);
    } catch (error) {
      setTaskErrorState(loadingKey, buildApiErrorMessage(error));
    } finally {
      setAnalysisProgress("");
      setLoadingState(loadingKey, false);
    }
  }

  async function handleOrganizeSequence() {
    const sequenceItems = itemsRef.current
      .filter((item) => item.transcription && item.includeInAnalysis !== false)
      .map((item) => ({ id: item.id, name: item.name, transcription: item.transcription! }));

    if (sequenceItems.length < 2) {
      setAppError("Transcreva pelo menos dois áudios para organizar a sequência.");
      return;
    }

    setLoadingState("sequence:all", true);
    setTaskErrorState("sequence:all");
    try {
      const batches = prepareSessionBatches(sequenceItems);
      const partialPlans: ContinuityPlan[] = [];
      const chunkToAudioId = new Map<string, string>();
      for (const chunk of batches.flat()) {
        const source = sequenceItems.find((item) =>
          chunk.id === item.id || Boolean(item.id && chunk.id?.startsWith(`${item.id}-parte-`)),
        );
        if (chunk.id && source) chunkToAudioId.set(chunk.id, source.id);
      }
      for (let index = 0; index < batches.length; index += 1) {
        setAnalysisProgress(`Organizando continuidade: bloco ${index + 1} de ${batches.length}.`);
        const response = await fetch("/api/organize-sequence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batches[index] }),
        });
        const payload = (await response.json()) as { ok?: boolean; result?: ContinuityPlan; error?: string };
        if (!response.ok || !payload.ok || !payload.result) {
          throw new Error(payload.error || `Não foi possível organizar o bloco ${index + 1}.`);
        }
        partialPlans.push(payload.result);
      }

      const assignedAudioIds = new Set<string>();
      const groups = partialPlans.flatMap((partial, batchIndex) => partial.groups.flatMap((group) => {
        const itemIds = Array.from(new Set(group.itemIds
          .map((id) => chunkToAudioId.get(id) ?? id)
          .filter((id) => !assignedAudioIds.has(id))));
        itemIds.forEach((id) => assignedAudioIds.add(id));
        return itemIds.length ? [{ ...group, id: `bloco-${batchIndex + 1}-${group.id}`, itemIds }] : [];
      }));
      const warnings = partialPlans.flatMap((partial) => partial.warnings);
      if (chunkToAudioId.size > sequenceItems.length) {
        warnings.unshift("Algumas transcrições longas foram repartidas apenas para análise; cada áudio aparece uma única vez na organização final.");
      }
      if (partialPlans.length > 1) {
        warnings.unshift("Lote grande analisado por blocos. A ordem dentro de cada bloco foi comparada; relações entre blocos devem ser revisadas manualmente.");
      }
      setContinuityPlan({ groups, warnings: Array.from(new Set(warnings)), generatedAt: new Date().toISOString() });
      markAggregateStale("full");
    } catch (error) {
      setTaskErrorState("sequence:all", buildApiErrorMessage(error));
    } finally {
      setAnalysisProgress("");
      setLoadingState("sequence:all", false);
    }
  }

  async function handleGenerateSessionNarrative() {
    const sourceItems = getCompletedItems();
    if (!sourceItems.length) {
      setTaskErrorState("narrative:all", "Transcreva e inclua ao menos um áudio na análise.");
      return;
    }

    setLoadingState("narrative:all", true);
    setTaskErrorState("narrative:all");
    let batches = prepareSessionBatches(sourceItems);
    let pass = 1;
    let completedCalls = 0;

    try {
      while (batches.length) {
        const resultItems: AnalyzeAllItem[] = [];
        const batchCount = batches.length;
        for (let index = 0; index < batchCount; index += 1) {
          setAnalysisProgress(`Narrativa final: bloco ${index + 1} de ${batchCount}, etapa ${pass}.`);
          const result = await runTextTask("/api/session-narrative", {
            items: batches[index],
            format: sessionNarrativeFormat,
          });
          completedCalls += 1;
          resultItems.push({ name: `Narrativa parcial ${index + 1}`, transcription: result });
        }

        if (resultItems.length === 1) {
          clearSpeechResult("review:narrativa-final");
          setSessionNarrative(resultItems[0].transcription);
          setSessionNarrativeStale(false);
          setLastAnalysisBlocks(completedCalls);
          setAnalysisProgress("");
          return;
        }

        const nextBatches = prepareSessionBatches(resultItems);
        if (pass >= 10 || nextBatches.length >= batches.length) {
          throw new Error("A narrativa excedeu o limite seguro de consolidação. Os textos originais continuam intactos.");
        }
        batches = nextBatches;
        pass += 1;
      }
    } catch (error) {
      setTaskErrorState("narrative:all", buildApiErrorMessage(error));
    } finally {
      setAnalysisProgress("");
      setLoadingState("narrative:all", false);
    }
  }

  function handleToggleAnalysis(itemId: string, include: boolean) {
    updateItem(itemId, { includeInAnalysis: include });
    markAggregateStale("full");
  }

  function handleToggleDuplicate(itemId: string, duplicate: boolean) {
    updateItem(itemId, { isDuplicate: duplicate });
  }

  function handleContinuityPlanChange(plan: ContinuityPlan) {
    setContinuityPlan(plan);
    markAggregateStale("full");
  }

  function handleSessionNarrativeChange(text: string) {
    clearSpeechResult("review:narrativa-final");
    setSessionNarrative(text);
  }

  async function handleAnalyzeAudioItem(itemId: string, transcriptionOverride?: string): Promise<boolean> {
    const item = getCurrentItem(itemId);
    const transcription = transcriptionOverride ?? item?.transcription;

    if (!item || !transcription) {
      return false;
    }

    const taskKey = `intelligence:${itemId}`;
    setLoadingState(taskKey, true);
    setTaskErrorState(taskKey);

    try {
      let result: AudioIntelligenceResult;

      try {
        const formData = new FormData();
        formData.append("file", item.file);

        const response = await fetch("/api/audio-analyze", {
          method: "POST",
          body: formData,
        });
        const payload = await parseJsonResponse<AudioAnalysisResponse>(response);

        if (!response.ok || !payload.ok || !payload.result) {
          throw new Error(payload.error || "Falha ao analisar o áudio original.");
        }

        result = payload.result;
      } catch {
        // The transcription is already available, so the raw-file analysis cannot block the result.
        const response = await fetch("/api/audio-analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcription }),
        });
        const payload = await parseJsonResponse<AudioAnalysisResponse>(response);

        if (!response.ok || !payload.ok || !payload.result) {
          throw new Error(payload.error || "Falha ao interpretar a transcrição do áudio.");
        }

        result = payload.result;
      }

      updateItem(itemId, (current) => ({
        audioIntelligence: result,
        ...(result.diarization?.segments.length
          ? {
              segments: result.diarization.segments,
              speakers: result.diarization.speakers,
              segmentWarning: result.diarization.segments.some((segment) => typeof segment.startSeconds === "number")
                ? undefined
                : "Tempos de reprodução não foram retornados para este arquivo.",
            }
          : {}),
        generatedContents: undefined,
      }));
      return true;
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
      return false;
    } finally {
      setLoadingState(taskKey, false);
    }
  }

  async function handleGenerateAudioContent(itemId: string, kind: AudioContentKind) {
    const item = getCurrentItem(itemId);

    if (!item?.transcription || !item.audioIntelligence) {
      setTaskErrorState(`intelligence:${itemId}`, "Analise o áudio antes de criar um novo conteúdo.");
      return;
    }

    const taskKey = `audio-content:${itemId}:${kind}`;
    setLoadingState(taskKey, true);
    setTaskErrorState(taskKey);

    try {
      const result = await runTextTask("/api/audio-content", {
        kind,
        transcription: item.transcription,
        analysis: item.audioIntelligence,
      });

      updateItem(itemId, (current) => ({
        generatedContents: {
          ...current.generatedContents,
          [kind]: result,
        },
      }));
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
    } finally {
      setLoadingState(taskKey, false);
    }
  }

  function handleSpeakAdvanced(key: string, title: string, text: string) {
    void handleSpeakText(key as SpeechTargetKey, title, text, { style: "didatica" });
  }

  async function generateCompleteAnalysis() {
    const completedItems = getCompletedItems();

    if (!completedItems.length) {
      setAppError("Transcreva ao menos um áudio antes de gerar a análise completa.");
      return null;
    }

    setAppError(null);

    const nextResults = { ...generalResults };
    let allJobsSucceeded = true;

    const jobs: Array<{
      key: GeneralResultKey;
      loadingKey: string;
      run: () => Promise<string>;
    }> = [
      {
        key: "summary",
        loadingKey: "summary:all",
        run: async () => (await runChunkedSessionTask("/api/summarize", completedItems, "all", "Resumo consolidado")).result,
      },
      {
        key: "organized",
        loadingKey: "organize:all",
        run: async () => (await runChunkedSessionTask("/api/organize", completedItems, "all", "Organização por contexto")).result,
      },
      {
        key: "analysis",
        loadingKey: "analysis:all",
        run: async () => (await runChunkedSessionTask("/api/analyze-all", completedItems, "analysis", "Interpretação geral")).result,
      },
      {
        key: "tasks",
        loadingKey: "tasks:all",
        run: async () => (await runChunkedSessionTask("/api/analyze-all", completedItems, "tasks", "Tarefas e próximos passos")).result,
      },
      {
        key: "keyData",
        loadingKey: "keyData:all",
        run: async () => (await runChunkedSessionTask("/api/analyze-all", completedItems, "keyData", "Dados-chave")).result,
      },
      {
        key: "reply",
        loadingKey: "reply:all",
        run: async () => (await runChunkedSessionTask("/api/analyze-all", completedItems, "reply", "Resposta para WhatsApp")).result,
      },
      {
        key: "intent",
        loadingKey: "intent:all",
        run: async () => (await runChunkedSessionTask("/api/analyze-all", completedItems, "intent", "Intenção geral")).result,
      },
    ];

    for (const job of jobs) {
      setLoadingState(job.loadingKey, true);
      setTaskErrorState(job.loadingKey);

      try {
        const result = await job.run();
        nextResults[job.key] = result;
        updateGeneralResult(job.key, result);
      } catch (error) {
        allJobsSucceeded = false;
        setTaskErrorState(job.loadingKey, buildApiErrorMessage(error));
      } finally {
        setLoadingState(job.loadingKey, false);
      }
    }

    if (allJobsSucceeded) {
      analyzedItemIdsRef.current = new Set(completedItems.flatMap((item) => item.id ? [item.id] : []));
      markAggregateFresh();
    }
    setAnalysisProgress("");

    return nextResults;
  }

  async function handleTransformToPrompt(format: PromptTransformFormat) {
    const completedItems = getCompletedItems();
    const hasGeneralContent = Object.values(generalResults).some((value) => value.trim());

    if (!completedItems.length && !hasGeneralContent) {
      setAppError("Gere ao menos um resumo, interpretação ou outro resultado geral antes de transformar em prompt.");
      return;
    }

    setLoadingState("prompt:all", true);
    setTaskErrorState("prompt:all");
    setAppError(null);

    try {
      const hasAllResults = !aggregateStale && Object.values(generalResults).every((value) => value.trim());
      const sourceResults =
        hasAllResults || !completedItems.length ? generalResults : await generateCompleteAnalysis();

      if (!sourceResults) {
        return;
      }

      const result = await runTextTask("/api/transform-prompt", {
        analysis: sourceResults.analysis,
        format,
        keyData: sourceResults.keyData,
        intent: sourceResults.intent,
        organized: sourceResults.organized,
        reply: sourceResults.reply,
        summary: sourceResults.summary,
        tasks: sourceResults.tasks,
        transcriptions: "",
      });

      setPromptResult(result);
    } catch (error) {
      setTaskErrorState("prompt:all", buildApiErrorMessage(error));
    } finally {
      setLoadingState("prompt:all", false);
    }
  }

  async function handleUpdateOnlyNewAudioAnalysis() {
    const currentItems = getCompletedItems();
    const newItems = currentItems.filter((item) => item.id && !analyzedItemIdsRef.current.has(item.id));
    if (!newItems.length || !Object.values(generalResults).every((value) => value.trim())) {
      await generateCompleteAnalysis();
      return;
    }

    setAppError(null);
    let succeeded = true;
    const jobs: Array<{
      key: GeneralResultKey;
      endpoint: "/api/summarize" | "/api/organize" | "/api/analyze-all";
      mode: AnalyzeAllMode | "all";
      label: string;
    }> = [
      { key: "summary", endpoint: "/api/summarize", mode: "all", label: "Resumo consolidado" },
      { key: "organized", endpoint: "/api/organize", mode: "all", label: "Organização por contexto" },
      { key: "analysis", endpoint: "/api/analyze-all", mode: "analysis", label: "Interpretação geral" },
      { key: "tasks", endpoint: "/api/analyze-all", mode: "tasks", label: "Tarefas e próximos passos" },
      { key: "keyData", endpoint: "/api/analyze-all", mode: "keyData", label: "Dados-chave" },
      { key: "reply", endpoint: "/api/analyze-all", mode: "reply", label: "Resposta para WhatsApp" },
      { key: "intent", endpoint: "/api/analyze-all", mode: "intent", label: "Intenção geral" },
    ];

    for (const job of jobs) {
      const loadingKey = `${job.key}:all`;
      setLoadingState(loadingKey, true);
      setTaskErrorState(loadingKey);
      try {
        const addition = await runChunkedSessionTask(job.endpoint, newItems, job.mode, `${job.label} (novos áudios)`);
        const combined = await runChunkedSessionTask(job.endpoint, [
          { name: "Análise anterior da sessão", transcription: generalResults[job.key] },
          { name: "Contribuição dos novos áudios", transcription: addition.result },
        ], job.mode, `${job.label} (consolidação)`);
        updateGeneralResult(job.key, combined.result);
      } catch (error) {
        succeeded = false;
        setTaskErrorState(loadingKey, buildApiErrorMessage(error));
      } finally {
        setLoadingState(loadingKey, false);
      }
    }

    if (succeeded) {
      newItems.forEach((item) => { if (item.id) analyzedItemIdsRef.current.add(item.id); });
      markAggregateFresh();
      if (sessionNarrative) await handleGenerateSessionNarrative();
    }
    setAnalysisProgress("");
  }

  async function handleCopy(key: string, text: string) {
    if (!text.trim()) {
      setAppError("Não há conteúdo disponível para copiar.");
      return;
    }

    try {
      await copyToClipboard(normalizePlainText(text));
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1800);
    } catch {
      setAppError("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
    }
  }

  function handleCopySingleAudio(itemId: string) {
    const item = getCurrentItem(itemId);

    if (!item) {
      return;
    }

    void handleCopy(`audio:${itemId}`, buildSingleAudioExportSection(item));
  }

  function handleCopyAllSession() {
    void handleCopy("all", buildExportText(buildSessionExportPayload()));
  }

  function handleCopyAllTranscriptions() {
    void handleCopy("all-transcriptions", buildTranscriptionsOnlyText(buildExportItems()));
  }

  function handleDownloadTranscriptionsTxt() {
    const completedItems = buildExportItems().filter((item) => item.transcription?.trim());

    if (!completedItems.length) {
      setAppError("Não há transcrições prontas para exportar.");
      return;
    }

    const blob = new Blob([buildTranscriptionsOnlyText(completedItems)], {
      type: "text/plain;charset=utf-8",
    });

    downloadBlob(blob, `${buildExportFileBaseName(new Date())}-transcricoes.txt`);
  }

  async function handleDownloadTranscriptionsDocx() {
    const completedItems = buildExportItems().filter((item) => item.transcription?.trim());

    if (!completedItems.length) {
      setAppError("Não há transcrições prontas para exportar.");
      return;
    }

    const blob = await buildDocxBlob({
      fileTitle: "Leste Audio IA - Transcrições",
      sections: completedItems.map((item) => ({
        title: `Áudio: ${item.name}`,
        content: item.transcription ?? "",
      })),
    });

    downloadBlob(blob, `${buildExportFileBaseName(new Date())}-transcricoes.docx`);
  }

  async function handleDownloadSingleAudioDocx(itemId: string) {
    const item = getCurrentItem(itemId);

    if (!item?.transcription) {
      setAppError("A transcrição deste áudio ainda não está disponível para exportar.");
      return;
    }

    const blob = await buildDocxBlob({
      fileTitle: `Leste Audio IA - ${item.name}`,
      sections: [{ title: `Áudio: ${item.name}`, content: buildSingleAudioExportSection(item) }],
    });

    downloadBlob(blob, `${buildExportFileBaseName(new Date())}-${item.id.slice(0, 6)}.docx`);
  }

  async function handleDownloadCompleteSessionDocx() {
    const completedItems = itemsRef.current.filter((item) => item.transcription?.trim());

    if (!completedItems.length) {
      setAppError("Não há transcrições prontas para exportar.");
      return;
    }

    const sections: Array<{ title: string; content: string }> = [];
    for (const item of completedItems) {
      if (docxSelection.transcriptions && item.transcription) {
        sections.push({ title: `Transcrição: ${item.name}`, content: item.transcription });
      }
      if (docxSelection.individualSummaries && item.summary) {
        sections.push({ title: `Resumo individual: ${item.name}`, content: item.summary });
      }
      if (docxSelection.individualOrganization && item.organizedText) {
        sections.push({ title: `Organização individual: ${item.name}`, content: item.organizedText });
      }
      if (docxSelection.individualInterpretations && item.audioIntelligence) {
        const analysis = item.audioIntelligence;
        sections.push({
          title: `Interpretação individual: ${item.name}`,
          content: [
            `Assunto: ${analysis.subject}`,
            `Contexto: ${analysis.context}`,
            `Intenção: ${analysis.primaryIntent}`,
            analysis.summary,
            "Pontos principais:",
            analysis.keyPoints.join("\n"),
            "Tarefas:",
            analysis.tasks.map((task) => task.title).join("\n"),
            "Decisões:",
            analysis.decisions.map((decision) => decision.text).join("\n"),
          ].filter(Boolean).join("\n\n"),
        });
      }
    }
    if (docxSelection.unifiedTranscript) {
      const fullText = buildFullUnifiedTranscript();
      if (fullText) sections.push({ title: "Texto integral unificado", content: fullText });
    }

    const generalSections: Array<[SessionDocxKey, string, string]> = [
      ["sessionSummary", "Resumo consolidado", generalResults.summary],
      ["sessionOrganization", "Organização geral por contexto", generalResults.organized],
      ["sessionInterpretation", "Interpretação geral", generalResults.analysis],
      ["tasks", "Tarefas e decisões", generalResults.tasks],
      ["keyData", "Dados-chave", generalResults.keyData],
      ["reply", "Resposta pronta para WhatsApp", generalResults.reply],
      ["intent", "Intenção geral", generalResults.intent],
      ["narrative", sessionNarrativeStale ? "Narrativa final revisada (anterior à última alteração)" : "Narrativa final revisada", sessionNarrative],
    ];
    for (const [key, title, content] of generalSections) {
      if (docxSelection[key] && content.trim()) sections.push({ title, content });
    }

    if (!sections.length) {
      setAppError("Selecione ao menos uma seção disponível para incluir no DOCX.");
      return;
    }

    const blob = await buildDocxBlob({
      fileTitle: "Leste Audio IA - Conteúdo selecionado da sessão",
      sections,
    });

    downloadBlob(blob, `${buildExportFileBaseName(new Date())}-conteudo-selecionado.docx`);
  }

  function handleDownloadOrganizedTxt() {
    const hasGeneralContent = Object.values(generalResults).some((value) => value.trim());

    if (!hasGeneralContent) {
      setAppError("Gere ao menos um resultado geral antes de exportar o conteúdo organizado.");
      return;
    }

    const blob = new Blob(
      [
        buildOrganizedExportText({
          generalSummary: generalResults.summary,
          generalOrganizedText: generalResults.organized,
          generalAnalysis: generalResults.analysis,
          generalTasks: generalResults.tasks,
          generalKeyData: generalResults.keyData,
          generalReply: generalResults.reply,
          generalIntent: generalResults.intent,
          generalNarrative: sessionNarrative,
          promptResult,
        }),
      ],
      {
        type: "text/plain;charset=utf-8",
      },
    );

    downloadBlob(blob, `${buildExportFileBaseName(new Date())}-organizacao-geral.txt`);
  }

  async function handleDownloadOrganizedDocx() {
    const sections = [
      { title: "Resumo geral", content: generalResults.summary },
      { title: "Organização geral", content: generalResults.organized },
      { title: "Interpretação geral", content: generalResults.analysis },
      { title: "Tarefas e pendências", content: generalResults.tasks },
      { title: "Dados-chave", content: generalResults.keyData },
      { title: "Resposta pronta para WhatsApp", content: generalResults.reply },
      { title: "Intenção consolidada", content: generalResults.intent },
      { title: "Prompt final", content: promptResult },
    ].filter((section) => section.content.trim());

    if (!sections.length) {
      setAppError("Gere ao menos um resultado geral antes de exportar o conteúdo organizado.");
      return;
    }

    const blob = await buildDocxBlob({
      fileTitle: "Leste Audio IA - Organização geral",
      sections,
    });

    downloadBlob(blob, `${buildExportFileBaseName(new Date())}-organizacao-geral.docx`);
  }

  function clearPdfSpeechResults() {
    (["pdf-original", "pdf-analysis", "pdf-summary", "pdf-interpretation", "pdf-organized", "pdf-grammar", "pdf-clean"] as const).forEach(
      clearSpeechResult,
    );

    for (const key of Object.keys(speechAudioUrlsRef.current)) {
      if (key.startsWith("pdf-audiobook:")) {
        clearSpeechResult(key as AudiobookSpeechKey);
      }
    }
  }

  function clearFreeTextSpeechResult() {
    clearSpeechResult("text-voice");
  }

  function clearImageSpeechResult() {
    clearSpeechResult("image-text");
  }

  function handleFreeTextChange(value: string) {
    clearFreeTextSpeechResult();
    setFreeTextValue(value);
  }

  function handleClearFreeText() {
    clearFreeTextSpeechResult();
    setFreeTextValue("");
  }

  function clearImagePreviewUrl() {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
  }

  function handleClearImageText() {
    clearImageSpeechResult();
    clearImagePreviewUrl();
    setImageTextState(null);
    setImageTextError(undefined);
  }

  async function handleImageSelected(file: File) {
    const extension = file.name.toLowerCase().split(".").pop() ?? "";
    const mimeType = file.type.toLowerCase();
    const maxFileSizeBytes = config.maxFileSizeMb * 1024 * 1024;

    setImageTextError(undefined);

    if (
      !["png", "jpg", "jpeg", "webp"].includes(extension) ||
      !["image/png", "image/jpeg", "image/webp"].includes(mimeType)
    ) {
      setImageTextError("Envie uma imagem válida em PNG, JPG, JPEG ou WEBP.");
      return;
    }

    if (file.size > maxFileSizeBytes) {
      setImageTextError(`Imagem acima do limite de ${config.maxFileSizeMb} MB.`);
      return;
    }

    setLoadingState("image:extract", true);
    clearImageSpeechResult();
    clearImagePreviewUrl();
    setImageTextState(null);

    const previewUrl = URL.createObjectURL(file);
    imagePreviewUrlRef.current = previewUrl;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/image-extract", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        ok: boolean;
        text?: string;
        error?: string;
        meta?: {
          fileName: string;
          size: number;
        };
      };

      if (!response.ok || !payload.ok || !payload.text) {
        throw new Error(payload.error || "Falha ao gerar texto da imagem.");
      }

      setImageTextState({
        fileName: payload.meta?.fileName ?? file.name,
        fileSize: payload.meta?.size ?? file.size,
        previewUrl,
        text: normalizePlainText(payload.text),
      });

      addSource("image", payload.meta?.fileName ?? file.name, normalizePlainText(payload.text));
    } catch (error) {
      clearImagePreviewUrl();
      setImageTextError(buildApiErrorMessage(error));
    } finally {
      setLoadingState("image:extract", false);
    }
  }

  async function handlePdfSelected(file: File) {
    const extension = file.name.toLowerCase().split(".").pop();
    const maxFileSizeBytes = config.maxFileSizeMb * 1024 * 1024;

    setPdfError(undefined);

    const isPdf = extension === "pdf" || file.type === "application/pdf";
    const isDocx =
      extension === "docx" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (!isPdf && !isDocx) {
      setPdfError("Envie um arquivo PDF ou DOCX válido.");
      return;
    }

    if (file.size > maxFileSizeBytes) {
      setPdfError(`Documento acima do limite de ${config.maxFileSizeMb} MB.`);
      return;
    }

    const operationId = nanoid();
    pdfOperationIdRef.current = operationId;
    setLoadingState("pdf:extract", true);
    clearPdfSpeechResults();
    cancelPdfAudiobookRef.current = true;
    setPdfAudiobook(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/pdf-extract", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        ok: boolean;
        text?: string;
        error?: string;
        meta?: {
          fileName: string;
          size: number;
        };
      };

      if (!response.ok || !payload.ok || !payload.text) {
        throw new Error(payload.error || "Falha ao extrair texto do documento.");
      }

      const extractedText = normalizePlainText(payload.text);

      setPdfState({
        fileName: payload.meta?.fileName ?? file.name,
        fileSize: payload.meta?.size ?? file.size,
        text: extractedText,
        results: EMPTY_PDF_RESULTS,
      });
      setPdfAudiobook(createPdfAudiobook(extractedText, "natural"));

      addSource(isDocx ? "docx" : "pdf", payload.meta?.fileName ?? file.name, extractedText);

      void handleAutomaticDocumentAnalysis(extractedText, operationId);
      void handlePreparePdfAudiobook("natural", extractedText, operationId);
    } catch (error) {
      if (pdfOperationIdRef.current === operationId) {
        setPdfError(buildApiErrorMessage(error));
      }
    } finally {
      if (pdfOperationIdRef.current === operationId) {
        setLoadingState("pdf:extract", false);
      }
    }
  }

  async function handleProcessPdf(
    mode: PdfResultKey,
    sourceText = pdfState?.text,
    operationId?: string,
  ) {
    if (!sourceText) {
      if (!operationId || pdfOperationIdRef.current === operationId) {
        setPdfError("Envie um PDF ou DOCX antes de usar a IA.");
      }
      return;
    }

    if (operationId && pdfOperationIdRef.current !== operationId) {
      return;
    }

    const loadingKey = `pdf:${mode}`;
    setLoadingState(loadingKey, true);
    setPdfError(undefined);
    clearSpeechResult(`pdf-${mode}` as PdfSpeechKey);

    try {
      const result = await runTextTask("/api/pdf-process", {
        text: sourceText,
        mode,
      });

      if (!operationId || pdfOperationIdRef.current === operationId) {
        setPdfState((current) =>
          current
            ? {
                ...current,
                results: {
                  ...current.results,
                  [mode]: result,
                },
              }
            : current,
        );
      }
    } catch (error) {
      if (!operationId || pdfOperationIdRef.current === operationId) {
        setPdfError(buildApiErrorMessage(error));
      }
    } finally {
      if (!operationId || pdfOperationIdRef.current === operationId) {
        setLoadingState(loadingKey, false);
      }
    }
  }

  async function handleAutomaticDocumentAnalysis(sourceText: string, operationId: string) {
    // Process long documents one task at a time to avoid competing for model limits.
    for (const mode of ["analysis", "summary", "interpretation"] as const) {
      if (pdfOperationIdRef.current !== operationId) {
        return;
      }

      await handleProcessPdf(mode, sourceText, operationId);
    }
  }

  function handleClearPdf() {
    pdfOperationIdRef.current = null;
    cancelPdfAudiobookRef.current = true;
    clearPdfSpeechResults();
    setPdfState(null);
    setPdfAudiobook(null);
    setPdfError(undefined);
  }

  async function handlePreparePdfAudiobook(
    mode: NarrationPrepMode,
    sourceText = pdfState?.text,
    operationId?: string,
  ) {
    if (!sourceText) {
      if (!operationId || pdfOperationIdRef.current === operationId) {
        setPdfError("Envie um PDF ou DOCX antes de preparar o audiolivro.");
      }
      return;
    }

    if (operationId && pdfOperationIdRef.current !== operationId) {
      return;
    }

    cancelPdfAudiobookRef.current = true;
    setPdfAudiobook((current) =>
      current
        ? {
            ...current,
            mode,
            isPreparing: true,
            error: undefined,
          }
        : current,
    );

    try {
      const response = await fetch("/api/prepare-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, mode }),
      });
      const payload = await parseJsonResponse<TextProcessResponse>(response);

      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(payload.error || "Falha ao preparar o audiolivro.");
      }

      if (operationId && pdfOperationIdRef.current !== operationId) {
        return;
      }

      const prepared = JSON.parse(payload.result) as PreparedText;
      const preparedText = prepared.prepared?.trim();

      if (!preparedText) {
        throw new Error("A preparação não retornou texto para narração.");
      }

      clearPdfSpeechResults();
      cancelPdfAudiobookRef.current = false;
      setPdfAudiobook({
        source: "prepared",
        mode,
        chapters: buildAudiobookChapters(preparedText),
        isPreparing: false,
        isGenerating: false,
      });
    } catch (error) {
      if (!operationId || pdfOperationIdRef.current === operationId) {
        setPdfAudiobook((current) =>
          current
            ? {
                ...current,
                isPreparing: false,
                error: buildApiErrorMessage(error),
              }
            : current,
        );
      }
    }
  }

  async function generatePdfAudiobookChapter(chapterId: string) {
    const audiobook = pdfAudiobookRef.current;
    const chapter = audiobook?.chapters.find((item) => item.id === chapterId);

    if (!audiobook || !chapter || !chapter.text.trim()) {
      return false;
    }

    const speechKey = `pdf-audiobook:${chapter.id}` as AudiobookSpeechKey;
    clearSpeechResult(speechKey);
    setPdfAudiobook((current) =>
      current
        ? {
            ...current,
            error: undefined,
            chapters: current.chapters.map((item) =>
              item.id === chapter.id ? { ...item, status: "generating" } : item,
            ),
          }
        : current,
    );

    const url = await handleSpeakText(speechKey, chapter.title, chapter.text, { style: "audiolivro" });

    setPdfAudiobook((current) =>
      current
        ? {
            ...current,
            chapters: current.chapters.map((item) =>
              item.id === chapter.id ? { ...item, status: url ? "done" : "error" } : item,
            ),
          }
        : current,
    );

    return Boolean(url);
  }

  async function handleGeneratePdfAudiobookAll() {
    const audiobook = pdfAudiobookRef.current;

    if (!audiobook || audiobook.isPreparing || audiobook.isGenerating) {
      return;
    }

    cancelPdfAudiobookRef.current = false;
    setPdfAudiobook((current) => (current ? { ...current, isGenerating: true, error: undefined } : current));

    for (const chapter of audiobook.chapters) {
      if (cancelPdfAudiobookRef.current) {
        break;
      }

      const existingUrl = speechAudioUrlsRef.current[`pdf-audiobook:${chapter.id}`];

      if (chapter.status === "done" && existingUrl) {
        continue;
      }

      await generatePdfAudiobookChapter(chapter.id);
    }

    setPdfAudiobook((current) => (current ? { ...current, isGenerating: false } : current));
  }

  function handleCancelPdfAudiobookGeneration() {
    cancelPdfAudiobookRef.current = true;
    setPdfAudiobook((current) => (current ? { ...current, isGenerating: false } : current));
  }

  async function handleDownloadPdfAudiobook() {
    const audiobook = pdfAudiobookRef.current;

    if (!audiobook?.chapters.length) {
      setPdfError("Não há capítulos para baixar.");
      return;
    }

    const urls = audiobook.chapters.map((chapter) => speechAudioUrlsRef.current[`pdf-audiobook:${chapter.id}`]);

    if (urls.some((url) => !url)) {
      setPdfError("Gere todos os capítulos antes de baixar o audiobook completo.");
      return;
    }

    try {
      const parts = await Promise.all(urls.map((url) => fetch(url!).then((response) => response.arrayBuffer())));
      const blob = new Blob(parts, { type: "audio/mpeg" });
      const safeName = (pdfState?.fileName ?? "audiobook")
        .replace(/\.[^.]+$/, "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();

      downloadBlob(blob, `audiobook-milena-${safeName || "livro"}.mp3`);
    } catch (error) {
      setPdfError(`Não foi possível reunir os capítulos em MP3. ${buildApiErrorMessage(error)}`);
    }
  }

  function handleRemoveItem(itemId: string) {
    const item = getCurrentItem(itemId);

    if (!item || isActiveStatus(item.status)) {
      return;
    }

    cancelledIdsRef.current.add(itemId);
    batchQueueRef.current.pendingIds = batchQueueRef.current.pendingIds.filter((id) => id !== itemId);
    markAggregateStale("full");
    setTaskErrorState(`summary:${itemId}`);
    setTaskErrorState(`organize:${itemId}`);
    setTaskErrorState(`intelligence:${itemId}`);

    itemsRef.current = itemsRef.current.filter((entry) => entry.id !== itemId);
    setItems(itemsRef.current);
    setContinuityPlan((current) => current ? {
      ...current,
      groups: current.groups.map((group) => ({ ...group, itemIds: group.itemIds.filter((id) => id !== itemId) })).filter((group) => group.itemIds.length),
    } : null);
  }

  function handleRenameSpeaker(itemId: string, speakerId: string, label: string) {
    const normalizedLabel = label.trim() || "Falante não identificado";
    updateItem(itemId, (current) => ({
      speakers: (current.speakers ?? []).map((speaker) => speaker.id === speakerId ? { ...speaker, label: normalizedLabel } : speaker),
      segments: (current.segments ?? []).map((segment) => segment.speakerId === speakerId ? { ...segment, speakerLabel: normalizedLabel } : segment),
    }));
  }

  async function handleRetryItem(itemId: string) {
    try {
      await transcribeItem(itemId);
    } catch {
      return;
    }
  }

  function handleClearAll() {
    if (batchQueueRef.current.status !== "idle") cancelTranscriptionQueue();
    sessionEpochRef.current += 1;
    editorialSnapshotRef.current = null;
    setEditorialRestoreSnapshot(null);
    itemsRef.current = [];
    clearAllSpeechResults();

    startTransition(() => {
      cancelledIdsRef.current.clear();
      analyzedItemIdsRef.current.clear();
      setItems([]);
      setGeneralResults(EMPTY_GENERAL_RESULTS);
      setPromptResult("");
      setSessionNarrative("");
      setSessionNarrativeStale(false);
      setWorkflowHasOutput(false);
      setWorkflowResetKey((current) => current + 1);
      markAggregateFresh();
      setAnalysisProgress("");
      setLastAnalysisBlocks(0);
      setLoadingMap({});
      setTaskErrors({});
      setPdfState(null);
      pdfOperationIdRef.current = null;
      setPdfAudiobook(null);
      setPdfError(undefined);
      setFreeTextValue("");
      handleClearImageText();
      setSpeechErrors({});
      setCopiedKey(null);
      setAppError(null);
      setQueueNotice("");
      setSources([]);
      setContextText("");
      setLastActionResult(null);
      setContinuityPlan(null);
      setSessionTranscriptOrder("context");
    });
  }

  const captureProjectSnapshot = useCallback(async (): Promise<LocalProjectSnapshot> => {
    const savedAudioItems: SavedAudioItem[] = items
      .map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        type: item.type,
        extension: item.extension,
        status: item.status === "done" ? "done" : "error",
        progress: item.status === "done" ? 100 : 0,
        includeInAnalysis: item.includeInAnalysis,
        isDuplicate: item.isDuplicate,
        transcription: item.transcription,
        segments: item.segments,
        speakers: item.speakers,
        segmentWarning: item.segmentWarning,
        summary: item.summary,
        organizedText: item.organizedText,
        autoDetectedIntent: item.autoDetectedIntent,
        audioIntelligence: item.audioIntelligence,
        generatedContents: item.generatedContents,
        error: item.error ?? (item.status === "done" ? undefined : "Arquivo de áudio original não incluído no salvamento local; envie novamente para processar."),
      }));

    return {
      version: 1,
      savedAudioItems,
      generalResults: { ...generalResults },
      promptResult,
      pdf: pdfState ? { ...pdfState, results: { ...pdfState.results } } : null,
      pdfAudiobook: pdfAudiobook ? {
        source: pdfAudiobook.source,
        mode: pdfAudiobook.mode,
        chapters: pdfAudiobook.chapters.map(({ status: _status, ...chapter }) => chapter),
      } : null,
      freeTextValue,
      imageText: imageTextState ? {
        fileName: imageTextState.fileName,
        fileSize: imageTextState.fileSize,
        text: imageTextState.text,
      } : null,
      sources: structuredClone(sources),
      contextText,
      lastActionResult,
      lastActionMode,
      continuityPlan: continuityPlan ? structuredClone(continuityPlan) : null,
      sessionTranscriptOrder,
      sessionNarrative,
      sessionNarrativeStale,
      sessionNarrativeFormat,
      docxSelection: { ...docxSelection },
      editorial: editorialSnapshotRef.current ? structuredClone(editorialSnapshotRef.current) : null,
    };
  }, [items, generalResults, promptResult, pdfState, pdfAudiobook, freeTextValue, imageTextState, sources, contextText, lastActionResult, lastActionMode, continuityPlan, sessionTranscriptOrder, sessionNarrative, sessionNarrativeStale, sessionNarrativeFormat, docxSelection]);

  async function restoreProjectSnapshot(snapshot: LocalProjectSnapshot) {
    cancelTranscriptionQueue();
    sessionEpochRef.current += 1;
    clearAllSpeechResults();
    clearImagePreviewUrl();
    for (const url of Object.values(audioPreviewUrlsRef.current)) URL.revokeObjectURL(url);
    audioPreviewUrlsRef.current = {};
    setAudioPreviewUrls({});
    const restoredItems: AudioItem[] = snapshot.savedAudioItems.map((item) => ({
      ...item,
      file: new File([], item.name, { type: item.type || "application/octet-stream" }),
      originalFileAvailable: false,
      status: item.status,
      progress: item.status === "done" ? 100 : 0,
    }));
    itemsRef.current = restoredItems;
    setItems(restoredItems);
    setGeneralResults({ ...EMPTY_GENERAL_RESULTS, ...snapshot.generalResults });
    setPromptResult(snapshot.promptResult ?? "");
    setPdfState(snapshot.pdf ? { ...snapshot.pdf, results: { ...EMPTY_PDF_RESULTS, ...snapshot.pdf.results } } : null);
    setPdfAudiobook(snapshot.pdfAudiobook ? {
      source: snapshot.pdfAudiobook.source,
      mode: snapshot.pdfAudiobook.mode,
      chapters: snapshot.pdfAudiobook.chapters.map((chapter) => ({ ...chapter, status: "pending" as const })),
      isPreparing: false,
      isGenerating: false,
    } : null);
    setFreeTextValue(snapshot.freeTextValue ?? "");
    setImageTextState(snapshot.imageText ? { ...snapshot.imageText, previewUrl: "" } : null);
    setSources(snapshot.sources ?? []);
    setContextText(snapshot.contextText ?? "");
    setLastActionResult(snapshot.lastActionResult ?? null);
    setLastActionMode(snapshot.lastActionMode ?? null);
    setContinuityPlan(snapshot.continuityPlan ?? null);
    setSessionTranscriptOrder(snapshot.sessionTranscriptOrder ?? "context");
    setSessionNarrative(snapshot.sessionNarrative ?? "");
    setSessionNarrativeStale(Boolean(snapshot.sessionNarrativeStale));
    setSessionNarrativeFormat(snapshot.sessionNarrativeFormat ?? "faithful");
    setDocxSelection((current) => ({ ...current, ...(snapshot.docxSelection ?? {}) }));
    editorialSnapshotRef.current = snapshot.editorial ? structuredClone(snapshot.editorial) : null;
    setEditorialRestoreSnapshot(snapshot.editorial ?? null);
    setWorkflowHasOutput(Boolean(snapshot.editorial?.outline || Object.keys(snapshot.editorial?.chapters ?? {}).length || snapshot.editorial?.meetingReport || snapshot.generalResults?.analysis));
    setWorkflowResetKey((current) => current + 1);
    setAnalysisProgress("");
    setLastAnalysisBlocks(0);
    setLoadingMap({});
    setTaskErrors({});
    setSpeechErrors({});
    setPdfError(undefined);
    setImageTextError(undefined);
    setAppError(null);
    setCopiedKey(null);
    setQueueNotice("Projeto retomado. Os áudios originais não são armazenados; envie-os novamente se precisar reproduzir ou retranscrever.");
    markAggregateFresh();
  }

  const handleEditorialSnapshotChange = useCallback((snapshot: EditorialWorkflowSnapshot) => {
    editorialSnapshotRef.current = snapshot;
  }, []);

  const completedCount = items.filter((item) => item.status === "done").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const queuedCount = items.filter((item) => item.status === "queued").length;
  const activeCount = items.filter((item) => isActiveStatus(item.status)).length;
  const analysisItemCount = items.filter((item) => item.transcription && item.includeInAnalysis !== false).length;
  const excludedAnalysisCount = items.filter((item) => item.transcription && item.includeInAnalysis === false).length;
  const unanalyzedItemCount = items.filter((item) =>
    item.transcription && item.includeInAnalysis !== false && !analyzedItemIdsRef.current.has(item.id),
  ).length;
  const hasGeneralResults = Object.values(generalResults).some((value) => value.trim());
  const hasCompletedTranscriptions = items.some((item) => Boolean(item.transcription));
  const hasPromptSource =
    hasCompletedTranscriptions || Object.values(generalResults).some((value) => value.trim());
  const progressPercent = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const addMoreAccept = ALLOWED_AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(",");
  const previewItems = items
    .filter((item) => item.transcription && audioPreviewUrls[item.id])
    .map((item) => ({
      id: item.id,
      name: item.name,
      url: audioPreviewUrls[item.id],
    }));

  // --- Central Inteligente: Source Management ---

  const addSource = useCallback(
    (type: ContentSource["type"], name: string, extractedContent: string, originalContent?: string, metadata?: Record<string, unknown>) => {
      const source: ContentSource = {
        id: nanoid(),
        type,
        name,
        originalContent,
        extractedContent,
        createdAt: new Date().toISOString(),
        metadata: metadata ?? {},
        enabledInContext: true,
      };
      setSources((prev) => [...prev, source]);
      return source;
    },
    [],
  );

  const toggleSourceEnabled = useCallback((sourceId: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, enabledInContext: !s.enabledInContext } : s)),
    );
  }, []);

  const removeSource = useCallback((sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
  }, []);

  const consolidatedContext = useMemo(() => {
    const enabled = sources.filter((s) => s.enabledInContext);
    if (!enabled.length) return contextText;
    const parts = enabled.map((s) => {
      const header = `--- ${s.type.toUpperCase()}: ${s.name} ---`;
      return `${header}\n${s.extractedContent}`;
    });
    if (contextText.trim()) {
      parts.push(`--- TEXTO DO EDITOR ---\n${contextText}`);
    }
    return parts.join("\n\n");
  }, [sources, contextText]);

  const editorialWorkflowSources = useMemo<AnalyzeAllItem[]>(() => {
    const enabledSources = sources
      .filter((source) => {
        if (!source.enabledInContext || !source.extractedContent.trim()) return false;
        const audioItemId = source.metadata.audioItemId;
        return source.type !== "audio" || typeof audioItemId !== "string" || !items.some((item) => item.id === audioItemId && item.includeInAnalysis === false);
      })
      .map((source) => {
        const isDerived = source.type === "generated" || source.metadata.provenance === "ai-derived";
        return {
          id: source.id,
          name: isDerived ? `CONTEÚDO DERIVADO/IA — ${source.name} (não é fala original nem fato confirmado)` : source.name,
          transcription: source.extractedContent,
        };
      });
    const manualContext = contextText.trim();
    const contextAlreadyContainsSources = enabledSources.length > 0 && enabledSources.every((source) => {
      const marker = source.transcription.trim().slice(0, Math.min(120, source.transcription.trim().length));
      return marker.length > 0 && manualContext.includes(marker);
    });
    const baseSources: AnalyzeAllItem[] = [
      ...enabledSources,
      ...(manualContext ? [{ name: contextAlreadyContainsSources ? "CONTEXTO DE APOIO revisado (pode repetir fontes)" : "CONTEXTO DE APOIO adicional", transcription: manualContext }] : []),
    ];
    if (freeTextValue.trim()) baseSources.push({ name: "Texto livre", transcription: freeTextValue.trim() });

    const uniqueSources = new Map<string, AnalyzeAllItem>();
    for (const source of baseSources) {
      const key = `${source.name}\u0000${source.transcription}`;
      uniqueSources.set(key, source);
    }
    return Array.from(uniqueSources.values());
  }, [sources, items, contextText, freeTextValue]);

  const askFileSources = useMemo<AskFileSource[]>(() => {
    const audioSources = items
      .filter((item) => item.transcription)
      .map((item) => ({
        sourceId: `audio:${item.id}`,
        sourceName: item.name,
        sourceType: "Áudio transcrito",
        chunks: item.segments?.length
          ? item.segments.map((segment) => ({
              chunkId: segment.id,
              text: segment.text,
              speakerLabel: segment.speakerLabel,
              startSeconds: segment.startSeconds,
              endSeconds: segment.endSeconds,
            }))
          : [{ chunkId: "transcricao", text: item.transcription! }],
      }));
    const documentSources = sources
      .filter((source) => source.type !== "audio" && source.extractedContent.trim())
      .map((source) => ({
        sourceId: `source:${source.id}`,
        sourceName: source.name,
        sourceType: SOURCE_TYPE_LABELS[source.type],
        chunks: [{ chunkId: "conteudo", text: source.extractedContent }],
      }));
    return [...audioSources, ...documentSources];
  }, [items, sources]);

  const searchEntries = useMemo<SessionSearchEntry[]>(() => {
    const audioEntries = items.flatMap((item) => {
      if (!item.transcription) return [];
      const transcriptEntries = item.segments?.length
        ? item.segments.map((segment) => ({ id: `segment:${item.id}:${segment.id}`, sourceName: item.name, sourceType: "Transcrição", text: segment.text, speakerLabel: segment.speakerLabel, startSeconds: segment.startSeconds, endSeconds: segment.endSeconds, audioItemId: item.id }))
        : [{ id: `transcription:${item.id}`, sourceName: item.name, sourceType: "Transcrição", text: item.transcription, audioItemId: item.id }];
      return [...transcriptEntries, ...(item.summary ? [{ id: `summary:${item.id}`, sourceName: item.name, sourceType: "Resumo do áudio", text: item.summary, audioItemId: item.id }] : []), ...(item.organizedText ? [{ id: `organized:${item.id}`, sourceName: item.name, sourceType: "Conteúdo organizado", text: item.organizedText, audioItemId: item.id }] : [])];
    });
    const documentEntries = sources.filter((source) => source.type !== "audio" && source.extractedContent.trim()).map((source) => ({ id: `source:${source.id}`, sourceName: source.name, sourceType: SOURCE_TYPE_LABELS[source.type], text: source.extractedContent }));
    const generalEntries = Object.entries(generalResults).filter(([, text]) => text.trim()).map(([key, text]) => ({ id: `general:${key}`, sourceName: "Painel geral", sourceType: MODE_DISPLAY_LABELS[key as UnifiedAction] ?? key, text }));
    return [...audioEntries, ...documentEntries, ...generalEntries];
  }, [generalResults, items, sources]);

  const runUnifiedAction = useCallback(
    async (action: UnifiedAction, extraParams?: Record<string, string>) => {
      const text = consolidatedContext;
      if (!text.trim()) {
        setAppError("Adicione conteúdo ao contexto antes de executar uma ação.");
        return;
      }

      setIsAnalyzing(true);
      setLastActionResult(null);
      setLastActionMode(action);
      setAppError(null);

      const textCorrectModes: UnifiedAction[] = ["corrigir_texto", "reescrever", "encurtar", "expandir", "humanizar", "profissionalizar", "melhorar_clareza", "remover_repeticoes"];
      const analyzeContextModes: UnifiedAction[] = ["compreensao_global", "interpretacao", "extracao", "mapeamentos", "diagnostico", "recomendacoes", "criacao", "processo_criativo", "comparacao"];

      try {
        if (textCorrectModes.includes(action)) {
          const modeMap: Partial<Record<UnifiedAction, string>> = {
            corrigir_texto: "corrigir",
            reescrever: "reescrever",
            encurtar: "encurtar",
            expandir: "expandir",
            humanizar: "humanizar",
            profissionalizar: "profissional",
            melhorar_clareza: "clareza",
            remover_repeticoes: "remover_repeticoes",
          };
          const response = await fetch("/api/text-correct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, mode: modeMap[action] }),
          });
          const payload = (await response.json()) as TextProcessResponse;
          if (!response.ok || !payload.ok || !payload.result) {
            throw new Error(payload.error || "Falha ao processar.");
          }
          setLastActionResult(payload.result);
        } else if (action === "entender_intencao") {
          const response = await fetch("/api/detect-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          const payload = (await response.json()) as TextProcessResponse;
          if (!response.ok || !payload.ok || !payload.result) {
            throw new Error(payload.error || "Falha ao detectar intenção.");
          }
          setLastActionResult(payload.result);
        } else if (analyzeContextModes.includes(action)) {
          const response = await fetch("/api/analyze-context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, mode: action, ...extraParams }),
          });
          const payload = (await response.json()) as TextProcessResponse;
          if (!response.ok || !payload.ok || !payload.result) {
            throw new Error(payload.error || "Falha na análise.");
          }
          setLastActionResult(payload.result);
        } else {
          const mode = action === "extrair_tarefas" ? "tasks" : action === "extrair_dados" ? "keyData" : "analysis";
          const response = await runChunkedSessionTask(
            "/api/analyze-all",
            [{ name: "Contexto consolidado", transcription: text }],
            mode,
            "Ação inteligente",
          );
          setLastActionResult(response.result);
        }
      } catch (err) {
        setAppError(err instanceof Error ? err.message : "Erro ao executar ação.");
      } finally {
        setAnalysisProgress("");
        setIsAnalyzing(false);
      }
    },
    [consolidatedContext, runChunkedSessionTask],
  );

  const handleAnalisarCriar = useCallback(async () => {
    const text = consolidatedContext;
    if (!text.trim()) {
      setAppError("Adicione conteúdo antes de analisar.");
      return;
    }

    setIsAnalyzing(true);
    setLastActionResult(null);
    setLastActionMode("analisar_e_criar");
    setAppError(null);

    try {
      const { result } = await runChunkedSessionTask(
        "/api/analyze-all",
        [{ name: "Contexto completo", transcription: text }],
        "analysis",
        "Analisar e Criar",
      );
      setLastActionResult(result);
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Erro na análise.");
    } finally {
      setAnalysisProgress("");
      setIsAnalyzing(false);
    }
  }, [consolidatedContext, runChunkedSessionTask]);

  const hasEditorialInput = editorialWorkflowSources.length > 0;
  const hasProcessedMaterial = hasCompletedTranscriptions || Boolean(pdfState?.text) || sources.length > 0;
  const hasUnderstandingOutput = hasGeneralResults || Boolean(continuityPlan);
  const hasCreationOutput = workflowHasOutput || Boolean(sessionNarrative.trim());
  const stageState = (complete: boolean, available: boolean): ProductionStage["state"] =>
    complete ? "complete" : available ? "active" : "ready";
  const productionStages: ProductionStage[] = [
    { key: "intake", title: "Adicionar fontes", detail: "Áudio, documentos, imagem, texto, Reels e YouTube", targetId: "workflow-intake", state: stageState(hasEditorialInput, false) },
    { key: "process", title: "Transcrever e extrair", detail: "Fila de áudios, leitura de arquivos e vídeo", targetId: "workflow-processing", state: stageState(hasProcessedMaterial, hasEditorialInput || items.length > 0) },
    { key: "understand", title: "Entender e organizar", detail: "Contexto, sequência, decisões e intenção", targetId: "workflow-understanding", state: stageState(hasUnderstandingOutput, hasProcessedMaterial) },
    { key: "create", title: "Escrever e transformar", detail: "Biografia, reunião, narrativa e voz", targetId: "workflow-writing", state: stageState(hasCreationOutput, hasEditorialInput) },
    { key: "video", title: "Produzir vídeo", detail: "Cortes inteligentes como etapa própria", targetId: "workflow-video", state: "ready" },
    { key: "delivery", title: "Revisar e entregar", detail: "Conferir, copiar e baixar os resultados", targetId: "workflow-delivery", state: stageState(false, hasProcessedMaterial || hasUnderstandingOutput || hasCreationOutput) },
  ];

  const handleUseResultAsContext = useCallback(() => {
    if (!lastActionResult) return;
    setContextText(lastActionResult);
    setLastActionResult(null);
  }, [lastActionResult]);

  const handleUseEditorialResultAsContext = useCallback((text: string) => {
    if (!text.trim()) return;
    const source: ContentSource = {
      id: nanoid(),
      type: "generated",
      name: `Produção editorial derivada — ${new Date().toLocaleDateString("pt-BR")}`,
      extractedContent: text.trim(),
      createdAt: new Date().toISOString(),
      metadata: { provenance: "ai-derived", derivedFrom: "editorial-workflow", evidenceMustBeRechecked: true },
      enabledInContext: true,
    };
    setSources((current) => [...current, source]);
    setContextText((current) => [current.trim(), `--- CONTEÚDO DERIVADO PELA IA — NÃO É FALA ORIGINAL NEM FATO CONFIRMADO ---\n${text.trim()}`].filter(Boolean).join("\n\n"));
    window.requestAnimationFrame(() => {
      contextEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      contextEditorRef.current?.focus({ preventScroll: true });
    });
  }, []);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppHeader appName={config.appName} hasLogo={hasLogo} />
        <ProductionFlowNav stages={productionStages} />

        <section className="scroll-mt-5 rounded-2xl border border-leste-blue/20 bg-gradient-to-r from-blue-50 to-white p-4 shadow-editorial sm:p-5" id="workflow-intake">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-leste-blue">Etapa 1 · Entrada</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Adicione áudio ou vídeo</h2>
            </div>
            <p className="text-sm text-slate-600">{items.length ? `${items.length} arquivo(s) na sessão` : "Escolha arquivos ou grave agora"}</p>
          </div>
          <div className="mb-3 space-y-3">
            <VideoLinkInput onAdd={handleVideoLinksAdded} />
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              ou envie do dispositivo
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
          <UploadArea
            acceptedExtensions={[...ALLOWED_AUDIO_EXTENSIONS]}
            maxFileSizeMb={config.maxFileSizeMb}
            onFilesSelected={handleFilesSelected}
            onRecordingReady={handleRecordedAudio}
          />
        </section>

        <details className="rounded-2xl border border-slate-200 bg-white shadow-editorial">
          <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold text-slate-800 sm:px-5">
            Ferramentas de texto e contexto <span className="font-normal text-slate-500">(opcional)</span>
          </summary>
          <div className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
        {/* CENTRAL INTELIGENTE */}
        <section className="rounded-lg border border-leste-blue/20 bg-gradient-to-r from-leste-blue/5 to-leste-gold/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950">
                <Brain className="h-6 w-6 text-leste-blue" />
                Central Inteligente
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ambiente unificado de análise, correção e transformação de qualquer conteúdo.
              </p>
            </div>
            <div className="flex gap-2">
              <ActionButton
                fullWidth={false}
                loading={isAnalyzing}
                onClick={handleAnalisarCriar}
                type="button"
                variant="primary"
              >
                {isAnalyzing ? (
                  <Sparkles className="h-4 w-4 animate-pulse" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Analisar e Criar
              </ActionButton>
            </div>
          </div>
        </section>

        {appError ? <ErrorBox message={appError} /> : null}

        {/* SOURCES PANEL */}
        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5" id="workflow-sources">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Layers className="h-4 w-4 text-leste-blue" />
              Fontes ({sources.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-400">Áudio</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-400">PDF</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-400">Imagem</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-400">Instagram</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-400">YouTube</span>
            </div>
          </div>

          {sources.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {sources.map((source) => (
                <div key={source.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <button className="shrink-0 text-slate-400 hover:text-leste-blue" onClick={() => toggleSourceEnabled(source.id)} type="button">
                    {source.enabledInContext ? <CheckSquare className="h-4 w-4 text-leste-blue" /> : <Square className="h-4 w-4" />}
                  </button>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{SOURCE_TYPE_LABELS[source.type]}</span>
                  <span className="flex-1 truncate text-slate-700">{source.name}</span>
                  <span className="text-[11px] text-slate-400">{source.extractedContent.length} caracteres</span>
                  <button className="shrink-0 text-slate-300 hover:text-red-500" onClick={() => removeSource(source.id)} type="button">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Nenhuma fonte adicionada. Transcrições de áudio, PDFs, imagens, Instagram Reels e vídeos do YouTube aparecerão aqui.</p>
          )}
        </section>

        {/* CONTEXT EDITOR */}
        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <ListTree className="h-4 w-4 text-leste-blue" />
              Contexto Consolidado
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <ActionButton fullWidth={false} onClick={() => runUnifiedAction("corrigir_texto")} type="button" variant="ghost">Corrigir</ActionButton>
              <ActionButton fullWidth={false} onClick={() => runUnifiedAction("reescrever")} type="button" variant="ghost">Reescrever</ActionButton>
              <ActionButton fullWidth={false} onClick={() => runUnifiedAction("humanizar")} type="button" variant="ghost">Humanizar</ActionButton>
              <ActionButton fullWidth={false} onClick={() => runUnifiedAction("profissionalizar")} type="button" variant="ghost">Profissional</ActionButton>
              <ActionButton fullWidth={false} onClick={() => runUnifiedAction("melhorar_clareza")} type="button" variant="ghost">Clareza</ActionButton>
              <ActionButton fullWidth={false} onClick={() => runUnifiedAction("encurtar")} type="button" variant="ghost">Encurtar</ActionButton>
              <ActionButton fullWidth={false} onClick={() => runUnifiedAction("expandir")} type="button" variant="ghost">Expandir</ActionButton>
              <ActionButton fullWidth={false} onClick={() => runUnifiedAction("remover_repeticoes")} type="button" variant="ghost">Sem repetições</ActionButton>
            </div>
          </div>

          <textarea
            ref={contextEditorRef}
            className="min-h-[200px] w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue focus:ring-2 focus:ring-leste-blue/20"
            onChange={(e) => setContextText(e.target.value)}
            placeholder="Digite, cole ou selecione fontes acima. O contexto consolidado aparecerá aqui automaticamente."
            value={consolidatedContext}
          />

          {lastActionResult ? (
            <div className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-amber-700">
                  {lastActionMode ? MODE_DISPLAY_LABELS[lastActionMode as UnifiedAction] ?? "Resultado" : "Resultado"}
                </h4>
                <div className="flex gap-2">
                  <ActionButton fullWidth={false} onClick={() => void handleCopy("action-result", lastActionResult)} type="button" variant="ghost">
                    {copiedKey === "action-result" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copiar
                  </ActionButton>
                  <ActionButton fullWidth={false} onClick={handleUseResultAsContext} type="button" variant="secondary">Usar como contexto</ActionButton>
                </div>
              </div>
              <textarea className="min-h-[120px] w-full rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none" readOnly value={lastActionResult} />
            </div>
          ) : null}
        </section>

        {/* ACTIONS LIBRARY */}
        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Lightbulb className="h-4 w-4 text-leste-blue" />
            Ações Inteligentes
          </h3>

          {/* Linha 1: Ações principais */}
          <div className="mb-3 flex flex-wrap gap-2">
            <ActionButton fullWidth={false} loading={isAnalyzing} onClick={handleAnalisarCriar} type="button" variant="primary">
              <Wand2 className="h-4 w-4" />
              Analisar e Criar
            </ActionButton>
            <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("entender_intencao")} type="button" variant="secondary">
              <Brain className="h-4 w-4" />
              Entender intenção
            </ActionButton>
            <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("extrair_tarefas")} type="button" variant="secondary">
              <CheckSquare className="h-4 w-4" />
              Extrair tarefas
            </ActionButton>
            <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("extrair_dados")} type="button" variant="secondary">
              <ListTree className="h-4 w-4" />
              Extrair dados
            </ActionButton>
          </div>

          {/* Linha 2: Análise profunda */}
          <details className="group mb-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700">
              Análise do contexto ▾
            </summary>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("compreensao_global")} type="button" variant="ghost">Compreensão global</ActionButton>
              <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("interpretacao")} type="button" variant="ghost">Interpretação</ActionButton>
              <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("extracao")} type="button" variant="ghost">Extração</ActionButton>
              <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("mapeamentos")} type="button" variant="ghost">Mapeamentos</ActionButton>
              <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("diagnostico")} type="button" variant="ghost">Diagnóstico</ActionButton>
              <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("recomendacoes")} type="button" variant="ghost">Recomendações</ActionButton>
              <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("criacao")} type="button" variant="ghost">Criação</ActionButton>
              <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("processo_criativo")} type="button" variant="ghost">Processo Criativo</ActionButton>
              <ActionButton fullWidth={false} loading={isAnalyzing} onClick={() => runUnifiedAction("comparacao")} type="button" variant="ghost">Comparação</ActionButton>
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <ActionButton fullWidth={false} disabled={!lastActionResult} onClick={handleUseResultAsContext} type="button" variant="ghost">
              Usar resultado como contexto
            </ActionButton>
          </div>
        </section>
          </div>
        </details>

        <div className="scroll-mt-5 space-y-4" id="workflow-processing">
        <details className="rounded-lg border border-blue-100 bg-white shadow-editorial">
          <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold text-slate-800">
            Escuta ao vivo e interpretação <span className="font-normal text-slate-500">(opcional)</span>
          </summary>
          <div className="border-t border-slate-100 p-4">
            <LiveVoicePanel
              key={`live-voice-${workflowResetKey}`}
              maxFileSizeMb={config.maxFileSizeMb}
              onLiveTranscriptReady={handleLiveTranscriptReady}
              onRecordingReady={handleRecordedAudio}
              transcripts={items.filter((item) => Boolean(item.transcription)).map((item) => ({
                id: item.id,
                name: item.name,
                transcription: item.transcription!,
              }))}
            />
          </div>
        </details>

        <input
          ref={addMoreInputRef}
          accept={addMoreAccept}
          className="hidden"
          multiple
          onChange={(event) => {
            handleFilesSelected(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
          type="file"
        />

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-950">Fila de processamento</h2>
              <p className="mt-2 text-sm text-slate-600">
                Até {config.maxParallelTranscriptions} arquivo(s) em paralelo. Links públicos, áudios e vídeos entram na mesma fila.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Lista atual: {items.length} item(ns). Você pode adicionar mais durante o processamento.
              </p>
            </div>

            <details className="rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-bold text-slate-800">Escolher conteúdo do DOCX completo</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SESSION_DOCX_OPTIONS.map((option) => (
                  <label className="flex items-center gap-2 text-sm text-slate-700" key={option.key}>
                    <input
                      checked={docxSelection[option.key]}
                      onChange={(event) => setDocxSelection((current) => ({
                        ...current,
                        [option.key]: event.currentTarget.checked,
                      }))}
                      type="checkbox"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </details>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ActionButton
                disabled={!items.some(canTranscribeItem) && batchRunStatus === "idle"}
                fullWidth
                loading={batchRunStatus === "running" || batchRunStatus === "cancelling"}
                onClick={handleTranscribeBatch}
                type="button"
                variant="primary"
              >
                <Sparkles className="h-4 w-4" />
                {batchRunStatus === "paused" ? "Continuar fila" : "Transcrever mídias"}
              </ActionButton>
              {batchRunStatus === "running" ? (
                <ActionButton fullWidth onClick={pauseTranscriptionQueue} type="button" variant="secondary">
                  <Pause className="h-4 w-4" /> Pausar fila
                </ActionButton>
              ) : null}
              {batchRunStatus !== "idle" ? (
                <ActionButton disabled={batchRunStatus === "cancelling"} fullWidth onClick={cancelTranscriptionQueue} type="button" variant="danger">
                  <Square className="h-4 w-4" /> Cancelar fila
                </ActionButton>
              ) : null}
              <ActionButton
                fullWidth
                onClick={() => addMoreInputRef.current?.click()}
                type="button"
                variant="secondary"
              >
                <Plus className="h-4 w-4" />
                Adicionar mais arquivos
              </ActionButton>
              <ActionButton fullWidth onClick={handleClearAll} type="button" variant="danger">
                Limpar tudo
              </ActionButton>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Progresso</h2>
              <p className="mt-2 text-sm text-slate-600">
                {completedCount} de {items.length} concluídos
                {queuedCount ? ` • ${queuedCount} na fila` : ""}
                {activeCount ? ` • ${activeCount} em processamento` : ""}
                {errorCount ? ` • ${errorCount} com erro` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {analysisItemCount} incluída(s) no entendimento geral{excludedAnalysisCount ? ` • ${excludedAnalysisCount} excluída(s) manualmente` : ""}.
                {lastAnalysisBlocks > 1 ? ` Último resultado consolidado em ${lastAnalysisBlocks} chamadas/blocos.` : ""}
              </p>
            </div>
          </div>

          <ProgressBar label="Processamento geral" value={progressPercent} />

          {queueNotice ? <p aria-live="polite" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{queueNotice}</p> : null}
          {analysisProgress ? <p aria-live="polite" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{analysisProgress}</p> : null}
          {appError ? <ErrorBox message={appError} /> : null}
        </section>

        <details className="rounded-lg border border-blue-100 bg-white shadow-editorial">
          <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold text-slate-800">
            Documentos e voz <span className="font-normal text-slate-500">(PDF, DOCX, audiobook e Milena)</span>
          </summary>
          <div className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
        <PdfPanel
          activeSpeechKey={activeSpeechKey}
          copiedKey={copiedKey}
          error={pdfError}
          loadingMap={loadingMap}
          onClearPdf={handleClearPdf}
          onCopy={(key, text) => {
            void handleCopy(key, text);
          }}
          onDownloadSpeech={handleDownloadSpeech}
          onPdfSelected={(file) => {
            void handlePdfSelected(file);
          }}
          onProcessPdf={(mode) => {
            void handleProcessPdf(mode);
          }}
          onSpeak={handleSpeakText}
          onStopSpeech={handleStopSpeech}
          pdf={pdfState}
          speechAudioTypes={speechAudioTypes}
          speechAudioUrls={speechAudioUrls}
          speechErrors={speechErrors}
          speechLoadingMap={Object.fromEntries(
            Object.entries(loadingMap)
              .filter(([key]) => key.startsWith("speech:"))
              .map(([key, value]) => [key.slice("speech:".length), value]),
          )}
        />

        {pdfAudiobook ? (
          <PdfAudiobookPanel
            activeSpeechKey={activeSpeechKey}
            audiobook={pdfAudiobook}
            onCancelGeneration={handleCancelPdfAudiobookGeneration}
            onDownloadChapter={(chapterId, title) =>
              handleDownloadSpeech(`pdf-audiobook:${chapterId}`, title)
            }
            onDownloadFull={() => {
              void handleDownloadPdfAudiobook();
            }}
            onGenerateAll={() => {
              void handleGeneratePdfAudiobookAll();
            }}
            onGenerateChapter={(chapterId) => {
              void generatePdfAudiobookChapter(chapterId);
            }}
            onPrepare={(mode) => {
              void handlePreparePdfAudiobook(mode);
            }}
            onStopSpeech={handleStopSpeech}
            speechAudioUrls={speechAudioUrls}
          />
        ) : null}

        <MilenaVozPanel
          activeSpeechKey={activeSpeechKey}
          copiedKey={copiedKey}
          imageError={imageTextError}
          imageState={imageTextState}
          isImageExtractLoading={Boolean(loadingMap["image:extract"])}
          isImageVoiceLoading={Boolean(loadingMap["speech:image-text"])}
          isTextVoiceLoading={Boolean(loadingMap["speech:text-voice"])}
          maxFileSizeMb={config.maxFileSizeMb}
          onClearImage={handleClearImageText}
          onClearText={handleClearFreeText}
          onCopy={(key, text) => {
            void handleCopy(key, text);
          }}
          onDownloadSpeech={handleDownloadSpeech}
          onImageSelected={(file) => {
            void handleImageSelected(file);
          }}
          onSpeak={handleSpeakText}
          onStopSpeech={handleStopSpeech}
          onTextChange={handleFreeTextChange}
          speechAudioTypes={speechAudioTypes}
          speechAudioUrls={speechAudioUrls}
          speechErrors={speechErrors}
          textValue={freeTextValue}
        />

          </div>
        </details>
        </div>

        <div className="scroll-mt-5 space-y-5" id="workflow-understanding">
        <details className="rounded-lg border border-blue-100 bg-white shadow-editorial">
          <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold text-slate-800">
            Contexto, sequência e busca <span className="font-normal text-slate-500">(opcional)</span>
          </summary>
          <div className="space-y-5 border-t border-slate-100 p-4 sm:p-5">
        <ContinuityPanel
          error={taskErrors["sequence:all"]}
          isLoading={Boolean(loadingMap["sequence:all"])}
          isSpeechLoading={Boolean(loadingMap["speech:review:continuidade"])}
          items={items.filter((item) => Boolean(item.transcription))}
          onAnalyze={() => {
            void handleOrganizeSequence();
          }}
          onChange={handleContinuityPlanChange}
          onGenerateNarrative={() => { void handleGenerateSessionNarrative(); }}
          onNarrativeChange={handleSessionNarrativeChange}
          onNarrativeFormatChange={(format) => {
            setSessionNarrativeFormat(format);
            setSessionNarrative("");
            setSessionNarrativeStale(false);
            clearSpeechResult("review:narrativa-final");
          }}
          onSpeak={(key, title, text) => {
            void handleSpeakText(key as SpeechTargetKey, title, text, { style: "audiolivro" });
          }}
          onToggleAnalysis={handleToggleAnalysis}
          onToggleDuplicate={handleToggleDuplicate}
          narrative={sessionNarrative}
          narrativeError={taskErrors["narrative:all"]}
          narrativeFormat={sessionNarrativeFormat}
          narrativeLoading={Boolean(loadingMap["narrative:all"])}
          narrativeStale={sessionNarrativeStale}
          narrativeSpeechUrl={speechAudioUrls["review:narrativa-final"]}
          narrativeSpeechLoading={Boolean(loadingMap["speech:review:narrativa-final"])}
          narrativeSpeechError={speechErrors["review:narrativa-final"]}
          isNarrativeSpeechActive={activeSpeechKey === "review:narrativa-final"}
          onDownloadNarrative={() => handleDownloadSpeech("review:narrativa-final", "narrativa-final")}
          onStopSpeech={handleStopSpeech}
          plan={continuityPlan}
          transcriptOrder={sessionTranscriptOrder}
          onTranscriptOrderChange={setSessionTranscriptOrder}
        />

        <AskFilesPanel
          isSpeechLoading={Boolean(loadingMap["speech:review:pergunta-arquivos"])}
          onSpeak={(key, title, text) => {
            void handleSpeakText(key as SpeechTargetKey, title, text, { style: "didatica" });
          }}
          sources={askFileSources}
        />

        <SessionSearchPanel
          entries={searchEntries}
          onOpenAudio={(itemId) => {
            document.getElementById(`audio-card-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
          </div>
        </details>

        <AudioList
          audioPreviewUrls={audioPreviewUrls}
          activeSpeechKey={activeSpeechKey}
          copiedKey={copiedKey}
          items={items}
          loadingMap={loadingMap}
          onAnalyzeAudio={(itemId) => {
            void handleAnalyzeAudioItem(itemId);
          }}
          onCopyAll={handleCopySingleAudio}
          onCopy={(key, text) => {
            void handleCopy(key, text);
          }}
          onCopyOrganized={(itemId) => {
            const item = getCurrentItem(itemId);
            if (!item?.organizedText) {
              return;
            }

            void handleCopy(`organized:${itemId}`, item.organizedText);
          }}
          onCopySummary={(itemId) => {
            const item = getCurrentItem(itemId);
            if (!item?.summary) {
              return;
            }

            void handleCopy(`summary:${itemId}`, item.summary);
          }}
          onCopyTranscription={(itemId) => {
            const item = getCurrentItem(itemId);
            if (!item?.transcription) {
              return;
            }

            void handleCopy(`transcription:${itemId}`, item.transcription);
          }}
          onDownloadDocx={(itemId) => {
            void handleDownloadSingleAudioDocx(itemId);
          }}
          onDownloadSpeech={handleDownloadSpeech}
          onExecutePrompt={handleExecutePrompt}
          onGenerateAudioContent={(itemId, kind) => {
            void handleGenerateAudioContent(itemId, kind);
          }}
          onOrganize={handleOrganizeItem}
          onRemove={handleRemoveItem}
          onRetry={(itemId) => {
            void handleRetryItem(itemId);
          }}
          onRenameSpeaker={handleRenameSpeaker}
          onSummarize={handleSummarizeItem}
          onSpeakAdvanced={handleSpeakAdvanced}
          onStopSpeech={handleStopSpeech}
          speechAudioUrls={speechAudioUrls}
          speechErrors={speechErrors}
          taskErrors={taskErrors}
        />

        {aggregateStale && hasGeneralResults ? (
          <section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4" role="status">
            <h2 className="text-lg font-black text-slate-950">Entendimento geral da sessão desatualizado</h2>
            <p className="text-sm leading-6 text-slate-700">
              O conjunto mudou após a última análise. Seus resultados e a organização manual foram preservados;
              atualize a consolidação para incluir os {analysisItemCount} áudios atualmente selecionados.
            </p>
            <div className="flex flex-wrap gap-2">
              {aggregateStaleReason === "new-items" && unanalyzedItemCount > 0 && Object.values(generalResults).every((value) => value.trim()) ? (
                <ActionButton className="sm:w-auto" fullWidth onClick={() => { void handleUpdateOnlyNewAudioAnalysis(); }} type="button" variant="secondary">
                  Atualizar somente {unanalyzedItemCount} áudio(s) novo(s)
                </ActionButton>
              ) : null}
              <ActionButton className="sm:w-auto" fullWidth loading={[
                "summary:all", "organize:all", "analysis:all", "tasks:all", "keyData:all", "reply:all", "intent:all",
              ].some((key) => Boolean(loadingMap[key]))} onClick={() => { void generateCompleteAnalysis(); }} type="button" variant="primary">
                Regenerar análise completa
              </ActionButton>
            </div>
          </section>
        ) : null}

        <ResultPanel
          activeSpeechKey={activeSpeechKey}
          copiedKey={copiedKey}
          generalAnalysis={generalResults.analysis}
          generalKeyData={generalResults.keyData}
          generalIntent={generalResults.intent}
          generalOrganizedText={generalResults.organized}
          generalReply={generalResults.reply}
          generalSummary={generalResults.summary}
          generalTasks={generalResults.tasks}
          hasPromptSource={hasPromptSource}
          hasTranscriptions={hasCompletedTranscriptions}
          isAnalyzeLoading={Boolean(loadingMap["analysis:all"])}
          isCompleteAnalysisLoading={[
            "summary:all",
            "organize:all",
            "analysis:all",
            "tasks:all",
            "keyData:all",
            "reply:all",
            "intent:all",
          ].some((key) => Boolean(loadingMap[key]))}
          isIntentLoading={Boolean(loadingMap["intent:all"])}
          isKeyDataLoading={Boolean(loadingMap["keyData:all"])}
          isOrganizeLoading={Boolean(loadingMap["organize:all"])}
          isPromptLoading={Boolean(loadingMap["prompt:all"])}
          isReplyLoading={Boolean(loadingMap["reply:all"])}
          isSummaryLoading={Boolean(loadingMap["summary:all"])}
          isTasksLoading={Boolean(loadingMap["tasks:all"])}
          promptResult={promptResult}
          speechAudioUrls={speechAudioUrls}
          speechAudioTypes={speechAudioTypes}
          speechErrors={speechErrors}
          speechLoadingMap={{
            analysis: Boolean(loadingMap["speech:analysis"]),
            keyData: Boolean(loadingMap["speech:keyData"]),
            intent: Boolean(loadingMap["speech:intent"]),
            organized: Boolean(loadingMap["speech:organized"]),
            reply: Boolean(loadingMap["speech:reply"]),
            summary: Boolean(loadingMap["speech:summary"]),
            tasks: Boolean(loadingMap["speech:tasks"]),
          }}
          onAnalyzeAll={() => {
            void runAnalyzeMode(
              "analysis",
              "analysis",
              "analysis:all",
              "Transcreva ao menos um áudio antes de interpretar todos.",
            );
          }}
          onChangeResult={updateGeneralResult}
          onCopyAll={handleCopyAllSession}
          onCopyAllTranscriptions={handleCopyAllTranscriptions}
          onCopyAnalysis={() => {
            void handleCopy("general-analysis", generalResults.analysis);
          }}
          onCopyIntent={() => {
            void handleCopy("general-intent", generalResults.intent);
          }}
          onCopyKeyData={() => {
            void handleCopy("general-keyData", generalResults.keyData);
          }}
          onCopyOrganized={() => {
            void handleCopy("general-organized", generalResults.organized);
          }}
          onCopyReply={() => {
            void handleCopy("general-reply", generalResults.reply);
          }}
          onCopyPrompt={() => {
            void handleCopy("general-prompt", promptResult);
          }}
          onCopySummary={() => {
            void handleCopy("general-summary", generalResults.summary);
          }}
          onCopyTasks={() => {
            void handleCopy("general-tasks", generalResults.tasks);
          }}
          onDownloadOrganizedDocx={() => {
            void handleDownloadOrganizedDocx();
          }}
          onDownloadOrganizedTxt={handleDownloadOrganizedTxt}
          onDownloadSpeech={handleDownloadSpeech}
          onDetectIntentAll={() => {
            void runAnalyzeMode(
              "intent",
              "intent",
              "intent:all",
              "Transcreva ao menos um áudio antes de identificar a intenção geral.",
            );
          }}
          onGenerateCompleteAnalysis={() => {
            void generateCompleteAnalysis();
          }}
          onExtractKeyData={() => {
            void runAnalyzeMode(
              "keyData",
              "keyData",
              "keyData:all",
              "Transcreva ao menos um áudio antes de mapear os dados-chave.",
            );
          }}
          onExtractTasks={() => {
            void runAnalyzeMode(
              "tasks",
              "tasks",
              "tasks:all",
              "Transcreva ao menos um áudio antes de extrair tarefas e pendências.",
            );
          }}
          onGenerateReply={() => {
            void runAnalyzeMode(
              "reply",
              "reply",
              "reply:all",
              "Transcreva ao menos um áudio antes de gerar uma resposta para WhatsApp.",
            );
          }}
          onOrganizeAll={() => {
            void handleOrganizeAll();
          }}
          onSpeakResult={(key, title, text) => {
            void handleSpeakText(key, title, text);
          }}
          onStopSpeech={handleStopSpeech}
          onSummarizeAll={() => {
            void handleSummarizeAll();
          }}
          onTransformToPrompt={(format) => {
            void handleTransformToPrompt(format);
          }}
          previewItems={previewItems}
          taskErrors={{
            analysis: taskErrors["analysis:all"],
            intent: taskErrors["intent:all"],
            keyData: taskErrors["keyData:all"],
            organize: taskErrors["organize:all"],
            reply: taskErrors["reply:all"],
            summary: taskErrors["summary:all"],
            tasks: taskErrors["tasks:all"],
            prompt: taskErrors["prompt:all"],
          }}
        />
        </div>

        <details className="scroll-mt-5 rounded-lg border border-blue-100 bg-white shadow-editorial" id="workflow-writing">
          <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold text-slate-800">
            Projetos e criação editorial <span className="font-normal text-slate-500">(biografias, reuniões e capítulos)</span>
          </summary>
          <div className="space-y-5 border-t border-slate-100 p-4 sm:p-5">
        <LocalProjectsPanel
          captureSnapshot={captureProjectSnapshot}
          onActiveProjectChange={() => undefined}
          restoreSnapshot={restoreProjectSnapshot}
        />

        <EditorialWorkflowPanel
          key={workflowResetKey}
          initialSnapshot={editorialRestoreSnapshot}
          activeSpeechKey={activeSpeechKey}
          loadingMap={loadingMap}
          onCopy={(key, text) => { void handleCopy(key, text); }}
          onUseInContext={handleUseEditorialResultAsContext}
          onDownloadDocx={(title, sections) => {
            void buildDocxBlob({ fileTitle: title, sections })
              .then((blob) => downloadBlob(blob, `${title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "producao-editorial"}.docx`))
              .catch((error) => setAppError(buildApiErrorMessage(error)));
          }}
          onDownloadSpeech={handleDownloadSpeech}
          onOutputStateChange={setWorkflowHasOutput}
          onSnapshotChange={handleEditorialSnapshotChange}
          onSpeak={(key, title, text, options) => handleSpeakText(key as SpeechTargetKey, title, text, { style: "audiolivro", autoplay: options?.autoplay })}
          onStopSpeech={handleStopSpeech}
          sources={editorialWorkflowSources}
          speechAudioUrls={speechAudioUrls}
          speechErrors={speechErrors}
        />
          </div>
        </details>

        <section className="scroll-mt-5 space-y-4" id="workflow-video">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:px-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Etapa opcional de produção audiovisual</p>
            <p className="mt-1 text-sm leading-5 text-slate-700">Analise vídeos do YouTube e depois selecione, revise e gere cortes. Para transcrever Reels, cole o link na entrada ou envie o MP4.</p>
          </div>
          <YoutubePanel />
          <SmartClipsPanel />
        </section>

        <section className="scroll-mt-5 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-editorial sm:p-6" id="workflow-delivery">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-leste-gold">Última etapa</p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">Revise e leve o material com você</h2>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-300">Confira os textos e resultados acima. Depois copie as transcrições ou baixe o conteúdo reunido em DOCX.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
              <ActionButton disabled={!hasCompletedTranscriptions} fullWidth onClick={handleCopyAllTranscriptions} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar transcrições</ActionButton>
              <ActionButton disabled={!hasCompletedTranscriptions} fullWidth onClick={handleDownloadTranscriptionsTxt} type="button" variant="ghost"><Download className="h-4 w-4" /> Baixar transcrições TXT</ActionButton>
              <ActionButton disabled={!hasCompletedTranscriptions} fullWidth onClick={() => { void handleDownloadTranscriptionsDocx(); }} type="button" variant="ghost"><Download className="h-4 w-4" /> Baixar transcrições DOCX</ActionButton>
              <ActionButton disabled={!hasCompletedTranscriptions && !hasGeneralResults} fullWidth onClick={() => { void handleDownloadCompleteSessionDocx(); }} type="button" variant="secondary"><Download className="h-4 w-4" /> Baixar pacote da sessão DOCX</ActionButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function buildTranscriptSegments(transcription: string) {
  const segments = transcription.split(/\n{2,}/).map((paragraph, index) => {
    const match = /^\s*((?:pessoa|falante)\s*\d+|[\p{L}][\p{L} .'-]{1,40}):\s*/iu.exec(paragraph);
    const speakerLabel = match?.[1]?.trim();
    return {
      id: `segment-${index + 1}`,
      text: paragraph.trim(),
      speakerId: speakerLabel ? `speaker-${speakerLabel.toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, "-")}` : undefined,
      speakerLabel,
      timingApproximate: false,
    };
  }).filter((segment) => segment.text);
  const speakers = Array.from(new Map(segments.filter((segment) => segment.speakerId && segment.speakerLabel).map((segment) => [segment.speakerId!, { id: segment.speakerId!, label: segment.speakerLabel!, unverified: true }])).values());
  return { segments, speakers };
}
