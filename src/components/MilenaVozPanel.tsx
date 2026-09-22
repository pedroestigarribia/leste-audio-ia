"use client";

import { useCallback, useRef, useState } from "react";

import {
  BookAudio,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileAudio,
  FileImage,
  FileText,
  Headphones,
  ImageUp,
  List,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Volume2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import type {
  AudioHistoryItem,
  AudiobookChapter,
  AudiobookProject,
  NarrationOptions,
  NarrationPrepMode,
  NarrationStyle,
  PreparedText,
  PronunciationEntry,
  SpeechQueue,
} from "@/types/audio";

export type TextVoiceSpeechKey = "text-voice";
export type ImageSpeechKey = "image-text";

export type ImageTextState = {
  fileName: string;
  fileSize: number;
  text: string;
  previewUrl: string;
};

type MilenaVozPanelProps = {
  activeSpeechKey: string | null;
  copiedKey: string | null;
  imageError?: string;
  imageState: ImageTextState | null;
  isImageExtractLoading: boolean;
  isTextVoiceLoading: boolean;
  isImageVoiceLoading: boolean;
  maxFileSizeMb: number;
  onClearImage: () => void;
  onClearText: () => void;
  onCopy: (key: string, text: string) => void;
  onDownloadSpeech: (key: string, label: string) => void;
  onImageSelected: (file: File) => void;
  onSpeak: (
    key: TextVoiceSpeechKey | ImageSpeechKey,
    title: string,
    text: string,
  ) => Promise<string | null>;
  onStopSpeech: () => void;
  onTextChange: (value: string) => void;
  speechAudioTypes: Record<string, string | undefined>;
  speechAudioUrls: Record<string, string | undefined>;
  speechErrors: Record<string, string | undefined>;
  textValue: string;
};

const DEFAULT_NARRATION_OPTIONS: NarrationOptions = {
  speed: 1.0,
  pitch: 0,
  volume: 80,
  pauseEntreParagrafos: 400,
  pauseEntreCapitulos: 1500,
  estilo: "natural",
};

/* ─── Tarja informativa ─── */
function InfoBanner() {
  return (
    <div className="rounded-lg bg-gradient-to-r from-rose-50 via-pink-50 to-purple-50 p-4 text-sm leading-relaxed text-slate-700">
      <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-rose-700">
        <Volume2 className="h-5 w-5" />
        Milena Voz
      </h3>
      <p>
        Transforme textos, respostas, transcrições, imagens, PDFs e documentos completos em áudio.
        Escolha o conteúdo, prepare a narração, ajuste voz e velocidade, acompanhe pelo player e
        baixe o resultado completo ou dividido por capítulos.
      </p>
    </div>
  );
}

/* ─── Seletor de preparação ─── */
function PrepModeSelector({
  value,
  onChange,
}: {
  value: NarrationPrepMode;
  onChange: (v: NarrationPrepMode) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
        Preparação para narração
      </label>
      <div className="flex flex-wrap gap-2">
        {(["fiel", "natural", "adaptada"] as const).map((mode) => (
          <button
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              value === mode
                ? "bg-rose-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600"
            }`}
            key={mode}
            onClick={() => onChange(mode)}
            type="button"
          >
            {mode === "fiel" ? "Leitura fiel" : mode === "natural" ? "Leitura natural" : "Versão adaptada"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Opções de narração ─── */
function NarrationOptionsPanel({
  options,
  onChange,
}: {
  options: NarrationOptions;
  onChange: (o: NarrationOptions) => void;
}) {
  const set = <K extends keyof NarrationOptions>(key: K, value: NarrationOptions[K]) =>
    onChange({ ...options, [key]: value });

  const STYLES: { value: NarrationStyle; label: string }[] = [
    { value: "natural", label: "Natural" },
    { value: "formal", label: "Formal" },
    { value: "emocional", label: "Emocional" },
    { value: "didatica", label: "Didática" },
    { value: "institucional", label: "Institucional" },
    { value: "audiolivro", label: "Audiolivro" },
    { value: "noticia", label: "Notícia" },
    { value: "apresentacao", label: "Apresentação" },
    { value: "treinamento", label: "Treinamento" },
    { value: "podcast", label: "Podcast" },
    { value: "roteiro", label: "Roteiro" },
  ];

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
        Opções de narração
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-slate-500">Velocidade</label>
          <div className="flex items-center gap-2">
            <ZoomOut className="h-3.5 w-3.5 text-slate-400" />
            <input
              className="w-full accent-rose-500"
              max={2}
              min={0.5}
              onChange={(e) => set("speed", Number(e.target.value))}
              step={0.1}
              type="range"
              value={options.speed}
            />
            <ZoomIn className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <span className="text-xs text-slate-400">{options.speed.toFixed(1)}x</span>
        </div>

        <div>
          <label className="text-xs text-slate-500">Volume</label>
          <input
            className="w-full accent-rose-500"
            max={100}
            min={0}
            onChange={(e) => set("volume", Number(e.target.value))}
            type="range"
            value={options.volume}
          />
          <span className="text-xs text-slate-400">{options.volume}%</span>
        </div>

        <div>
          <label className="text-xs text-slate-500">Pausa entre paragrafos</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
            onChange={(e) => set("pauseEntreParagrafos", Number(e.target.value))}
            value={options.pauseEntreParagrafos}
          >
            <option value={200}>200ms</option>
            <option value={400}>400ms</option>
            <option value={600}>600ms</option>
            <option value={1000}>1s</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STYLES.map((s) => (
          <button
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              options.estilo === s.value
                ? "bg-rose-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600"
            }`}
            key={s.value}
            onClick={() => set("estilo", s.value)}
            type="button"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Dicionário de pronúncia ─── */
function PronunciationDictionary({
  entries,
  onChange,
}: {
  entries: PronunciationEntry[];
  onChange: (e: PronunciationEntry[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [orig, setOrig] = useState("");
  const [pron, setPron] = useState("");

  const add = () => {
    if (!orig.trim() || !pron.trim()) return;
    onChange([...entries, { id: crypto.randomUUID(), original: orig.trim(), pronuncia: pron.trim() }]);
    setOrig("");
    setPron("");
    setShowForm(false);
  };

  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Dicionário de pronúncia
        </label>
        <ActionButton fullWidth={false} onClick={() => setShowForm(!showForm)} type="button" variant="ghost">
          <Plus className="h-3.5 w-3.5" />
          {showForm ? "Cancelar" : "Adicionar"}
        </ActionButton>
      </div>

      {showForm && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-rose-400"
            onChange={(e) => setOrig(e.target.value)}
            placeholder="Palavra original (ex: IA)"
            value={orig}
          />
          <input
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-rose-400"
            onChange={(e) => setPron(e.target.value)}
          placeholder="Pronúncia (ex: inteligência artificial)"
            value={pron}
          />
          <ActionButton fullWidth={false} onClick={add} type="button" variant="secondary">
            Adicionar
          </ActionButton>
        </div>
      )}

      {entries.length > 0 && (
        <div className="max-h-32 space-y-1 overflow-y-auto">
          {entries.map((entry) => (
            <div
              className="flex items-center justify-between rounded-md bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm"
              key={entry.id}
            >
              <span>
                <strong>{entry.original}</strong> → {entry.pronuncia}
              </span>
              <button
                className="ml-2 text-slate-400 hover:text-red-500"
                onClick={() => entry.id && remove(entry.id)}
                type="button"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Player completo ─── */
function AudioPlayerFull({
  audioUrl,
  onStop,
  onDownload,
  chunks,
}: {
  audioUrl: string;
  onStop: () => void;
  onDownload: () => void;
  chunks?: { index: number; label?: string }[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const skip = (sec: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + sec, duration));
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3 rounded-lg border border-rose-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
          <Volume2 className="mr-1 inline h-3.5 w-3.5" />
          Milena
        </span>
        <div className="flex items-center gap-1">
          <ActionButton fullWidth={false} onClick={onDownload} type="button" variant="ghost">
            <Download className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton fullWidth={false} onClick={onStop} type="button" variant="ghost">
            <Square className="h-3.5 w-3.5 text-red-500" />
          </ActionButton>
        </div>
      </div>

      <audio
        hidden
        onDurationChange={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        ref={audioRef}
        src={audioUrl}
      />

      {/* barra de progresso */}
      <div className="relative h-2 cursor-pointer rounded-full bg-slate-100">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-rose-500 transition-all"
          onClick={(e) => {
            const rect = e.currentTarget.parentElement!.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (audioRef.current) audioRef.current.currentTime = pct * duration;
          }}
          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{fmt(currentTime)}</span>
        <span>{fmt(duration)}</span>
      </div>

      {/* controles */}
      <div className="flex items-center justify-center gap-3">
        <button
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => skip(-10)}
          type="button"
        >
          <SkipBack className="h-5 w-5" />
        </button>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white shadow-md transition-transform hover:scale-105 active:scale-95"
          onClick={togglePlay}
          type="button"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <button
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => skip(10)}
          type="button"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      {/* velocidade */}
      <div className="flex items-center justify-center gap-1">
        {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
          <button
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              playbackRate === rate
                ? "bg-rose-100 text-rose-700"
                : "text-slate-500 hover:bg-slate-100"
            }`}
            key={rate}
            onClick={() => {
              setPlaybackRate(rate);
              if (audioRef.current) audioRef.current.playbackRate = rate;
            }}
            type="button"
          >
            {rate}x
          </button>
        ))}
      </div>

      {/* capítulos */}
      {chunks && chunks.length > 1 && (
        <div className="max-h-24 space-y-1 overflow-y-auto border-t border-slate-100 pt-2">
          <span className="text-xs font-semibold text-slate-500">Capítulos</span>
          {chunks.map((chunk) => (
            <div
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                chunk.index === Math.floor(currentTime / (duration / chunks.length))
                  ? "bg-rose-50 text-rose-700"
                  : "text-slate-500"
              }`}
              key={chunk.index}
            >
              <List className="h-3 w-3" />
              <span>{chunk.label ?? `Parte ${chunk.index + 1}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Pré-visualização de custo ─── */
function CostEstimator({
  charCount,
  wordCount,
  estimatedMinutes,
  chunkCount,
  onConfirm,
  onCancel,
}: {
  charCount: number;
  wordCount: number;
  estimatedMinutes: number;
  chunkCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">
        Resumo antes da geração
      </h4>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
        <div>
          <span className="block text-slate-400">Caracteres</span>
          <strong>{charCount.toLocaleString()}</strong>
        </div>
        <div>
          <span className="block text-slate-400">Palavras</span>
          <strong>{wordCount.toLocaleString()}</strong>
        </div>
        <div>
          <span className="block text-slate-400">Duração estimada</span>
          <strong>
            ~{estimatedMinutes} min
          </strong>
        </div>
        <div>
          <span className="block text-slate-400">Blocos</span>
          <strong>{chunkCount}</strong>
        </div>
      </div>
      {estimatedMinutes > 15 && (
        <p className="mb-3 text-xs text-amber-600">
          Documento longo ({estimatedMinutes} min estimados). A geração pode levar alguns minutos.
        </p>
      )}
      <div className="flex gap-2">
        <ActionButton fullWidth={false} onClick={onConfirm} type="button" variant="primary">
          <Wand2 className="h-3.5 w-3.5" />
          Confirmar e gerar
        </ActionButton>
        <ActionButton fullWidth={false} onClick={onCancel} type="button" variant="ghost">
          Cancelar
        </ActionButton>
      </div>
    </div>
  );
}

/* ─── Progresso da fila ─── */
function SpeechQueueProgress({
  queue,
  onPause,
  onResume,
  onCancel,
}: {
  queue: SpeechQueue;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const pct = queue.totalChunks > 0 ? Math.round((queue.processedChunks / queue.totalChunks) * 100) : 0;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-blue-700">
          {queue.status === "running" ? "Gerando áudio..." : queue.status === "paused" ? "Pausado" : "Fila"}
        </span>
        <span className="text-xs text-blue-500">
          {queue.processedChunks}/{queue.totalChunks} blocos
        </span>
      </div>

      <div className="mb-2 h-2 rounded-full bg-blue-100">
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs text-blue-600">
        <span>
          {queue.currentChapter && `Capítulo: ${queue.currentChapter}`}
        </span>
        <div className="flex gap-1">
          {queue.status === "running" && (
            <ActionButton fullWidth={false} onClick={onPause} type="button" variant="ghost">
              <Pause className="h-3 w-3" />
            </ActionButton>
          )}
          {queue.status === "paused" && (
            <ActionButton fullWidth={false} onClick={onResume} type="button" variant="ghost">
              <Play className="h-3 w-3" />
            </ActionButton>
          )}
          <ActionButton fullWidth={false} onClick={onCancel} type="button" variant="ghost">
            <Square className="h-3 w-3 text-red-500" />
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

/* ─── Histórico de áudios ─── */
function AudioHistoryList({
  items,
  onPlay,
  onDownload,
  onRemove,
}: {
  items: AudioHistoryItem[];
  onPlay: (item: AudioHistoryItem) => void;
  onDownload: (item: AudioHistoryItem) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
        Históricos de áudios ({items.length})
      </h4>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <div
            className="flex items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
            key={item.id}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              <p className="text-slate-400">
                {item.date} &middot; {item.durationMs ? `${Math.round(item.durationMs / 1000)}s` : ""}
                &middot; {item.format.toUpperCase()}
              </p>
            </div>
            <div className="flex gap-1">
              <ActionButton fullWidth={false} onClick={() => onPlay(item)} type="button" variant="ghost">
                <Headphones className="h-3 w-3" />
              </ActionButton>
              <ActionButton fullWidth={false} onClick={() => onDownload(item)} type="button" variant="ghost">
                <Download className="h-3 w-3" />
              </ActionButton>
              <ActionButton fullWidth={false} onClick={() => onRemove(item.id)} type="button" variant="ghost">
                <Trash2 className="h-3 w-3 text-slate-400" />
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Modo Audiolivro ─── */
function AudiobookWorkflow({
  project,
  onUpdateProject,
  onGenerateChapter,
  onGenerateAll,
  onCancel,
}: {
  project: AudiobookProject | null;
  onUpdateProject: (p: AudiobookProject) => void;
  onGenerateChapter: (chapterId: string) => void;
  onGenerateAll: () => void;
  onCancel: () => void;
}) {
  if (!project) {
    return (
      <div className="rounded-lg border border-dashed border-purple-200 bg-purple-50 p-4 text-center text-sm text-purple-600">
        <BookAudio className="mx-auto mb-2 h-8 w-8 text-purple-400" />
        <p className="font-semibold">Criar audiolivro</p>
        <p className="mt-1 text-xs text-purple-500">
          Prepare o texto, configure a voz e gere cada capítulo separadamente.
        </p>
      </div>
    );
  }

  const doneChapters = project.chapters.filter((c) => c.status === "done").length;

  return (
    <div className="rounded-lg border border-purple-200 bg-white p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-purple-700">
          <BookOpen className="h-4 w-4" />
          {project.titulo}
        </h4>
        <span className="text-xs text-purple-500">
          {doneChapters}/{project.chapters.length} capítulos
        </span>
      </div>

      <div className="mb-3 h-2 rounded-full bg-purple-100">
        <div
          className="h-full rounded-full bg-purple-500 transition-all"
          style={{ width: `${project.progresso}%` }}
        />
      </div>

      <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
        {project.chapters.map((ch) => (
          <div
            className={`flex items-center justify-between rounded-md px-3 py-1.5 ${
              ch.status === "done"
                ? "bg-green-50 text-green-700"
                : ch.status === "processing"
                  ? "bg-blue-50 text-blue-700"
                  : ch.status === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-50 text-slate-600"
            }`}
            key={ch.id}
          >
            <span className="truncate text-xs">
              {ch.order + 1}. {ch.title}
            </span>
            <div className="flex items-center gap-2">
              {ch.status === "done" && ch.audioUrl && (
                <audio controls className="h-6 w-24" src={ch.audioUrl}>
                  <track kind="captions" />
                </audio>
              )}
              {ch.status === "pending" && (
                <ActionButton
                  fullWidth={false}
                  onClick={() => onGenerateChapter(ch.id)}
                  type="button"
                  variant="ghost"
                >
                  <Play className="h-3 w-3" />
                </ActionButton>
              )}
              {ch.status === "error" && (
                <ActionButton
                  fullWidth={false}
                  onClick={() => onGenerateChapter(ch.id)}
                  type="button"
                  variant="ghost"
                >
                  <RefreshCw className="h-3 w-3 text-red-500" />
                </ActionButton>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <ActionButton fullWidth={false} onClick={onGenerateAll} type="button" variant="primary">
          <Wand2 className="h-3.5 w-3.5" />
          Gerar todos
        </ActionButton>
        <ActionButton fullWidth={false} onClick={onCancel} type="button" variant="ghost">
          Cancelar
        </ActionButton>
      </div>
    </div>
  );
}

/* ─── COMPONENTE PRINCIPAL ─── */
export default function MilenaVozPanel({
  activeSpeechKey,
  copiedKey,
  imageError,
  imageState,
  isImageExtractLoading,
  isTextVoiceLoading,
  isImageVoiceLoading,
  maxFileSizeMb,
  onClearImage,
  onClearText,
  onCopy,
  onDownloadSpeech,
  onImageSelected,
  onSpeak,
  onStopSpeech,
  onTextChange,
  speechAudioTypes,
  speechAudioUrls,
  speechErrors,
  textValue,
}: MilenaVozPanelProps) {
  const [textInput, setTextInput] = useState(textValue);
  const [prepMode, setPrepMode] = useState<NarrationPrepMode>("natural");
  const [narrationOptions, setNarrationOptions] = useState<NarrationOptions>(DEFAULT_NARRATION_OPTIONS);
  const [pronunciation, setPronunciation] = useState<PronunciationEntry[]>([]);
  const [preparedText, setPreparedText] = useState<PreparedText | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [queue, setQueue] = useState<SpeechQueue | null>(null);
  const [showAudiobook, setShowAudiobook] = useState(false);
  const [audiobookProject, setAudiobookProject] = useState<AudiobookProject | null>(null);
  const [history, setHistory] = useState<AudioHistoryItem[]>([]);
  const [activeSection, setActiveSection] = useState<"input" | "prep" | "player">("input");
  const [fileUploadType, setFileUploadType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docFileText, setDocFileText] = useState("");

  const handleTextChange = useCallback(
    (value: string) => {
      setTextInput(value);
      onTextChange(value);
    },
    [onTextChange],
  );

  /* ─── Upload de documentos ─── */
  const handleFileUpload = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      setFileUploadType(ext ?? "unknown");

      if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
        onImageSelected(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setDocFileText(content);
        handleTextChange(content);
      };

      if (ext === "txt" || ext === "md" || ext === "html" || ext === "htm") {
        reader.readAsText(file);
      } else if (ext === "pdf" || ext === "docx") {
        // PDF/DOCX will be handled via existing API extraction
        // For now, read as text (placeholder)
        reader.readAsText(file);
      }
    },
    [onImageSelected, handleTextChange],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.currentTarget.files?.[0];
      if (file) handleFileUpload(file);
      e.currentTarget.value = "";
    },
    [handleFileUpload],
  );

  /* ─── Preparar para narração ─── */
  const handlePrepare = useCallback(async () => {
    const source = preparedText?.prepared || textInput || docFileText || imageState?.text || "";
    if (!source.trim()) return;

    setIsPreparing(true);
    try {
      const res = await fetch("/api/prepare-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source, mode: prepMode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Falha ao preparar.");

      const parsed: PreparedText = JSON.parse(data.result);
      setPreparedText(parsed);
      setActiveSection("prep");
    } catch (err) {
      console.error(err);
    } finally {
      setIsPreparing(false);
    }
  }, [preparedText, textInput, docFileText, imageState, prepMode]);

  const doGenerateVoice = useCallback(
    async (text: string) => {
      const title = preparedText?.metadata?.capitulos?.[0] || "Milena Voz";
      const totalChars = text.length;

      const q: SpeechQueue = {
        id: crypto.randomUUID(),
        title,
        totalChunks: Math.ceil(totalChars / 3500),
        processedChunks: 0,
        status: "running",
        chunks: [],
        narracaoOptions: narrationOptions,
        prepMode,
      };
      setQueue(q);

      try {
        const key: TextVoiceSpeechKey = "text-voice";
        const url = await onSpeak(key, title, text);

        if (!url) {
          throw new Error("Falha ao gerar áudio com a Milena.");
        }

        setQueue((prev) =>
          prev
            ? {
                ...prev,
                status: "done",
                processedChunks: q.totalChunks,
                chunks: Array.from({ length: q.totalChunks }, (_, i) => ({
                  index: i,
                  text: "",
                  status: "done" as const,
                  retries: 0,
                  audioUrl: url,
                })),
              }
            : null,
        );

        // Add to history
        const historyItem: AudioHistoryItem = {
          id: crypto.randomUUID(),
          title,
          sourceText: text.slice(0, 200),
          sourceLabel: "Gerado",
          date: new Date().toISOString().slice(0, 19).replace("T", " "),
          format: "mp3",
          voice: "Milena",
          speed: narrationOptions.speed,
          estilo: narrationOptions.estilo,
          audioUrl: url,
        };
        setHistory((prev) => [historyItem, ...prev]);
        setActiveSection("player");
        setShowCost(false);
      } catch (err) {
        setQueue((prev) => (prev ? { ...prev, status: "error" as const } : null));
        console.error(err);
      }
    },
    [preparedText, narrationOptions, prepMode, onSpeak],
  );

  /* ─── Gerar voz (fluxo completo) ─── */
  const handleGenerateVoice = useCallback(async () => {
    const text = preparedText?.prepared || textInput || docFileText || imageState?.text || "";
    if (!text.trim()) return;

    if (text.length > 10000) {
      setShowCost(true);
      return;
    }

    await doGenerateVoice(text);
  }, [preparedText, textInput, docFileText, imageState, doGenerateVoice]);

  const handleConfirmGeneration = useCallback(() => {
    const text = preparedText?.prepared || textInput || docFileText || imageState?.text || "";
    if (text.trim()) {
      setShowCost(false);
      void doGenerateVoice(text);
    }
  }, [preparedText, textInput, docFileText, imageState, doGenerateVoice]);

  /* ─── Audiobook ─── */
  const handleStartAudiobook = useCallback(() => {
    const text = preparedText?.prepared || textInput || docFileText || imageState?.text || "";
    if (!text.trim()) return;

    const chapters: AudiobookChapter[] = (preparedText?.metadata?.capitulos?.length
      ? preparedText.metadata.capitulos
      : ["Capítulo 1"]
    ).map((title, i) => ({
      id: crypto.randomUUID(),
      title,
      text: i === 0 ? text : "",
      order: i,
      status: "pending" as const,
    }));

    setAudiobookProject({
      id: crypto.randomUUID(),
      titulo: preparedText?.metadata?.capitulos?.[0] || "Novo Audiolivro",
      chapters,
      progresso: 0,
      status: "draft",
      narracaoOptions: narrationOptions,
      prepMode,
      vozPadrao: "Milena",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowAudiobook(true);
  }, [preparedText, textInput, docFileText, imageState, narrationOptions, prepMode]);

  /* ─── Obter texto atual para preview ─── */
  const currentText = preparedText?.prepared || textInput || docFileText || imageState?.text || "";
  const charCount = currentText.length;
  const wordCount = currentText.split(/\s+/).filter(Boolean).length;
  const estimatedMinutes = Math.ceil(charCount / 900);

  const isSpeechReady =
    activeSpeechKey === "text-voice" && speechAudioUrls["text-voice"];

  return (
    <section className="space-y-4">
      <InfoBanner />

      {/* Área de entrada */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-editorial">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <FileText className="h-4 w-4 text-rose-500" />
            Documentos e conteúdos em áudio
          </h3>
          <div className="flex gap-2">
            <input
              accept=".txt,.md,.html,.htm,.pdf,.docx,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
            <ActionButton
              fullWidth={false}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="secondary"
            >
              <FileAudio className="h-3.5 w-3.5" />
              Abrir documento
            </ActionButton>
            <ActionButton
              fullWidth={false}
              onClick={() => onImageSelected(new File([], ""))}
              type="button"
              variant="secondary"
            >
              <ImageUp className="h-3.5 w-3.5" />
              Imagem
            </ActionButton>
          </div>
        </div>

        <textarea
          className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Cole um texto, transcrição, artigo, capítulo ou arraste um arquivo acima."
          value={textInput || docFileText || imageState?.text || ""}
        />

        {imageState && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-slate-50 p-2 text-xs text-slate-500">
            <FileImage className="h-3.5 w-3.5" />
            {imageState.fileName} ({imageState.text.length} chars)
            <ActionButton fullWidth={false} onClick={onClearImage} type="button" variant="ghost">
              <Trash2 className="h-3 w-3" />
            </ActionButton>
          </div>
        )}

        {/* Estimativa */}
        {charCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>{charCount.toLocaleString()} caracteres</span>
            <span>{wordCount.toLocaleString()} palavras</span>
            <span>~{estimatedMinutes} min de áudio</span>
            <span>{Math.ceil(charCount / 3500)} blocos</span>
          </div>
        )}
      </div>

      {/* Seção de preparação e opções */}
      {charCount > 0 && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-editorial">
          <PrepModeSelector onChange={setPrepMode} value={prepMode} />

          <NarrationOptionsPanel onChange={setNarrationOptions} options={narrationOptions} />

          <PronunciationDictionary entries={pronunciation} onChange={setPronunciation} />

          <div className="flex flex-wrap gap-2">
            <ActionButton
              fullWidth={false}
              loading={isPreparing}
              onClick={handlePrepare}
              type="button"
              variant="secondary"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Preparar para narração
            </ActionButton>

            {isSpeechReady ? (
              <ActionButton
                fullWidth={false}
                onClick={() => onSpeak("text-voice", "Milena Voz", currentText)}
                type="button"
                variant="primary"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerar
              </ActionButton>
            ) : (
              <ActionButton
                fullWidth={false}
                loading={queue?.status === "running"}
                onClick={handleGenerateVoice}
                type="button"
                variant="primary"
              >
                <Headphones className="h-3.5 w-3.5" />
                {charCount > 10000 ? "Ouvir com a Milena" : "Gerar voz"}
              </ActionButton>
            )}

            <ActionButton
              fullWidth={false}
              onClick={handleStartAudiobook}
              type="button"
              variant="secondary"
            >
              <BookAudio className="h-3.5 w-3.5" />
              Criar audiolivro
            </ActionButton>
          </div>
        </div>
      )}

      {/* Pré-visualização do texto preparado */}
      {preparedText && (
        <div className="rounded-lg border border-green-200 bg-white p-4 shadow-editorial">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase text-green-700">
              Texto preparado ({preparedText.mode})
            </h4>
            <span className="text-xs text-slate-400">
              ~{preparedText.metadata.estimatedDurationMinutes} min &middot;{" "}
              {preparedText.metadata.chunkCount} blocos
              {preparedText.metadata.capitulos.length > 0 &&
                ` \u00b7 ${preparedText.metadata.capitulos.length} capítulos`}
            </span>
          </div>
          <textarea
            className="min-h-[100px] w-full resize-y rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs leading-5 text-slate-700 outline-none"
            readOnly
            value={preparedText.prepared}
          />
        </div>
      )}

      {/* Custo / confirmação */}
      {showCost && (
        <CostEstimator
          charCount={charCount}
          chunkCount={Math.ceil(charCount / 3500)}
          estimatedMinutes={estimatedMinutes}
          onCancel={() => setShowCost(false)}
          onConfirm={handleConfirmGeneration}
          wordCount={wordCount}
        />
      )}

      {/* Fila de progresso */}
      {queue && queue.status !== "done" && (
        <SpeechQueueProgress
          onCancel={() => setQueue((prev) => (prev ? { ...prev, status: "cancelled" } : null))}
          onPause={() => setQueue((prev) => (prev ? { ...prev, status: "paused" } : null))}
          onResume={() => setQueue((prev) => (prev ? { ...prev, status: "running" } : null))}
          queue={queue}
        />
      )}

      {/* Player */}
      {isSpeechReady && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-editorial">
          <AudioPlayerFull
            audioUrl={speechAudioUrls["text-voice"]!}
            chunks={
              preparedText?.metadata?.capitulos?.map((label, i) => ({ index: i, label })) ?? undefined
            }
            onDownload={() => onDownloadSpeech("text-voice", "Milena Voz")}
            onStop={onStopSpeech}
          />
        </div>
      )}

      {/* Histórico */}
      <AudioHistoryList
        items={history}
        onDownload={(item) => {
          if (item.audioUrl) {
            const a = document.createElement("a");
            a.href = item.audioUrl;
            a.download = `milena-${item.title.slice(0, 30)}.${item.format}`;
            a.click();
          }
        }}
        onPlay={(item) => {
          if (item.audioUrl) onSpeak("text-voice", item.title, item.sourceText);
        }}
        onRemove={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
      />

      {/* Audiolivro */}
      {showAudiobook && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-editorial">
          <AudiobookWorkflow
            onCancel={() => setShowAudiobook(false)}
            onGenerateAll={() => {
              // placeholder
              setAudiobookProject((prev) =>
                prev ? { ...prev, status: "processing", progresso: 0 } : null,
              );
            }}
            onGenerateChapter={(chapterId) => {
              setAudiobookProject((prev) =>
                prev
                  ? {
                      ...prev,
                      chapters: prev.chapters.map((ch) =>
                        ch.id === chapterId ? { ...ch, status: "processing" } : ch,
                      ),
                    }
                  : null,
              );
            }}
            onUpdateProject={setAudiobookProject}
            project={audiobookProject}
          />
        </div>
      )}

      {/* Erros */}
      {imageError && <ErrorBox message={imageError} />}
      {speechErrors["text-voice"] && (
        <ErrorBox message={`Erro de voz: ${speechErrors["text-voice"]}`} />
      )}
    </section>
  );
}
