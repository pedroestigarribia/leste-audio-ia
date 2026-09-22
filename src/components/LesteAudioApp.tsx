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
import { processInQueue } from "@/lib/queue";
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
  TextProcessResponse,
  TranscriptionResponse,
  UnifiedAction,
} from "@/types/audio";
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
  | `advanced:${string}`;
type SpeechOptions = {
  speed?: number;
  style?: NarrationStyle;
};

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
  return status === "uploading" || status === "converting" || status === "transcribing";
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
  const [isTranscribingBatch, setIsTranscribingBatch] = useState(false);
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

  const [sources, setSources] = useState<ContentSource[]>([]);
  const [contextText, setContextText] = useState("");
  const [lastActionResult, setLastActionResult] = useState<string | null>(null);
  const [lastActionMode, setLastActionMode] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const contextEditorRef = useRef<HTMLTextAreaElement>(null);

  const itemsRef = useRef<AudioItem[]>([]);
  const cancelledIdsRef = useRef<Set<string>>(new Set());
  const addMoreInputRef = useRef<HTMLInputElement | null>(null);
  const audioPreviewUrlsRef = useRef<Record<string, string>>({});
  const speechAudioUrlsRef = useRef<Record<string, string | undefined>>({});
  const pdfAudiobookRef = useRef<PdfAudiobook | null>(null);
  const cancelPdfAudiobookRef = useRef(false);
  const imagePreviewUrlRef = useRef<string | null>(null);
  const pdfOperationIdRef = useRef<string | null>(null);

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
        if (!next[item.id]) {
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

  function clearAggregateResults() {
    setGeneralResults(EMPTY_GENERAL_RESULTS);
    setPromptResult("");
    setTaskErrorState("summary:all");
    setTaskErrorState("organize:all");
    setTaskErrorState("analysis:all");
    setTaskErrorState("tasks:all");
    setTaskErrorState("keyData:all");
    setTaskErrorState("reply:all");
    setTaskErrorState("intent:all");
    setTaskErrorState("prompt:all");
    clearAllSpeechResults();
    setPdfAudiobook((current) =>
      current
        ? {
            ...current,
            isGenerating: false,
            chapters: current.chapters.map((chapter) => ({ ...chapter, status: "pending" })),
          }
        : current,
    );
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
      error,
    };
  }

  function appendAudioItems(selectedFiles: File[]) {
    const newItems = selectedFiles.map(createAudioItem);
    const nextItems = [...itemsRef.current, ...newItems];

    itemsRef.current = nextItems;
    setItems(nextItems);

    return newItems;
  }

  function handleFilesSelected(selectedFiles: File[]) {
    if (!selectedFiles.length) {
      return;
    }

    setAppError(null);
    clearAggregateResults();
    setContinuityPlan(null);
    appendAudioItems(selectedFiles);
  }

  async function handleRecordedAudio(file: File) {
    setAppError(null);
    const [recording] = appendAudioItems([file]);

    if (!recording) {
      throw new Error("Não foi possível preparar a gravação para transcrição.");
    }

    if (recording.error) {
      throw new Error(recording.error);
    }

    await transcribeItem(recording.id);
  }

  function getCurrentItem(itemId: string) {
    return itemsRef.current.find((item) => item.id === itemId);
  }

  function canTranscribeItem(item: AudioItem) {
    return !isActiveStatus(item.status) && !item.transcription && !buildValidationError(item.file);
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
      promptResult,
    };
  }

  async function parseJsonResponse<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
  }

  async function transcribeItem(itemId: string) {
    const item = getCurrentItem(itemId);

    if (!item || cancelledIdsRef.current.has(itemId) || !canTranscribeItem(item)) {
      return;
    }

    clearAggregateResults();
    setTaskErrorState(`summary:${itemId}`);
    setTaskErrorState(`organize:${itemId}`);
    setAppError(null);

    try {
      updateItem(itemId, {
        status: shouldConvert(item.extension) ? "converting" : "uploading",
        progress: shouldConvert(item.extension) ? 15 : 25,
        error: undefined,
        transcription: undefined,
        summary: undefined,
        organizedText: undefined,
        audioIntelligence: undefined,
        generatedContents: undefined,
      });

      if (shouldConvert(item.extension)) {
        await sleep(70);
      }

      updateItem(itemId, {
        status: "uploading",
        progress: 35,
      });

      const formData = new FormData();
      formData.append("file", item.file);

      const responsePromise = fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      await sleep(90);
      updateItem(itemId, {
        status: "transcribing",
        progress: 72,
      });

      const response = await responsePromise;
      const payload = await parseJsonResponse<TranscriptionResponse>(response);

      if (!response.ok || !payload.ok || !payload.transcription) {
        throw new Error(payload.error || "Falha ao transcrever o áudio.");
      }

      const transcription = normalizePlainText(payload.transcription);
      const segmentData = buildTranscriptSegments(transcription);

      updateItem(itemId, {
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

      const itemName = itemsRef.current.find((i) => i.id === itemId)?.name ?? "Áudio";
      addSource("audio", itemName, transcription);

      // Texto e entendimento são produzidos automaticamente após a transcrição.
      // A geração de voz continua opcional e só ocorre quando a pessoa clicar.
      await Promise.allSettled([
        handleSummarizeItem(itemId, transcription),
        handleOrganizeItem(itemId, transcription),
        handleAnalyzeAudioItem(itemId, transcription),
        detectIntentForItem(itemId, transcription),
      ]);
    } catch (error) {
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
    const targets = itemsRef.current.filter(canTranscribeItem);

    if (!targets.length) {
      setAppError("Selecione ao menos um áudio válido para transcrever.");
      return;
    }

    setAppError(null);
    setIsTranscribingBatch(true);

    const targetIds = new Set(targets.map((item) => item.id));
    setItems((current) =>
      current.map((item) =>
        targetIds.has(item.id) ? { ...item, status: "queued", progress: 5, error: undefined } : item,
      ),
    );

    const results = await processInQueue(
      targets,
      async (item) => {
        if (cancelledIdsRef.current.has(item.id)) {
          return;
        }

        await transcribeItem(item.id);
      },
      config.maxParallelTranscriptions,
    );

    setIsTranscribingBatch(false);

    const failedCount = results.filter((result) => result.status === "rejected").length;

    if (failedCount) {
      setAppError(`${failedCount} áudio(s) falharam. O restante continuou normalmente.`);
    }
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
      setActiveSpeechKey(null);
      window.setTimeout(() => {
        setActiveSpeechKey(key);
      }, 0);
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
      setActiveSpeechKey(key);
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
      const result = await runTextTask("/api/summarize", {
        text: transcription,
        mode: "single",
      });

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
      const result = await runTextTask("/api/organize", {
        text: transcription,
        mode: "single",
      });

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
    const completed = itemsRef.current.filter((item) => item.transcription);
    const orderedIds = continuityPlan?.groups.flatMap((group) => group.itemIds) ?? [];
    const byId = new Map(completed.map((item) => [item.id, item]));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((item): item is AudioItem => Boolean(item));
    const remaining = completed.filter((item) => !orderedIds.includes(item.id));

    return [...ordered, ...remaining]
      .map((item) => ({
        name: item.name,
        transcription: item.transcription as string,
      }));
  }

  function buildMergedTranscriptions() {
    return getCompletedItems()
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
      const result = await runTextTask("/api/summarize", {
        text: mergedText,
        mode: "all",
      });

      updateGeneralResult("summary", result);
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
    } finally {
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
      const result = await runTextTask("/api/organize", {
        text: mergedText,
        mode: "all",
      });

      updateGeneralResult("organized", result);
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
    } finally {
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
      const result = await runTextTask("/api/analyze-all", {
        items: completedItems,
        mode,
      });

      updateGeneralResult(resultKey, result);
    } catch (error) {
      setTaskErrorState(loadingKey, buildApiErrorMessage(error));
    } finally {
      setLoadingState(loadingKey, false);
    }
  }

  async function handleOrganizeSequence() {
    const sequenceItems = itemsRef.current
      .filter((item) => item.transcription)
      .map((item) => ({ id: item.id, name: item.name, transcription: item.transcription! }));

    if (sequenceItems.length < 2) {
      setAppError("Transcreva pelo menos dois áudios para organizar a sequência.");
      return;
    }

    setLoadingState("sequence:all", true);
    setTaskErrorState("sequence:all");
    try {
      const response = await fetch("/api/organize-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: sequenceItems }),
      });
      const payload = (await response.json()) as { ok?: boolean; result?: ContinuityPlan; error?: string };
      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(payload.error || "Não foi possível organizar a sequência.");
      }
      setContinuityPlan(payload.result);
    } catch (error) {
      setTaskErrorState("sequence:all", buildApiErrorMessage(error));
    } finally {
      setLoadingState("sequence:all", false);
    }
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
    setPromptResult("");

    const mergedText = buildMergedTranscriptions();
    const nextResults = { ...generalResults };

    const jobs: Array<{
      key: GeneralResultKey;
      loadingKey: string;
      run: () => Promise<string>;
    }> = [
      {
        key: "summary",
        loadingKey: "summary:all",
        run: () => runTextTask("/api/summarize", { text: mergedText, mode: "all" }),
      },
      {
        key: "organized",
        loadingKey: "organize:all",
        run: () => runTextTask("/api/organize", { text: mergedText, mode: "all" }),
      },
      {
        key: "analysis",
        loadingKey: "analysis:all",
        run: () => runTextTask("/api/analyze-all", { items: completedItems, mode: "analysis" }),
      },
      {
        key: "tasks",
        loadingKey: "tasks:all",
        run: () => runTextTask("/api/analyze-all", { items: completedItems, mode: "tasks" }),
      },
      {
        key: "keyData",
        loadingKey: "keyData:all",
        run: () => runTextTask("/api/analyze-all", { items: completedItems, mode: "keyData" }),
      },
      {
        key: "reply",
        loadingKey: "reply:all",
        run: () => runTextTask("/api/analyze-all", { items: completedItems, mode: "reply" }),
      },
      {
        key: "intent",
        loadingKey: "intent:all",
        run: () => runTextTask("/api/analyze-all", { items: completedItems, mode: "intent" }),
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
        setTaskErrorState(job.loadingKey, buildApiErrorMessage(error));
      } finally {
        setLoadingState(job.loadingKey, false);
      }
    }

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
      const hasAllResults = Object.values(generalResults).every((value) => value.trim());
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
        transcriptions: buildMergedTranscriptions(),
      });

      setPromptResult(result);
    } catch (error) {
      setTaskErrorState("prompt:all", buildApiErrorMessage(error));
    } finally {
      setLoadingState("prompt:all", false);
    }
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
    const completedItems = buildExportItems().filter((item) => item.transcription?.trim());

    if (!completedItems.length) {
      setAppError("Não há transcrições prontas para exportar.");
      return;
    }

    const sections = completedItems.map((item) => ({
      title: `Áudio: ${item.name}`,
      content: buildSingleAudioExportSection(item),
    }));

    const generalSections = [
      ["Resumo geral", generalResults.summary],
      ["Organização geral", generalResults.organized],
      ["Interpretação geral", generalResults.analysis],
      ["Tarefas e pendências", generalResults.tasks],
      ["Dados-chave", generalResults.keyData],
      ["Resposta pronta para WhatsApp", generalResults.reply],
      ["Intenção consolidada", generalResults.intent],
    ].filter((entry): entry is [string, string] => Boolean(entry[1].trim()));

    const blob = await buildDocxBlob({
      fileTitle: "Leste Audio IA - Conteúdo completo",
      sections: [...sections, ...generalSections.map(([title, content]) => ({ title, content }))],
    });

    downloadBlob(blob, `${buildExportFileBaseName(new Date())}-conteudo-completo.docx`);
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
    clearAggregateResults();
    setTaskErrorState(`summary:${itemId}`);
    setTaskErrorState(`organize:${itemId}`);
    setTaskErrorState(`intelligence:${itemId}`);

    setItems((current) => current.filter((entry) => entry.id !== itemId));
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
    clearAllSpeechResults();

    startTransition(() => {
      cancelledIdsRef.current.clear();
      setItems([]);
      setGeneralResults(EMPTY_GENERAL_RESULTS);
      setPromptResult("");
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
      setIsTranscribingBatch(false);
      setSources([]);
      setContextText("");
      setLastActionResult(null);
      setContinuityPlan(null);
    });
  }

  const completedCount = items.filter((item) => item.status === "done").length;
  const errorCount = items.filter((item) => item.status === "error").length;
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
    (type: ContentSource["type"], name: string, extractedContent: string, originalContent?: string) => {
      const source: ContentSource = {
        id: nanoid(),
        type,
        name,
        originalContent,
        extractedContent,
        createdAt: new Date().toISOString(),
        metadata: {},
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
          const response = await runTextTask("/api/analyze-all", {
            items: [{ name: "Contexto", transcription: text }],
            mode: action === "extrair_tarefas" ? "tasks" : action === "extrair_dados" ? "keyData" : "analysis",
          });
          setLastActionResult(response);
        }
      } catch (err) {
        setAppError(err instanceof Error ? err.message : "Erro ao executar ação.");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [consolidatedContext, runTextTask],
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
      const result = await runTextTask("/api/analyze-all", {
        items: [{ name: "Contexto completo", transcription: text }],
        mode: "analysis",
      });
      setLastActionResult(result);
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Erro na análise.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [consolidatedContext, runTextTask]);

  const handleUseResultAsContext = useCallback(() => {
    if (!lastActionResult) return;
    setContextText(lastActionResult);
    setLastActionResult(null);
  }, [lastActionResult]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppHeader appName={config.appName} hasLogo={hasLogo} />

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
        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Layers className="h-4 w-4 text-leste-blue" />
              Fontes ({sources.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-400">Áudio</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-400">PDF</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-400">Imagem</span>
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
            <p className="mt-3 text-sm text-slate-400">Nenhuma fonte adicionada. Transcrições de áudio, PDFs, imagens e vídeos do YouTube aparecerão aqui.</p>
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

        <UploadArea
          acceptedExtensions={[...ALLOWED_AUDIO_EXTENSIONS]}
          maxFileSizeMb={config.maxFileSizeMb}
          onFilesSelected={handleFilesSelected}
          onRecordingReady={handleRecordedAudio}
        />

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
              <h2 className="text-xl font-black text-slate-950">Ações da sessão</h2>
              <p className="mt-2 text-sm text-slate-600">
                Concorrência máxima: {config.maxParallelTranscriptions} áudio(s) por vez. Você pode
                adicionar mais arquivos, incluindo vídeos `mp4`, sem apagar a lista atual.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Lista atual: {items.length} áudio(s).
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ActionButton
                disabled={!items.some(canTranscribeItem)}
                fullWidth
                loading={isTranscribingBatch}
                onClick={handleTranscribeBatch}
                type="button"
                variant="primary"
              >
                <Sparkles className="h-4 w-4" />
                Transcrever áudios
              </ActionButton>
              <ActionButton
                fullWidth
                onClick={() => addMoreInputRef.current?.click()}
                type="button"
                variant="secondary"
              >
                <Plus className="h-4 w-4" />
                Adicionar mais áudios
              </ActionButton>
              <ActionButton
                disabled={!hasCompletedTranscriptions}
                fullWidth
                onClick={handleCopyAllTranscriptions}
                type="button"
                variant="ghost"
              >
                <Copy className="h-4 w-4" />
                {copiedKey === "all-transcriptions" ? "Copiado" : "Copiar todas as transcrições"}
              </ActionButton>
              <ActionButton
                disabled={!hasCompletedTranscriptions}
                fullWidth
                onClick={handleDownloadTranscriptionsTxt}
                type="button"
                variant="ghost"
              >
                <Download className="h-4 w-4" />
                Baixar transcrições TXT
              </ActionButton>
              <ActionButton
                disabled={!hasCompletedTranscriptions}
                fullWidth
                onClick={() => {
                  void handleDownloadTranscriptionsDocx();
                }}
                type="button"
                variant="ghost"
              >
                <Download className="h-4 w-4" />
                Baixar transcrições DOCX
              </ActionButton>
              <ActionButton
                disabled={!hasCompletedTranscriptions}
                fullWidth
                onClick={() => {
                  void handleDownloadCompleteSessionDocx();
                }}
                type="button"
                variant="secondary"
              >
                <Download className="h-4 w-4" />
                Baixar conteúdo completo DOCX
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
                {errorCount ? ` • ${errorCount} com erro` : ""}
              </p>
            </div>
          </div>

          <ProgressBar label="Processamento geral" value={progressPercent} />

          {appError ? <ErrorBox message={appError} /> : null}
        </section>

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

        <YoutubePanel />

        <SmartClipsPanel />

        <ContinuityPanel
          error={taskErrors["sequence:all"]}
          isLoading={Boolean(loadingMap["sequence:all"])}
          isSpeechLoading={Boolean(loadingMap["speech:review:continuidade"])}
          items={items.filter((item) => Boolean(item.transcription))}
          onAnalyze={() => {
            void handleOrganizeSequence();
          }}
          onChange={setContinuityPlan}
          onSpeak={(key, title, text) => {
            void handleSpeakText(key as SpeechTargetKey, title, text, { style: "audiolivro" });
          }}
          plan={continuityPlan}
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
