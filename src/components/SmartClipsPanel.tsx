"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  Film,
  PauseCircle,
  PlayCircle,
  Search,
  Sparkles,
  Square,
  WandSparkles,
} from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import ProgressBar from "@/components/ProgressBar";
import { copyToClipboard } from "@/lib/clipboard";
import type {
  AspectRatio,
  CaptionPreset,
  ClipCandidate,
  ClipPreferences,
  RenderOptions,
  RenderedClip,
  VideoJobState,
} from "@/types/video";

type PublicOutput = Omit<RenderedClip, "filePath" | "srtPath">;
type PublicJob = Omit<VideoJobState, "outputs"> & { outputs: PublicOutput[] };

type SourceMode = "upload" | "youtube";

type EditRange = {
  startTime: string;
  endTime: string;
};

const INITIAL_PREFERENCES: ClipPreferences = {
  mode: "discover",
  genre: "Auto",
  durationPreset: "30-60",
  minDurationSec: 30,
  maxDurationSec: 60,
  desiredCount: 8,
};

const INITIAL_RENDER_OPTIONS: RenderOptions = {
  aspectRatio: "9:16",
  captionPreset: "simple",
  reframeMode: "center",
};

const STAGE_LABELS: Record<VideoJobState["stage"], string> = {
  created: "Pronto para iniciar",
  validating: "Validando origem",
  acquiring: "Obtendo vídeo",
  probing: "Lendo metadados",
  extracting_audio: "Extraindo áudio",
  transcribing: "Transcrevendo com tempo",
  analyzing_scenes: "Relacionando cenas",
  analyzing_semantics: "Entendendo o conteúdo",
  generating_candidates: "Criando candidatos",
  ranking_candidates: "Pontuando cortes",
  ready_for_review: "Pronto para revisar",
  rendering: "Gerando arquivos",
  completed: "Concluído",
  cancelled: "Cancelado",
  failed: "Falhou",
};

const ACTIVE_STAGES = new Set<VideoJobState["stage"]>([
  "created",
  "validating",
  "acquiring",
  "probing",
  "extracting_audio",
  "transcribing",
  "analyzing_scenes",
  "analyzing_semantics",
  "generating_candidates",
  "ranking_candidates",
  "rendering",
]);

const GENRES = ["Auto", "Podcast", "Negócios", "Marketing", "Vendas", "Educação", "Tecnologia", "Storytelling", "Entrevista"];

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseApiError(data: unknown) {
  if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return "Não foi possível completar esta operação.";
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) throw new Error(parseApiError(data));
  return data as { ok?: boolean; error?: string; job?: PublicJob; jobId?: string };
}

