"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { Copy, Download, Plus, Sparkles } from "lucide-react";
import { nanoid } from "nanoid";

import ActionButton from "@/components/ActionButton";
import AppHeader from "@/components/AppHeader";
import AudioList from "@/components/AudioList";
import ErrorBox from "@/components/ErrorBox";
import PdfPanel from "@/components/PdfPanel";
import ProgressBar from "@/components/ProgressBar";
import ResultPanel from "@/components/ResultPanel";
import UploadArea from "@/components/UploadArea";
import type { PdfResultKey, PdfSpeechKey } from "@/components/PdfPanel";
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
  AudioItem,
  TextProcessResponse,
  TranscriptionResponse,
} from "@/types/audio";

type LesteAudioAppProps = {
  config: {
    appName: string;
    maxParallelTranscriptions: number;
    maxFileSizeMb: number;
  };
  hasLogo: boolean;
};

type GeneralResultKey = "summary" | "organized" | "analysis" | "tasks" | "keyData" | "reply";
type SpeechTargetKey = GeneralResultKey | PdfSpeechKey;

const EMPTY_GENERAL_RESULTS: Record<GeneralResultKey, string> = {
  summary: "",
  organized: "",
  analysis: "",
  tasks: "",
  keyData: "",
  reply: "",
};

