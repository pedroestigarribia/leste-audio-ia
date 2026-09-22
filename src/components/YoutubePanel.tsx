"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Film,
  Link2,
  Loader2,
  Mic2,
  Pause,
  Play,
  Search,
  Sparkles,
  Tag,
  Users,
  Waves,
  Youtube as YoutubeIcon,
} from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import ProgressBar from "@/components/ProgressBar";
import { copyToClipboard } from "@/lib/clipboard";
import type {
  YoutubeAnalysisState,
  YoutubeProgressEvent,
  YoutubeSegment,
  YoutubeVideoInfo,
} from "@/types/youtube";

type Tab =
  | "overview"
  | "transcription"
  | "participants"
  | "tone"
  | "summary"
  | "interpretation"
  | "export";

const TABS: Array<{ key: Tab; label: string; icon: typeof Film }> = [
  { key: "overview", label: "Visão geral", icon: Eye },
  { key: "transcription", label: "Transcrição", icon: FileText },
  { key: "participants", label: "Participantes", icon: Users },
  { key: "tone", label: "Tonalidade da voz", icon: Waves },
  { key: "summary", label: "Resumo", icon: Sparkles },
  { key: "interpretation", label: "Interpretação", icon: Mic2 },
  { key: "export", label: "Exportação", icon: Download },
];

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
}

function parseTimeInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return null;

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];

  return null;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function useYoutubePlayer(videoId: string | null) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!videoId) return;

    function createPlayer() {
      if (!window.YT || !window.YT.Player || !containerRef.current) return;

      if (playerRef.current) {
        try {
          playerRef.current.loadVideoById(videoId);
        } catch {
          playerRef.current = null;
        }
        return;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: () => {
            setIsReady(true);
            if (pendingSeekRef.current !== null) {
              try {
                playerRef.current.seekTo(pendingSeekRef.current, true);
                playerRef.current.playVideo();
              } catch {
                // ignore
              }
              pendingSeekRef.current = null;
            }
          },
          onStateChange: (event: any) => {
            setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
          },
        },
      });
    }

    if (window.YT && window.YT.Player) {
      createPlayer();
      return;
    }

    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      createPlayer();
    };

    const interval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(interval);
        createPlayer();
      }
    }, 200);

    return () => {
      clearInterval(interval);
    };
  }, [videoId]);

  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current && isReady) {
      try {
        playerRef.current.seekTo(seconds, true);
        playerRef.current.playVideo();
      } catch {
        pendingSeekRef.current = seconds;
      }
    } else {
      pendingSeekRef.current = seconds;
    }
  }, [isReady]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current || !isReady) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch {
      // ignore
    }
  }, [isPlaying, isReady]);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
    };
  }, []);

  return { containerRef, seekTo, togglePlay, isReady, isPlaying };
}