function CandidateCard({
  candidate,
  selected,
  range,
  onToggle,
  onRangeChange,
}: {
  candidate: ClipCandidate;
  selected: boolean;
  range: EditRange;
  onToggle: () => void;
  onRangeChange: (key: keyof EditRange, value: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <article className={`rounded-2xl border p-4 transition ${selected ? "border-leste-blue bg-blue-50/60 shadow-md" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        <button
          aria-label={selected ? "Desmarcar corte" : "Selecionar corte"}
          className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${selected ? "border-leste-blue bg-leste-blue text-white" : "border-slate-300 bg-white text-transparent"}`}
          onClick={onToggle}
          type="button"
        >
          <Check className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-leste-gold px-2.5 py-1 text-xs font-black text-slate-950">
              {candidate.retentionScore}/100
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{candidate.category}</span>
            <span className="text-xs text-slate-500">{formatSeconds(candidate.startTime)} - {formatSeconds(candidate.endTime)}</span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-950">{candidate.title}</h3>
          {candidate.topic ? <p className="mt-1 text-sm font-semibold text-leste-blue">Tema: {candidate.topic}</p> : null}
          <p className="mt-2 text-sm leading-6 text-slate-700">{candidate.summary || candidate.transcriptExcerpt}</p>
          {candidate.reason ? <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-600"><strong>Por que este corte:</strong> {candidate.reason}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-bold text-slate-600">
          Início (segundos)
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950" min="0" onChange={(event) => onRangeChange("startTime", event.target.value)} step="0.1" type="number" value={range.startTime} />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Fim (segundos)
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950" min="0" onChange={(event) => onRangeChange("endTime", event.target.value)} step="0.1" type="number" value={range.endTime} />
        </label>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-leste-blue hover:bg-blue-50" onClick={() => setDetailsOpen((value) => !value)} type="button">
          {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {detailsOpen ? "Ocultar análise" : "Ver análise"}
        </button>
      </div>

      {detailsOpen ? (
        <div className="mt-3 grid gap-3 rounded-xl bg-slate-950 p-4 text-xs text-slate-200 sm:grid-cols-2">
          <p><strong className="text-leste-gold">Gancho:</strong> {candidate.hook || "Não informado"}</p>
          <p><strong className="text-leste-gold">Confiança:</strong> {candidate.confidence}/100</p>
          <p><strong className="text-leste-gold">Legenda sugerida:</strong> {candidate.suggestedCaption || "Não informada"}</p>
          <p><strong className="text-leste-gold">Copy sugerida:</strong> {candidate.suggestedCopy || "Não informada"}</p>
          <p className="sm:col-span-2"><strong className="text-leste-gold">Trecho:</strong> {candidate.transcriptExcerpt || "Não disponível"}</p>
          <p className="sm:col-span-2"><strong className="text-leste-gold">Critérios:</strong> gancho {candidate.retentionBreakdown.hook}, clareza {candidate.retentionBreakdown.standaloneClarity}, valor prático {candidate.retentionBreakdown.practicalValue}, força emocional {candidate.retentionBreakdown.emotionalStrength}, final {candidate.retentionBreakdown.endingQuality}.</p>
        </div>
      ) : null}
    </article>
  );
}

function OutputCard({ output, onCopy }: { output: PublicOutput; onCopy: (text: string) => void }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <video className="aspect-video w-full bg-slate-950 object-contain" controls preload="metadata" src={output.downloadUrl} />
      <div className="space-y-3 p-4">
        <h3 className="font-black text-slate-950">{output.title}</h3>
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-leste-blue px-3 py-2 text-xs font-bold text-white hover:bg-blue-950" download href={output.downloadUrl}>
            <Download className="h-4 w-4" /> MP4
          </a>
          {output.srtDownloadUrl ? <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-leste-blue hover:bg-blue-50" download href={output.srtDownloadUrl}><Download className="h-4 w-4" /> SRT</a> : null}
          <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-leste-blue hover:bg-blue-50" onClick={() => onCopy(output.title)} type="button"><Copy className="h-4 w-4" /> Copiar título</button>
        </div>
      </div>
    </article>
  );
}

export default function SmartClipsPanel() {
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [preferences, setPreferences] = useState<ClipPreferences>(INITIAL_PREFERENCES);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>(INITIAL_RENDER_OPTIONS);
  const [job, setJob] = useState<PublicJob | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ranges, setRanges] = useState<Record<string, EditRange>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const active = Boolean(job && ACTIVE_STAGES.has(job.stage) && job.stage !== "created");
  const selectedCandidates = useMemo(() => job?.candidates.filter((candidate) => selectedIds.includes(candidate.id)) ?? [], [job?.candidates, selectedIds]);

  useEffect(() => {
    if (!job || !ACTIVE_STAGES.has(job.stage) || job.stage === "created") return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const data = await fetchJson(`/api/cuts/jobs/${encodeURIComponent(job.jobId)}`);
        if (!disposed && data.job) {
          setJob(data.job);
          if (ACTIVE_STAGES.has(data.job.stage) && data.job.stage !== "created") {
            timer = setTimeout(poll, 900);
          }
        }
      } catch (pollError) {
        if (!disposed) setError(pollError instanceof Error ? pollError.message : "Falha ao atualizar o progresso.");
      }
    };

    timer = setTimeout(poll, 500);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [job]);

  useEffect(() => {
    if (!job?.candidates.length || selectedIds.length) return;
    const first = job.candidates[0];
    setSelectedIds([first.id]);
    setRanges(Object.fromEntries(job.candidates.map((candidate) => [candidate.id, { startTime: String(candidate.startTime.toFixed(1)), endTime: String(candidate.endTime.toFixed(1)) }])));
  }, [job?.candidates, selectedIds.length]);

  async function startAnalysis() {
    setError("");
    if (sourceMode === "upload" && !file) {
      setError("Selecione um vídeo MP4 para começar.");
      return;
    }
    if (sourceMode === "youtube" && !youtubeUrl.trim()) {
      setError("Informe um link público do YouTube.");
      return;
    }

    setLoading(true);
    try {
      let created: { jobId?: string; job?: PublicJob };
      if (sourceMode === "upload" && file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("preferences", JSON.stringify(preferences));
        created = await fetchJson("/api/cuts/jobs", { body: formData, method: "POST" });
      } else {
        created = await fetchJson("/api/cuts/jobs", {
          body: JSON.stringify({ sourceType: "youtube", url: youtubeUrl, preferences }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      }
      if (!created.jobId || !created.job) throw new Error("A API não retornou o job criado.");
      setJob(created.job);
      const started = await fetchJson(`/api/cuts/jobs/${created.jobId}/analyze`, {
        body: JSON.stringify({ preferences }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (started.job) setJob(started.job);
      setSelectedIds([]);
      setRanges({});
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Não foi possível iniciar a análise.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelJob() {
    if (!job) return;
    setError("");
    try {
      const data = await fetchJson(`/api/cuts/jobs/${job.jobId}/cancel`, { method: "POST" });
      if (data.job) setJob(data.job);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Não foi possível cancelar.");
    }
  }

  async function renderSelected() {
    if (!job || !selectedCandidates.length) {
      setError("Selecione pelo menos um corte para gerar o vídeo.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await fetchJson(`/api/cuts/jobs/${job.jobId}/render`, {
        body: JSON.stringify({
          clips: selectedCandidates.map((candidate) => ({
            candidateId: candidate.id,
            startTime: Number(ranges[candidate.id]?.startTime ?? candidate.startTime),
            endTime: Number(ranges[candidate.id]?.endTime ?? candidate.endTime),
          })),
          options: renderOptions,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (data.job) setJob(data.job);
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : "Não foi possível gerar os cortes.");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string) {
    try {
      await copyToClipboard(text);
      setCopied(text);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  function setPreference<Key extends keyof ClipPreferences>(key: Key, value: ClipPreferences[Key]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function selectCandidate(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <section className="space-y-5 rounded-[1.75rem] border border-blue-100 bg-[#f7f8fc] p-4 shadow-editorial sm:p-6" id="cortes-inteligentes">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-leste-gold px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-950"><Clapperboard className="h-4 w-4" /> Produto de vídeo</div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Cortes Inteligentes</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Envie um vídeo ou use um link público do YouTube. A análise encontra trechos independentes, explica a escolha e prepara arquivos para redes sociais sem prometer viralização.</p>
        </div>
        <a className="inline-flex items-center gap-2 text-sm font-bold text-leste-blue hover:underline" href="#audio-pdf"><ExternalLink className="h-4 w-4" /> Voltar aos conteúdos</a>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <button className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${sourceMode === "upload" ? "bg-leste-blue text-white" : "border border-blue-200 text-leste-blue"}`} onClick={() => setSourceMode("upload")} type="button"><Film className="h-4 w-4" /> Enviar vídeo</button>
            <button className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${sourceMode === "youtube" ? "bg-leste-blue text-white" : "border border-blue-200 text-leste-blue"}`} onClick={() => setSourceMode("youtube")} type="button"><ExternalLink className="h-4 w-4" /> Link do YouTube</button>
          </div>

          {sourceMode === "upload" ? (
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5 text-center hover:border-leste-blue">
              <Film className="h-8 w-8 text-leste-blue" />
              <span className="mt-2 text-sm font-black text-slate-950">{file ? file.name : "Escolha ou arraste um vídeo"}</span>
              <span className="mt-1 text-xs text-slate-600">MP4 recomendado, também aceita MOV, WEBM e M4V. Limite configurável do produto.</span>
              <input accept="video/mp4,video/quicktime,video/webm,video/x-m4v" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
            </label>
          ) : (
            <label className="block text-sm font-bold text-slate-700">URL pública do YouTube
              <input className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-normal text-slate-950 outline-none focus:border-leste-blue focus:ring-2 focus:ring-blue-100" onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." type="url" value={youtubeUrl} />
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">Modo
              <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950" onChange={(event) => setPreference("mode", event.target.value as ClipPreferences["mode"])} value={preferences.mode}><option value="discover">Descobrir melhores cortes</option><option value="find">Encontrar um momento</option></select>
            </label>
            <label className="text-xs font-bold text-slate-600">Gênero / contexto
              <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950" onChange={(event) => setPreference("genre", event.target.value)} value={preferences.genre}>{GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select>
            </label>
          </div>
          {preferences.mode === "find" ? <label className="block text-xs font-bold text-slate-600">O que você quer encontrar?
            <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal text-slate-950" onChange={(event) => setPreference("query", event.target.value)} placeholder="Ex.: a parte em que ele explica como aumentar as vendas" value={preferences.query ?? ""} />
          </label> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">Duração desejada
              <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950" onChange={(event) => setPreference("durationPreset", event.target.value as ClipPreferences["durationPreset"])} value={preferences.durationPreset}><option value="30">Até 45 segundos</option><option value="30-60">30 a 60 segundos</option><option value="60-90">60 a 90 segundos</option><option value="90-180">90 a 180 segundos</option><option value="custom">Personalizada</option></select>
            </label>
            <label className="text-xs font-bold text-slate-600">Quantidade de sugestões
              <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950" max="20" min="1" onChange={(event) => setPreference("desiredCount", Number(event.target.value))} type="number" value={preferences.desiredCount ?? 8} />
            </label>
          </div>
          {preferences.durationPreset === "custom" ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Mínimo em segundos<input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950" min="5" onChange={(event) => setPreference("minDurationSec", Number(event.target.value))} type="number" value={preferences.minDurationSec ?? 15} /></label><label className="text-xs font-bold text-slate-600">Máximo em segundos<input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950" min="5" onChange={(event) => setPreference("maxDurationSec", Number(event.target.value))} type="number" value={preferences.maxDurationSec ?? 180} /></label></div> : null}

          <div className="flex flex-col gap-2 sm:flex-row"><ActionButton className="sm:flex-1" disabled={active} loading={loading} onClick={() => { void startAnalysis(); }} type="button"><Sparkles className="h-4 w-4" /> Analisar e encontrar cortes</ActionButton>{active ? <ActionButton onClick={() => { void cancelJob(); }} type="button" variant="danger"><Square className="h-4 w-4" /> Cancelar</ActionButton> : null}</div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white sm:p-5">
          <div><p className="text-xs font-black uppercase tracking-[0.15em] text-leste-gold">Saída editorial</p><h3 className="mt-2 text-xl font-black">Como o corte será preparado</h3></div>
          <ul className="space-y-3 text-sm leading-6 text-slate-300"><li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-leste-gold" /> Transcrição com intervalos temporais e participantes quando identificáveis.</li><li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-leste-gold" /> Temas, ganchos, clareza, valor prático, final e riscos explicados.</li><li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-leste-gold" /> Você revisa os pontos de início e fim antes de renderizar.</li><li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-leste-gold" /> MP4 com legenda queimada e arquivo SRT separado.</li></ul>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-400">O arquivo original e as saídas são temporários no servidor. As saídas expiram conforme <code className="text-slate-200">CUT_OUTPUT_TTL_MINUTES</code>.</div>
        </div>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      {job ? <div className="space-y-5 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-leste-blue">{job.sourceName}</p><h3 className="mt-1 text-xl font-black text-slate-950">{STAGE_LABELS[job.stage]}</h3><p className="mt-1 text-sm text-slate-600">{job.message}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${job.stage === "failed" ? "bg-red-100 text-red-700" : job.stage === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-leste-blue"}`}>{job.progress}%</span></div>
        <ProgressBar label="Progresso do processamento" value={job.progress} />
        {job.error ? <ErrorBox message={job.error} /> : null}

        {job.candidates.length ? <div className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-lg font-black text-slate-950">Candidatos encontrados</h3><p className="text-sm text-slate-600">{selectedCandidates.length} selecionado(s) para renderização.</p></div><ActionButton disabled={!selectedCandidates.length || active} loading={loading} onClick={() => { void renderSelected(); }} type="button" variant="secondary"><WandSparkles className="h-4 w-4" /> Gerar cortes selecionados</ActionButton></div><div className="grid gap-4 xl:grid-cols-2">{job.candidates.map((candidate) => <CandidateCard candidate={candidate} key={candidate.id} onRangeChange={(key, value) => setRanges((current) => ({ ...current, [candidate.id]: { ...(current[candidate.id] ?? { startTime: String(candidate.startTime), endTime: String(candidate.endTime) }), [key]: value } }))} onToggle={() => selectCandidate(candidate.id)} range={ranges[candidate.id] ?? { startTime: String(candidate.startTime.toFixed(1)), endTime: String(candidate.endTime.toFixed(1)) }} selected={selectedIds.includes(candidate.id)} />)}</div></div> : null}

        {job.candidates.length ? <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3"><label className="text-xs font-bold text-slate-600">Formato<select className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950" onChange={(event) => setRenderOptions((current) => ({ ...current, aspectRatio: event.target.value as AspectRatio }))} value={renderOptions.aspectRatio}><option value="9:16">Vertical 9:16</option><option value="1:1">Quadrado 1:1</option><option value="16:9">Horizontal 16:9</option></select></label><label className="text-xs font-bold text-slate-600">Legendas<select className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950" onChange={(event) => setRenderOptions((current) => ({ ...current, captionPreset: event.target.value as CaptionPreset }))} value={renderOptions.captionPreset}><option value="simple">Simples</option><option value="dynamic">Dinâmicas</option><option value="none">Sem legenda</option></select></label><label className="text-xs font-bold text-slate-600">Reenquadramento<select className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950" onChange={(event) => setRenderOptions((current) => ({ ...current, reframeMode: event.target.value as RenderOptions["reframeMode"] }))} value={renderOptions.reframeMode}><option value="center">Centralizado</option><option value="face">Rosto (planejado)</option><option value="speaker">Pessoa falando (planejado)</option><option value="subject">Assunto (planejado)</option><option value="screen">Tela (planejado)</option></select></label></div> : null}

        {job.outputs.length ? <div className="space-y-4"><div><h3 className="text-lg font-black text-slate-950">Cortes gerados</h3><p className="text-sm text-slate-600">Assista no painel, baixe o MP4 ou use o SRT em outro editor.</p></div><div className="grid gap-4 lg:grid-cols-2">{job.outputs.map((output) => <OutputCard key={output.id} onCopy={(text) => { void copyText(text); }} output={output} />)}</div></div> : null}
      </div> : null}

      {copied ? <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-xl"><Check className="mr-2 inline h-4 w-4 text-leste-gold" /> Copiado</div> : null}
    </section>
  );
}