const EMPTY_PDF_RESULTS: Record<PdfResultKey, string> = {
  summary: "",
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
  const [isTranscribingBatch, setIsTranscribingBatch] = useState(false);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [taskErrors, setTaskErrors] = useState<Record<string, string | undefined>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<PdfState | null>(null);
  const [pdfError, setPdfError] = useState<string | undefined>();
  const [audioPreviewUrls, setAudioPreviewUrls] = useState<Record<string, string>>({});
  const [speechAudioUrls, setSpeechAudioUrls] = useState<Record<string, string | undefined>>({});
  const [speechAudioTypes, setSpeechAudioTypes] = useState<Record<string, string | undefined>>({});
  const [speechErrors, setSpeechErrors] = useState<Record<string, string | undefined>>({});
  const [activeSpeechKey, setActiveSpeechKey] = useState<string | null>(null);

  const itemsRef = useRef<AudioItem[]>([]);
  const cancelledIdsRef = useRef<Set<string>>(new Set());
  const addMoreInputRef = useRef<HTMLInputElement | null>(null);
  const audioPreviewUrlsRef = useRef<Record<string, string>>({});
  const speechAudioUrlsRef = useRef<Record<string, string | undefined>>({});

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
    setTaskErrorState("summary:all");
    setTaskErrorState("organize:all");
    setTaskErrorState("analysis:all");
    setTaskErrorState("tasks:all");
    setTaskErrorState("keyData:all");
    setTaskErrorState("reply:all");
    clearAllSpeechResults();
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
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const patch = typeof nextValue === "function" ? nextValue(item) : nextValue;
        return { ...item, ...patch };
      }),
    );
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

  function handleFilesSelected(selectedFiles: File[]) {
    if (!selectedFiles.length) {
      return;
    }

    setAppError(null);
    clearAggregateResults();
    setItems((current) => [...current, ...selectedFiles.map(createAudioItem)]);
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
      summary: item.summary,
      organizedText: item.organizedText,
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

      updateItem(itemId, {
        status: "done",
        progress: 100,
        error: undefined,
        transcription: normalizePlainText(payload.transcription),
        summary: undefined,
        organizedText: undefined,
      });
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

  async function runTextTask(endpoint: string, body: unknown) {
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
  }

  async function handleSpeakText(key: SpeechTargetKey, title: string, text: string) {
    const normalizedText = normalizePlainText(text);

    if (!normalizedText) {
      setAppError("Nao ha texto para ouvir.");
      return;
    }

    const existingUrl = speechAudioUrlsRef.current[key];

    if (existingUrl) {
      setActiveSpeechKey(null);
      window.setTimeout(() => {
        setActiveSpeechKey(key);
      }, 0);
      return;
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
          title,
          text: normalizedText,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as TextProcessResponse | null;
        throw new Error(payload?.error || "Falha ao gerar a voz com IA.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const contentType = blob.type || response.headers.get("Content-Type") || "audio/wav";

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
        [key]: contentType,
      }));
      setActiveSpeechKey(key);
    } catch (error) {
      setSpeechErrors((current) => ({
        ...current,
        [key]: buildApiErrorMessage(error),
      }));
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
      setAppError("Gere a leitura com voz IA antes de baixar o audio.");
      return;
    }

    const contentType = speechAudioTypes[key] ?? "";
    const extension = contentType.includes("mpeg") || contentType.includes("mp3") ? "mp3" : "wav";
    const safeLabel = label
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `milena-${safeLabel || "voz-ia"}.${extension}`;
    anchor.click();
  }

  async function handleSummarizeItem(itemId: string) {
    const item = getCurrentItem(itemId);

    if (!item?.transcription) {
      return;
    }

    const taskKey = `summary:${itemId}`;
    setLoadingState(taskKey, true);
    setTaskErrorState(taskKey);

    try {
      const result = await runTextTask("/api/summarize", {
        text: item.transcription,
        mode: "single",
      });

      updateItem(itemId, { summary: result });
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
    } finally {
      setLoadingState(taskKey, false);
    }
  }

  async function handleOrganizeItem(itemId: string) {
    const item = getCurrentItem(itemId);

    if (!item?.transcription) {
      return;
    }

    const taskKey = `organize:${itemId}`;
    setLoadingState(taskKey, true);
    setTaskErrorState(taskKey);

    try {
      const result = await runTextTask("/api/organize", {
        text: item.transcription,
        mode: "single",
      });

      updateItem(itemId, { organizedText: result });
    } catch (error) {
      setTaskErrorState(taskKey, buildApiErrorMessage(error));
    } finally {
      setLoadingState(taskKey, false);
    }
  }

  function getCompletedItems(): AnalyzeAllItem[] {
    return itemsRef.current
      .filter((item) => item.transcription)
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

  async function handleCopy(key: string, text: string) {
    if (!text.trim()) {
      setAppError("Nao ha conteudo disponivel para copiar.");
      return;
    }

    try {
      await copyToClipboard(normalizePlainText(text));
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1800);
    } catch {
      setAppError("Nao foi possivel copiar automaticamente. Selecione o texto manualmente.");
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
      setAppError("Nao ha transcricoes prontas para exportar.");
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
      setAppError("Nao ha transcricoes prontas para exportar.");
      return;
    }

    const blob = await buildDocxBlob({
      fileTitle: "Leste Audio IA - Transcricoes",
      sections: completedItems.map((item) => ({
        title: `Audio: ${item.name}`,
        content: item.transcription ?? "",
      })),
    });

    downloadBlob(blob, `${buildExportFileBaseName(new Date())}-transcricoes.docx`);
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
      { title: "Organizacao geral", content: generalResults.organized },
      { title: "Interpretacao geral", content: generalResults.analysis },
      { title: "Tarefas e pendencias", content: generalResults.tasks },
      { title: "Dados-chave", content: generalResults.keyData },
      { title: "Resposta pronta para WhatsApp", content: generalResults.reply },
    ].filter((section) => section.content.trim());

    if (!sections.length) {
      setAppError("Gere ao menos um resultado geral antes de exportar o conteúdo organizado.");
      return;
    }

    const blob = await buildDocxBlob({
      fileTitle: "Leste Audio IA - Organizacao geral",
      sections,
    });

    downloadBlob(blob, `${buildExportFileBaseName(new Date())}-organizacao-geral.docx`);
  }

  function clearPdfSpeechResults() {
    (["pdf-original", "pdf-summary", "pdf-organized", "pdf-grammar", "pdf-clean"] as const).forEach(
      clearSpeechResult,
    );
  }

  async function handlePdfSelected(file: File) {
    const extension = file.name.toLowerCase().split(".").pop();
    const maxFileSizeBytes = config.maxFileSizeMb * 1024 * 1024;

    setPdfError(undefined);

    if (extension !== "pdf" && file.type !== "application/pdf") {
      setPdfError("Envie um arquivo PDF valido.");
      return;
    }

    if (file.size > maxFileSizeBytes) {
      setPdfError(`PDF acima do limite de ${config.maxFileSizeMb} MB.`);
      return;
    }

    setLoadingState("pdf:extract", true);
    clearPdfSpeechResults();

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
        throw new Error(payload.error || "Falha ao extrair texto do PDF.");
      }

      setPdfState({
        fileName: payload.meta?.fileName ?? file.name,
        fileSize: payload.meta?.size ?? file.size,
        text: normalizePlainText(payload.text),
        results: EMPTY_PDF_RESULTS,
      });
    } catch (error) {
      setPdfError(buildApiErrorMessage(error));
    } finally {
      setLoadingState("pdf:extract", false);
    }
  }

  async function handleProcessPdf(mode: PdfResultKey) {
    if (!pdfState?.text) {
      setPdfError("Envie um PDF antes de usar a IA.");
      return;
    }

    const loadingKey = `pdf:${mode}`;
    setLoadingState(loadingKey, true);
    setPdfError(undefined);
    clearSpeechResult(`pdf-${mode}` as PdfSpeechKey);

    try {
      const result = await runTextTask("/api/pdf-process", {
        text: pdfState.text,
        mode,
      });

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
    } catch (error) {
      setPdfError(buildApiErrorMessage(error));
    } finally {
      setLoadingState(loadingKey, false);
    }
  }

  function handleClearPdf() {
    clearPdfSpeechResults();
    setPdfState(null);
    setPdfError(undefined);
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

    setItems((current) => current.filter((entry) => entry.id !== itemId));
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
      setLoadingMap({});
      setTaskErrors({});
      setPdfState(null);
      setPdfError(undefined);
      setSpeechErrors({});
      setCopiedKey(null);
      setAppError(null);
      setIsTranscribingBatch(false);
    });
  }

  const completedCount = items.filter((item) => item.status === "done").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const hasCompletedTranscriptions = items.some((item) => Boolean(item.transcription));
  const progressPercent = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const addMoreAccept = ALLOWED_AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(",");
  const previewItems = items
    .filter((item) => item.transcription && audioPreviewUrls[item.id])
    .map((item) => ({
      id: item.id,
      name: item.name,
      url: audioPreviewUrls[item.id],
    }));

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppHeader appName={config.appName} hasLogo={hasLogo} />

        <UploadArea
          acceptedExtensions={[...ALLOWED_AUDIO_EXTENSIONS]}
          maxFileSizeMb={config.maxFileSizeMb}
          onFilesSelected={handleFilesSelected}
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
                adicionar mais 10 áudios ou mais sem apagar a lista atual.
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
          onSpeak={(key, title, text) => {
            void handleSpeakText(key, title, text);
          }}
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

        <AudioList
          copiedKey={copiedKey}
          items={items}
          loadingMap={loadingMap}
          onCopyAll={handleCopySingleAudio}
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
          onOrganize={handleOrganizeItem}
          onRemove={handleRemoveItem}
          onRetry={(itemId) => {
            void handleRetryItem(itemId);
          }}
          onSummarize={handleSummarizeItem}
          taskErrors={taskErrors}
        />

        <ResultPanel
          activeSpeechKey={activeSpeechKey}
          copiedKey={copiedKey}
          generalAnalysis={generalResults.analysis}
          generalKeyData={generalResults.keyData}
          generalOrganizedText={generalResults.organized}
          generalReply={generalResults.reply}
          generalSummary={generalResults.summary}
          generalTasks={generalResults.tasks}
          hasTranscriptions={hasCompletedTranscriptions}
          isAnalyzeLoading={Boolean(loadingMap["analysis:all"])}
          isKeyDataLoading={Boolean(loadingMap["keyData:all"])}
          isOrganizeLoading={Boolean(loadingMap["organize:all"])}
          isReplyLoading={Boolean(loadingMap["reply:all"])}
          isSummaryLoading={Boolean(loadingMap["summary:all"])}
          isTasksLoading={Boolean(loadingMap["tasks:all"])}
          speechAudioUrls={speechAudioUrls}
          speechAudioTypes={speechAudioTypes}
          speechErrors={speechErrors}
          speechLoadingMap={{
            analysis: Boolean(loadingMap["speech:analysis"]),
            keyData: Boolean(loadingMap["speech:keyData"]),
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
          onCopyAnalysis={() => {
            void handleCopy("general-analysis", generalResults.analysis);
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
          previewItems={previewItems}
          taskErrors={{
            analysis: taskErrors["analysis:all"],
            keyData: taskErrors["keyData:all"],
            organize: taskErrors["organize:all"],
            reply: taskErrors["reply:all"],
            summary: taskErrors["summary:all"],
            tasks: taskErrors["tasks:all"],
          }}
        />
      </div>
    </main>
  );
}