function buildTranscriptText(state: YoutubeAnalysisState): string {
  const lines: string[] = [
    "LESTE AUDIO IA — ANÁLISE DE VÍDEO DO YOUTUBE",
    `Data: ${new Date(state.processedAt).toLocaleString("pt-BR")}`,
    "",
    `Vídeo: ${state.video.title}`,
    `Canal: ${state.video.channel}`,
    `URL: ${state.video.url}`,
    `Duração: ${formatClock(state.video.duration)}`,
    `Trecho: ${state.cutStart !== null ? formatClock(state.cutStart) : "início"} até ${state.cutEnd !== null ? formatClock(state.cutEnd) : "fim"}`,
    `Idioma: ${state.gemini.language}`,
    "",
    "========================",
    "TRANSCRIÇÃO",
    "========================",
    "",
  ];

  for (const seg of state.gemini.segments) {
    lines.push(
      `[${formatClock(seg.startTime)} - ${formatClock(seg.endTime)}]`,
      `${seg.participant}:`,
      seg.text,
      "",
      "Tonalidade:",
      seg.tone,
      `Confiança: ${(seg.confidence * 100).toFixed(0)}%`,
      "",
      "------------------------",
      "",
    );
  }

  lines.push("========================", "PARTICIPANTES", "========================", "");

  for (const p of state.gemini.participants) {
    lines.push(
      `${p.label}${p.name ? ` (${p.name})` : ""}`,
      `Segmentos: ${p.segmentsCount}`,
      `Tempo total: ${formatClock(p.totalTime)}`,
      p.evidence ? `Evidência: ${p.evidence}` : "",
      "",
    );
  }

  if (state.gemini.sceneNotes) {
    lines.push("========================", "NOTAS DE CENA", "========================", "", state.gemini.sceneNotes, "");
  }

  if (state.gemini.toneChanges) {
    lines.push("========================", "MUDANÇAS DE TONALIDADE", "========================", "", state.gemini.toneChanges, "");
  }

  const ds = state.deepseek;

  if (ds.revisedTranscription) {
    lines.push("========================", "TRANSCRIÇÃO REVISADA", "========================", "", ds.revisedTranscription, "");
  }
  if (ds.summary) {
    lines.push("========================", "RESUMO", "========================", "", ds.summary, "");
  }
  if (ds.interpretation) {
    lines.push("========================", "INTERPRETAÇÃO", "========================", "", ds.interpretation, "");
  }
  if (ds.topics) {
    lines.push("========================", "ASSUNTOS", "========================", "", ds.topics, "");
  }
  if (ds.keyPhrases) {
    lines.push("========================", "FRASES IMPORTANTES", "========================", "", ds.keyPhrases, "");
  }
  if (ds.styleAnalysis) {
    lines.push("========================", "ESTILO DE LINGUAGEM", "========================", "", ds.styleAnalysis, "");
  }
  if (ds.communicationProfile) {
    lines.push("========================", "PERFIL DE COMUNICAÇÃO", "========================", "", ds.communicationProfile, "");
  }
  if (ds.generatedContent) {
    lines.push("========================", "CONTEÚDO GERADO", "========================", "", ds.generatedContent, "");
  }

  return lines.filter((l) => l !== undefined).join("\n").trim();
}

export default function YoutubePanel() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"full" | "segment">("full");
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [videoInfo, setVideoInfo] = useState<YoutubeVideoInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [isInfoLoading, setIsInfoLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<YoutubeAnalysisState | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { containerRef, seekTo, togglePlay, isReady, isPlaying } = useYoutubePlayer(
    result?.video.videoId ?? videoInfo?.videoId ?? null,
  );

  const resultRef = useRef<YoutubeAnalysisState | null>(null);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  async function handleFetchInfo() {
    setInfoError(null);
    setError(null);
    setIsInfoLoading(true);
    setVideoInfo(null);
    setResult(null);

    try {
      const response = await fetch("/api/youtube-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.video) {
        throw new Error(payload.error || "Não foi possível obter as informações do vídeo.");
      }

      setVideoInfo(payload.video as YoutubeVideoInfo);
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : "Erro ao validar o link.");
    } finally {
      setIsInfoLoading(false);
    }
  }

  async function handleAnalyze() {
    setError(null);
    setResult(null);
    setIsAnalyzing(true);
    setProgress({ message: "Iniciando...", percent: 5 });

    const cutStart = mode === "segment" ? parseTimeInput(startInput) : null;
    const cutEnd = mode === "segment" ? parseTimeInput(endInput) : null;

    if (mode === "segment") {
      if (cutStart === null) {
        setError("Informe o minuto inicial no formato MM:SS ou HH:MM:SS.");
        setIsAnalyzing(false);
        setProgress(null);
        return;
      }
      if (cutEnd === null) {
        setError("Informe o minuto final no formato MM:SS ou HH:MM:SS.");
        setIsAnalyzing(false);
        setProgress(null);
        return;
      }
      if (cutEnd <= cutStart) {
        setError("O minuto final deve ser maior que o minuto inicial.");
        setIsAnalyzing(false);
        setProgress(null);
        return;
      }
    }

    try {
      const response = await fetch("/api/youtube-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          cutStart,
          cutEnd,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Erro HTTP ${response.status}.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event: YoutubeProgressEvent = JSON.parse(line);

            if (event.step === "download" && event.status === "in_progress") {
              setProgress({ message: event.message, percent: event.progress });
            } else if (event.step === "download" && event.status === "done") {
              setProgress({ message: "Trecho baixado e cortado.", percent: 50 });
            } else if (event.step === "gemini" && event.status === "in_progress") {
              setProgress({ message: event.message, percent: 60 });
            } else if (event.step === "gemini" && event.status === "done") {
              setProgress({ message: "Análise do Gemini concluída.", percent: 75 });
            } else if (event.step === "deepseek" && event.status === "in_progress") {
              setProgress({ message: event.message, percent: 85 });
            } else if (event.step === "deepseek" && event.status === "done") {
              setProgress({ message: "Análise do DeepSeek concluída.", percent: 95 });
            } else if (event.step === "complete") {
              setResult(event.result);
              setVideoInfo(event.result.video);
              setProgress({ message: "Concluído!", percent: 100 });
              setActiveTab("overview");
            } else if (event.step === "error") {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && !parseErr.message.includes("JSON")) {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar o vídeo.");
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setProgress(null), 2000);
    }
  }

  function handleRenameParticipant(participantId: string, newName: string) {
    if (!result) return;

    setResult((prev) => {
      if (!prev) return prev;

      const participants = prev.gemini.participants.map((p) =>
        p.id === participantId
          ? { ...p, name: newName.trim() || undefined }
          : p,
      );

      const targetLabel = prev.gemini.participants.find((p) => p.id === participantId)?.label;
      const targetName = prev.gemini.participants.find((p) => p.id === participantId)?.name;
      const displayLabel = targetName ?? targetLabel;

      const segments = prev.gemini.segments.map((s) =>
        s.participant === displayLabel || s.participant === targetLabel
          ? { ...s, participant: newName.trim() || (targetLabel ?? s.participant) }
          : s,
      );

      return {
        ...prev,
        gemini: {
          ...prev.gemini,
          participants,
          segments,
        },
      };
    });
  }

  async function handleCopy(key: string, text: string) {
    if (!text.trim()) return;
    try {
      await copyToClipboard(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1800);
    } catch {
      // ignore
    }
  }

  function handleDownloadTxt() {
    if (!result) return;
    const text = buildTranscriptText(result);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `youtube-${result.video.videoId}-analise.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleDownloadDocx() {
    if (!result) return;
    const { buildDocxBlob } = await import("@/lib/export-docx");

    const sections = [
      { title: "Transcrição", content: result.gemini.segments.map((s) => `[${formatClock(s.startTime)} - ${formatClock(s.endTime)}]\n${s.participant}:\n${s.text}\n\nTonalidade: ${s.tone}\nConfiança: ${(s.confidence * 100).toFixed(0)}%`).join("\n\n---\n\n") },
      { title: "Resumo", content: result.deepseek.summary },
      { title: "Interpretação", content: result.deepseek.interpretation },
      { title: "Assuntos", content: result.deepseek.topics },
      { title: "Frases importantes", content: result.deepseek.keyPhrases },
      { title: "Estilo de linguagem", content: result.deepseek.styleAnalysis },
      { title: "Perfil de comunicação", content: result.deepseek.communicationProfile },
      { title: "Conteúdo gerado", content: result.deepseek.generatedContent },
    ].filter((s) => s.content.trim());

    const blob = await buildDocxBlob({
      fileTitle: `Análise YouTube: ${result.video.title}`,
      sections,
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `youtube-${result.video.videoId}-analise.docx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const filteredSegments: YoutubeSegment[] = (() => {
    if (!result) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return result.gemini.segments;

    return result.gemini.segments.filter((seg) => {
      if (searchField === "participant") {
        return seg.participant.toLowerCase().includes(q);
      }
      if (searchField === "tone") {
        return seg.tone.toLowerCase().includes(q);
      }
      if (searchField === "timestamp") {
        const ts = parseTimeInput(q);
        if (ts === null) return false;
        return ts >= seg.startTime && ts <= seg.endTime;
      }
      // "all" and "word" and "phrase" search in text
      return seg.text.toLowerCase().includes(q) ||
        seg.participant.toLowerCase().includes(q) ||
        seg.tone.toLowerCase().includes(q);
    });
  })();

  const hasResult = Boolean(result);

  return (
    <section className="space-y-5 rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-6">
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-leste-blue">
          YouTube
        </p>
        <h2 className="text-2xl font-black text-slate-950">Analisar vídeo do YouTube</h2>
        <p className="text-sm text-slate-600">
          Cole o link do YouTube, escolha vídeo completo ou trecho específico, e processe com
          Gemini (transcrição, vozes, tonalidade, cenas) e DeepSeek (resumo, interpretação,
          conteúdo).
        </p>
      </div>

      {/* URL input */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold text-slate-700">Link do YouTube</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-leste-blue"
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim()) {
                    void handleFetchInfo();
                  }
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                type="url"
                value={url}
              />
            </div>
          </div>
          <ActionButton
            disabled={!url.trim() || isInfoLoading}
            fullWidth={false}
            loading={isInfoLoading}
            onClick={() => void handleFetchInfo()}
            type="button"
            variant="secondary"
          >
            <YoutubeIcon className="h-4 w-4" />
            Validar link
          </ActionButton>
        </div>

        {infoError ? <ErrorBox message={infoError} /> : null}

        {/* Mode selector */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              checked={mode === "full"}
              onChange={() => setMode("full")}
              type="radio"
            />
            Vídeo completo
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              checked={mode === "segment"}
              onChange={() => setMode("segment")}
              type="radio"
            />
            Trecho específico
          </label>
        </div>

        {mode === "segment" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Minuto inicial</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-leste-blue"
                  onChange={(e) => setStartInput(e.target.value)}
                  placeholder="MM:SS ou HH:MM:SS"
                  type="text"
                  value={startInput}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Minuto final</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-leste-blue"
                  onChange={(e) => setEndInput(e.target.value)}
                  placeholder="MM:SS ou HH:MM:SS"
                  type="text"
                  value={endInput}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Video info */}
      {videoInfo ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-col gap-4 lg:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={videoInfo.title}
              className="h-32 w-full rounded-lg border border-slate-200 object-cover sm:w-56"
              src={videoInfo.thumbnail}
            />
            <div className="flex-1 space-y-2">
              <h3 className="font-black text-slate-950">{videoInfo.title}</h3>
              <p className="text-sm text-slate-600">Canal: {videoInfo.channel}</p>
              <p className="text-sm text-slate-500">
                Duração: {formatClock(videoInfo.duration)}
              </p>
              <a
                className="inline-flex items-center gap-1 text-sm font-semibold text-leste-blue hover:underline"
                href={videoInfo.url}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no YouTube
              </a>
            </div>
          </div>

          <ActionButton
            disabled={isAnalyzing}
            fullWidth
            loading={isAnalyzing}
            onClick={() => void handleAnalyze()}
            type="button"
            variant="primary"
          >
            <Sparkles className="h-4 w-4" />
            {mode === "segment"
              ? "Processar trecho selecionado"
              : "Processar vídeo completo"}
          </ActionButton>
        </div>
      ) : null}

      {/* Progress */}
      {progress ? (
        <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-leste-blue">
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress.message}
          </div>
          <ProgressBar label="Progresso" value={progress.percent} />
        </div>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}

      {/* Player + Tabs */}
      {hasResult && result ? (
        <div className="space-y-5">
          {/* YouTube Player */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase text-slate-500">Player</h3>
              <ActionButton
                disabled={!isReady}
                fullWidth={false}
                onClick={togglePlay}
                type="button"
                variant="ghost"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? "Pausar" : "Reproduzir"}
              </ActionButton>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div ref={containerRef} className="aspect-video w-full" />
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  className={[
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                    activeTab === tab.key
                      ? "bg-leste-blue text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ].join(" ")}
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === "overview" ? (
            <OverviewTab result={result} />
          ) : null}

          {activeTab === "transcription" ? (
            <TranscriptionTab
              copiedKey={copiedKey}
              filteredSegments={filteredSegments}
              onCopy={handleCopy}
              onSeek={seekTo}
              searchField={searchField}
              searchQuery={searchQuery}
              totalSegments={result.gemini.segments.length}
              onSearchFieldChange={setSearchField}
              onSearchQueryChange={setSearchQuery}
            />
          ) : null}

          {activeTab === "participants" ? (
            <ParticipantsTab
              onRename={handleRenameParticipant}
              onSeek={seekTo}
              result={result}
            />
          ) : null}

          {activeTab === "tone" ? <ToneTab result={result} /> : null}

          {activeTab === "summary" ? (
            <SummaryTab copiedKey={copiedKey} onCopy={handleCopy} result={result} />
          ) : null}

          {activeTab === "interpretation" ? (
            <InterpretationTab copiedKey={copiedKey} onCopy={handleCopy} result={result} />
          ) : null}

          {activeTab === "export" ? (
            <ExportTab
              onDownloadDocx={() => void handleDownloadDocx()}
              onDownloadTxt={handleDownloadTxt}
              result={result}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function OverviewTab({ result }: { result: YoutubeAnalysisState }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Duração" value={formatClock(result.video.duration)} />
        <StatCard icon={FileText} label="Segmentos" value={String(result.gemini.segments.length)} />
        <StatCard icon={Users} label="Participantes" value={String(result.gemini.participants.length)} />
        <StatCard icon={Tag} label="Idioma" value={result.gemini.language} />
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Trecho processado</h3>
        <p className="text-sm text-slate-700">
          {result.cutStart !== null ? formatClock(result.cutStart) : "Início"} até{" "}
          {result.cutEnd !== null ? formatClock(result.cutEnd) : "Fim"}
        </p>
      </div>

      {result.gemini.sceneNotes ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Notas de cena</h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{result.gemini.sceneNotes}</p>
        </div>
      ) : null}

      {result.gemini.toneChanges ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Mudanças de tonalidade</h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{result.gemini.toneChanges}</p>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-leste-blue" />
        <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function TranscriptionTab({
  copiedKey,
  filteredSegments,
  onCopy,
  onSeek,
  searchField,
  searchQuery,
  totalSegments,
  onSearchFieldChange,
  onSearchQueryChange,
}: {
  copiedKey: string | null;
  filteredSegments: YoutubeSegment[];
  onCopy: (key: string, text: string) => void;
  onSeek: (seconds: number) => void;
  searchField: string;
  searchQuery: string;
  totalSegments: number;
  onSearchFieldChange: (field: string) => void;
  onSearchQueryChange: (query: string) => void;
}) {
  const allText = filteredSegments
    .map(
      (s) =>
        `[${formatClock(s.startTime)} - ${formatClock(s.endTime)}]\n${s.participant}:\n${s.text}\n\nTonalidade: ${s.tone}\nConfiança: ${(s.confidence * 100).toFixed(0)}%`,
    )
    .join("\n\n---\n\n");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-leste-blue"
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Buscar na transcrição..."
            type="text"
            value={searchQuery}
          />
        </div>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-leste-blue"
          onChange={(e) => onSearchFieldChange(e.target.value)}
          value={searchField}
        >
          <option value="all">Tudo</option>
          <option value="word">Palavra</option>
          <option value="participant">Participante</option>
          <option value="phrase">Frase</option>
          <option value="tone">Tonalidade</option>
          <option value="timestamp">Timestamp</option>
        </select>
        <ActionButton
          fullWidth={false}
          onClick={() => onCopy("transcription-all", allText)}
          type="button"
          variant="ghost"
        >
          <Copy className="h-4 w-4" />
          {copiedKey === "transcription-all" ? "Copiado" : "Copiar"}
        </ActionButton>
      </div>

      {searchQuery.trim() ? (
        <p className="text-sm text-slate-500">
          {filteredSegments.length} de {totalSegments} segmento(s) encontrado(s).
        </p>
      ) : null}

      <div className="space-y-3">
        {filteredSegments.map((seg, i) => (
          <div
            className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4"
            key={`${seg.startTime}-${i}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-md bg-leste-blue px-2 py-1 text-xs font-bold text-white transition hover:bg-blue-950"
                onClick={() => onSeek(seg.startTime)}
                title="Reproduzir neste momento"
                type="button"
              >
                <Play className="h-3 w-3" />
                {formatClock(seg.startTime)} - {formatClock(seg.endTime)}
              </button>
              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-slate-700">
                {seg.participant}
              </span>
              <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-500">
                Confiança: {(seg.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{seg.text}</p>
            <div className="rounded-md bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase text-slate-400">Tonalidade</p>
              <p className="mt-1 text-sm text-slate-600">{seg.tone}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParticipantsTab({
  onRename,
  onSeek,
  result,
}: {
  onRename: (id: string, name: string) => void;
  onSeek: (seconds: number) => void;
  result: YoutubeAnalysisState;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Vozes separadas pelo Gemini. Os nomes só aparecem quando há evidência no título,
        descrição, apresentação verbal ou texto exibido no vídeo. Você pode renomear manualmente
        — todas as falas relacionadas serão atualizadas.
      </p>

      {result.gemini.participants.map((p) => (
        <div
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4"
          key={p.id}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-950">{p.label}</span>
                {p.name ? (
                  <span className="text-sm text-slate-500">({p.name})</span>
                ) : null}
              </div>
              <p className="text-sm text-slate-500">
                {p.segmentsCount} segmento(s) • Tempo total: {formatClock(p.totalTime)}
              </p>
              {p.evidence ? (
                <p className="text-xs text-slate-500">
                  <strong>Evidência:</strong> {p.evidence}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {editingId === p.id ? (
                <>
                  <input
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-leste-blue"
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Nome do participante"
                    type="text"
                    value={editValue}
                  />
                  <ActionButton
                    fullWidth={false}
                    onClick={() => {
                      onRename(p.id, editValue);
                      setEditingId(null);
                      setEditValue("");
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Salvar
                  </ActionButton>
                  <ActionButton
                    fullWidth={false}
                    onClick={() => {
                      setEditingId(null);
                      setEditValue("");
                    }}
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </ActionButton>
                </>
              ) : (
                <ActionButton
                  fullWidth={false}
                  onClick={() => {
                    setEditingId(p.id);
                    setEditValue(p.name ?? "");
                  }}
                  type="button"
                  variant="ghost"
                >
                  Renomear
                </ActionButton>
              )}
            </div>
          </div>

          {/* Segments for this participant */}
          <div className="space-y-2">
            {result.gemini.segments
              .filter((s) => s.participant === p.label || s.participant === p.name)
              .map((seg, i) => (
                <div
                  className="flex items-start gap-2 rounded-md bg-white px-3 py-2"
                  key={`${seg.startTime}-${i}`}
                >
                  <button
                    className="shrink-0 rounded bg-leste-blue px-1.5 py-0.5 text-xs font-bold text-white hover:bg-blue-950"
                    onClick={() => onSeek(seg.startTime)}
                    type="button"
                  >
                    {formatClock(seg.startTime)}
                  </button>
                  <p className="text-sm text-slate-700 line-clamp-2">{seg.text}</p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ToneTab({ result }: { result: YoutubeAnalysisState }) {
  return (
    <div className="space-y-4">
      {result.gemini.toneChanges ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold uppercase text-slate-500">
            Mudanças de tonalidade (global)
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {result.gemini.toneChanges}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase text-slate-500">
          Tonalidade por segmento
        </h3>
        {result.gemini.segments.map((seg, i) => (
          <div
            className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
            key={`${seg.startTime}-${i}`}
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-leste-blue px-1.5 py-0.5 text-xs font-bold text-white">
                {formatClock(seg.startTime)}
              </span>
              <span className="text-xs font-bold text-slate-600">{seg.participant}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{seg.tone}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTab({
  copiedKey,
  onCopy,
  result,
}: {
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
  result: YoutubeAnalysisState;
}) {
  const sections = [
    { key: "summary", title: "Resumo", content: result.deepseek.summary },
    { key: "topics", title: "Assuntos", content: result.deepseek.topics },
    { key: "keyPhrases", title: "Frases importantes", content: result.deepseek.keyPhrases },
  ];

  return (
    <div className="space-y-4">
      {sections.map((s) =>
        s.content.trim() ? (
          <div
            className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4"
            key={s.key}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase text-slate-500">{s.title}</h3>
              <ActionButton
                fullWidth={false}
                onClick={() => onCopy(`ds-${s.key}`, s.content)}
                type="button"
                variant="ghost"
              >
                <Copy className="h-4 w-4" />
                {copiedKey === `ds-${s.key}` ? "Copiado" : "Copiar"}
              </ActionButton>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{s.content}</p>
          </div>
        ) : null,
      )}
    </div>
  );
}

function InterpretationTab({
  copiedKey,
  onCopy,
  result,
}: {
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
  result: YoutubeAnalysisState;
}) {
  const sections = [
    { key: "interpretation", title: "Interpretação", content: result.deepseek.interpretation },
    { key: "styleAnalysis", title: "Estilo de linguagem", content: result.deepseek.styleAnalysis },
    { key: "communicationProfile", title: "Perfil de comunicação", content: result.deepseek.communicationProfile },
    { key: "generatedContent", title: "Conteúdo gerado", content: result.deepseek.generatedContent },
  ];

  return (
    <div className="space-y-4">
      {sections.map((s) =>
        s.content.trim() ? (
          <div
            className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4"
            key={s.key}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase text-slate-500">{s.title}</h3>
              <ActionButton
                fullWidth={false}
                onClick={() => onCopy(`ds-${s.key}`, s.content)}
                type="button"
                variant="ghost"
              >
                <Copy className="h-4 w-4" />
                {copiedKey === `ds-${s.key}` ? "Copiado" : "Copiar"}
              </ActionButton>
            </div>
            <textarea
              className="min-h-[200px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
              readOnly
              value={s.content}
            />
          </div>
        ) : null,
      )}
    </div>
  );
}

function ExportTab({
  onDownloadDocx,
  onDownloadTxt,
  result,
}: {
  onDownloadDocx: () => void;
  onDownloadTxt: () => void;
  result: YoutubeAnalysisState;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
        <h3 className="text-sm font-black uppercase text-slate-900">Exportar análise completa</h3>
        <p className="mt-1 text-sm text-slate-600">
          Inclui transcrição, participantes, tonalidade, notas de cena, resumo, interpretação,
          assuntos, frases importantes, estilo, perfil de comunicação e conteúdo gerado.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ActionButton fullWidth onClick={onDownloadTxt} type="button" variant="secondary">
            <Download className="h-4 w-4" />
            Baixar TXT
          </ActionButton>
          <ActionButton fullWidth onClick={onDownloadDocx} type="button" variant="primary">
            <Download className="h-4 w-4" />
            Baixar DOCX
          </ActionButton>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Resumo da análise</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Vídeo</dt>
            <dd className="font-medium text-slate-800">{result.video.title}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Canal</dt>
            <dd className="font-medium text-slate-800">{result.video.channel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Duração</dt>
            <dd className="font-medium text-slate-800">{formatClock(result.video.duration)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Segmentos</dt>
            <dd className="font-medium text-slate-800">{result.gemini.segments.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Participantes</dt>
            <dd className="font-medium text-slate-800">{result.gemini.participants.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Processado em</dt>
            <dd className="font-medium text-slate-800">
              {new Date(result.processedAt).toLocaleString("pt-BR")}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
