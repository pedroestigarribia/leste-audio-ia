"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Mic, Square, Wand2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import { copyToClipboard } from "@/lib/clipboard";
import { buildDocxBlob } from "@/lib/export-docx";
import { normalizePlainText } from "@/lib/plain-text";
import { EMPTY_VOICE_STATE, VOICE_MODES, type VoiceMode, type VoiceSemanticState } from "@/types/voice";

type Status = "idle" | "starting" | "listening" | "fallback" | "finishing";

type LiveVoicePanelProps = {
  maxFileSizeMb: number;
  transcripts: Array<{ id: string; name: string; transcription: string }>;
  onRecordingReady: (file: File) => Promise<void>;
  onLiveTranscriptReady: (file: File, transcription: string) => Promise<void>;
};

const MODE_LABELS: Record<VoiceMode, string> = {
  auto: "Automático", transcription: "Transcrição fiel", clean: "Texto limpo",
  interpretation: "Interpretação", prompt: "Prompt", dev: "Especificação técnica",
  codex: "Codex", claude: "Claude", chatgpt: "ChatGPT", document: "Documento",
  whatsapp: "WhatsApp", creative: "Briefing criativo",
};

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function extensionForType(mime: string) {
  return mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
}

function toPcmBase64(buffer: ArrayBuffer) {
  const input = new Float32Array(buffer);
  const pcm = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

export default function LiveVoicePanel({ maxFileSizeMb, transcripts, onRecordingReady, onLiveTranscriptReady }: LiveVoicePanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [interim, setInterim] = useState("");
  const [stableSegments, setStableSegments] = useState<string[]>([]);
  const [semantic, setSemantic] = useState<VoiceSemanticState>(EMPTY_VOICE_STATE);
  const [mode, setMode] = useState<VoiceMode>("auto");
  const [sourceName, setSourceName] = useState("Escuta ao vivo");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [editedOutput, setEditedOutput] = useState("");
  const [selectedTranscript, setSelectedTranscript] = useState("");
  const [customVocabulary, setCustomVocabulary] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const failureRef = useRef(false);
  const isStoppingRef = useRef(false);
  const segmentsRef = useRef<string[]>([]);
  const processedCountRef = useRef(0);
  const semanticRef = useRef<VoiceSemanticState>(EMPTY_VOICE_STATE);
  const modeRef = useRef<VoiceMode>("auto");
  const epochRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transcript = stableSegments.join("\n\n");
  const output = mode === "transcription" ? transcript : editedOutput || semantic.output;

  const clearCapture = useCallback(() => {
    captureRef.current?.disconnect();
    sourceRef.current?.disconnect();
    captureRef.current = null;
    sourceRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
  }, []);

  const cancelInterpretation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
    epochRef.current += 1;
    setIsInterpreting(false);
  }, []);

  useEffect(() => () => {
    cancelInterpretation();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    clearCapture();
  }, [cancelInterpretation, clearCapture]);

  const interpret = useCallback(async (fullRefresh = false) => {
    if (modeRef.current === "transcription" || requestRef.current) return;
    const pending = segmentsRef.current.slice(fullRefresh ? 0 : processedCountRef.current);
    if (!pending.length) return;
    const newText = pending.join("\n\n");
    if (newText.length > 40_000) {
      setError("O trecho excede 40.000 caracteres para interpretação. Divida o material e analise por partes.");
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const epoch = epochRef.current;
    const processedThrough = segmentsRef.current.length;
    setIsInterpreting(true);
    try {
      const response = await fetch("/api/voice-interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newText, previous: fullRefresh ? EMPTY_VOICE_STATE : semanticRef.current, mode: modeRef.current, fullRefresh }),
        signal: controller.signal,
      });
      const payload = await response.json() as { ok: boolean; state?: VoiceSemanticState; error?: string };
      if (!response.ok || !payload.ok || !payload.state) throw new Error(payload.error || "Falha ao interpretar o trecho.");
      if (epoch !== epochRef.current) return;
      processedCountRef.current = processedThrough;
      semanticRef.current = payload.state;
      setSemantic(payload.state);
      setEditedOutput("");
      setError("");
    } catch (cause) {
      if (!controller.signal.aborted && epoch === epochRef.current) {
        setError(cause instanceof Error ? cause.message : "Falha ao interpretar o trecho.");
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (epoch === epochRef.current) {
        setIsInterpreting(false);
        if (processedCountRef.current < segmentsRef.current.length && processedCountRef.current > 0) {
          timerRef.current = setTimeout(() => void interpret(), 1800);
        }
      }
    }
  }, []);

  function commitSegment(text: string) {
    const normalized = text.trim();
    if (!normalized) return;
    const existing = segmentsRef.current.at(-1);
    if (existing === normalized) return;
    segmentsRef.current = [...segmentsRef.current, normalized];
    setStableSegments(segmentsRef.current);
    setInterim("");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void interpret(), 2000);
  }

  async function startCapture(stream: MediaStream) {
    if (!window.AudioWorkletNode) throw new Error("Este navegador não oferece AudioWorklet para escuta ao vivo.");
    const context = new AudioContext();
    audioContextRef.current = context;
    await context.audioWorklet.addModule("/pcm-capture-worklet.js");
    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, "pcm-capture");
    sourceRef.current = source;
    captureRef.current = capture;
    capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 512_000) return;
      ws.send(JSON.stringify({ realtimeInput: { audio: { data: toPcmBase64(event.data), mimeType: "audio/pcm;rate=16000" } } }));
    };
    source.connect(capture);
    capture.connect(context.destination);
    await context.resume();
  }

  async function startListening() {
    if (status !== "idle" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Microfone ou gravação não disponível neste navegador.");
      return;
    }
    setStatus("starting");
    setError("");
    setNotice("");
    setInterim("");
    setStableSegments([]);
    segmentsRef.current = [];
    semanticRef.current = EMPTY_VOICE_STATE;
    setSemantic(EMPTY_VOICE_STATE);
    setEditedOutput("");
    processedCountRef.current = 0;
    failureRef.current = false;
    isStoppingRef.current = false;
    cancelInterpretation();
    setSourceName("Escuta ao vivo");
    setSelectedTranscript("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const preferredMime = MIME_TYPES.find((mime) => MediaRecorder.isTypeSupported(mime));
      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.start(1000);

      const response = await fetch("/api/live-transcribe-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabulary: customVocabulary.split(/[,;\n]/).map((term) => term.trim()).filter(Boolean).slice(0, 50) }),
      });
      const payload = await response.json() as { ok: boolean; token?: string; model?: string; config?: object; error?: string };
      if (!response.ok || !payload.ok || !payload.token || !payload.model || !payload.config) {
        throw new Error(payload.error || "Escuta ao vivo indisponível.");
      }
      if (isStoppingRef.current) return;

      const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(payload.token)}`);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ setup: { model: `models/${payload.model}`, generationConfig: { responseModalities: ["TEXT"] }, inputAudioTranscription: (payload.config as { inputAudioTranscription: object }).inputAudioTranscription } }));
      ws.onmessage = async (event) => {
        try {
          const raw = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
          const message = JSON.parse(raw) as { setupComplete?: object; serverContent?: { interimInputTranscription?: { text?: string }; inputTranscription?: { text?: string } }; error?: { message?: string } };
          if (message.error) throw new Error(message.error.message || "Conexão de voz recusada.");
          if (message.setupComplete && streamRef.current && !isStoppingRef.current) {
            void startCapture(streamRef.current).then(() => setStatus("listening")).catch((cause) => {
              failureRef.current = true;
              setNotice(`Escuta ao vivo indisponível: ${cause instanceof Error ? cause.message : "erro de captura"}. Ao parar, a gravação será transcrita como arquivo.`);
              setStatus("fallback");
            });
          }
          const partial = message.serverContent?.interimInputTranscription?.text;
          if (partial && !isStoppingRef.current) setInterim(partial);
          const final = message.serverContent?.inputTranscription?.text;
          if (final) commitSegment(final);
        } catch {
          failureRef.current = true;
          setStatus("fallback");
          setNotice("A conexão ao vivo falhou. A gravação continua; ao parar, será transcrita como arquivo.");
        }
      };
      ws.onerror = () => {
        failureRef.current = true;
        if (!isStoppingRef.current) {
          setStatus("fallback");
          setNotice("A conexão ao vivo caiu. A gravação continua para transcrição ao finalizar.");
        }
      };
      ws.onclose = () => {
        if (!isStoppingRef.current) {
          failureRef.current = true;
          setStatus("fallback");
          setNotice("Sessão ao vivo encerrada. Ao parar, a gravação será transcrita como arquivo.");
        }
      };
    } catch (cause) {
      if (!streamRef.current) {
        clearCapture();
        setStatus("idle");
        setError(cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Permita o microfone para iniciar a escuta." : cause instanceof Error ? cause.message : "Falha ao abrir o microfone.");
      } else {
        failureRef.current = true;
        setStatus("fallback");
        setNotice(`${cause instanceof Error ? cause.message : "Escuta ao vivo indisponível."} A gravação continua; ao parar, será transcrita como arquivo.`);
      }
    }
  }

  async function stopListening() {
    if (!recorderRef.current || isStoppingRef.current) return;
    isStoppingRef.current = true;
    setStatus("finishing");
    const recorder = recorderRef.current;
    const chunksReady = new Promise<void>((resolve) => { recorder.addEventListener("stop", () => resolve(), { once: true }); });
    if (recorder.state !== "inactive") recorder.stop();
    else return;
    captureRef.current?.disconnect();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    }
    await chunksReady;
    await new Promise((resolve) => setTimeout(resolve, failureRef.current ? 100 : 1600));
    const mime = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];
    recorderRef.current = null;
    clearCapture();
    if (!blob.size) {
      setError("O microfone não gerou áudio. Tente novamente.");
      setStatus("idle");
      return;
    }
    if (blob.size > maxFileSizeMb * 1024 * 1024) {
      setError(`A gravação excedeu ${maxFileSizeMb} MB. Grave um trecho menor.`);
      setStatus("idle");
      return;
    }
    const file = new File([blob], `escuta-${new Date().toISOString().replace(/[:.]/g, "-")}.${extensionForType(mime)}`, { type: mime });
    try {
      if (failureRef.current || !segmentsRef.current.length) {
        await onRecordingReady(file);
        setNotice("Gravação enviada para a transcrição de arquivo e análises automáticas.");
      } else {
        await onLiveTranscriptReady(file, segmentsRef.current.join("\n\n"));
        setNotice("Transcrição ao vivo enviada para resumo, organização e interpretação automáticos.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao processar a gravação.");
    } finally {
      setStatus("idle");
      isStoppingRef.current = false;
    }
  }

  function changeMode(next: VoiceMode) {
    modeRef.current = next;
    setMode(next);
    cancelInterpretation();
    processedCountRef.current = 0;
    semanticRef.current = EMPTY_VOICE_STATE;
    setSemantic(EMPTY_VOICE_STATE);
    setEditedOutput("");
    if (segmentsRef.current.length && next !== "transcription") timerRef.current = setTimeout(() => void interpret(true), 200);
  }

  function selectExistingTranscript(id: string) {
    if (status !== "idle") return;
    const item = transcripts.find((entry) => entry.id === id);
    setSelectedTranscript(id);
    setSourceName(item?.name || "Escuta ao vivo");
    cancelInterpretation();
    segmentsRef.current = item ? [item.transcription] : [];
    setStableSegments(segmentsRef.current);
    processedCountRef.current = 0;
    semanticRef.current = EMPTY_VOICE_STATE;
    setSemantic(EMPTY_VOICE_STATE);
    setEditedOutput("");
    setError("");
    if (item && modeRef.current !== "transcription") timerRef.current = setTimeout(() => void interpret(true), 200);
  }

  async function copy(text: string) {
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("A cópia automática falhou. Selecione o texto e copie manualmente.");
    }
  }

  async function downloadDocx() {
    try {
      const blob = await buildDocxBlob({ fileTitle: `Entendimento de voz - ${sourceName}`, sections: [
        { title: "Transcrição fiel", content: transcript },
        { title: "Texto normalizado", content: semantic.normalizedText },
        { title: "Interpretação", content: semantic.interpretation },
        { title: `Resultado - ${MODE_LABELS[mode]}`, content: output },
      ] });
      downloadBlob(blob, `entendimento-voz-leste-${new Date().toISOString().slice(0, 10)}.docx`);
    } catch {
      setError("Não foi possível gerar o DOCX.");
    }
  }

  return (
    <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Mic className="h-5 w-5 text-leste-blue" /> Escuta ao vivo e entendimento da voz</h2>
          <p className="mt-1 text-sm text-slate-600">Fale naturalmente. A transcrição provisória aparece enquanto você fala; trechos confirmados alimentam o entendimento.</p>
        </div>
        {status === "idle" ? (
          <ActionButton onClick={() => void startListening()} type="button"><Mic className="h-4 w-4" /> Começar a ouvir</ActionButton>
        ) : (
          <ActionButton disabled={status === "finishing"} onClick={() => void stopListening()} type="button" variant="danger"><Square className="h-4 w-4" /> Parar e processar</ActionButton>
        )}
      </div>

      <p aria-live="polite" className="mt-3 text-sm font-semibold text-leste-blue">
        {status === "starting" ? "Abrindo microfone e conexão..." : status === "listening" ? "Ouvindo e transcrevendo ao vivo" : status === "fallback" ? "Gravando para transcrição ao finalizar" : status === "finishing" ? "Finalizando e enviando para análise..." : "Microfone desligado"}
      </p>
      {notice ? <p className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900" role="status">{notice}</p> : null}
      {error ? <div className="mt-3"><ErrorBox message={error} /></div> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Analisar áudio já transcrito
          <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" disabled={status !== "idle"} onChange={(event) => selectExistingTranscript(event.target.value)} value={selectedTranscript}>
            <option value="">Selecione uma transcrição</option>
            {transcripts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Formato do resultado
          <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" onChange={(event) => changeMode(event.target.value as VoiceMode)} value={mode}>
            {VOICE_MODES.map((entry) => <option key={entry} value={entry}>{MODE_LABELS[entry]}</option>)}
          </select>
        </label>
      </div>

      <label className="mt-3 block text-sm font-semibold text-slate-700">Vocabulário personalizado (nomes, marcas ou termos técnicos, separados por vírgula)
        <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" disabled={status !== "idle"} maxLength={1000} onChange={(event) => setCustomVocabulary(event.target.value)} placeholder="Ex.: Mulheres do Leste, nome da entrevistada" value={customVocabulary} />
      </label>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-slate-900">Transcrição fiel</h3><button className="text-sm font-semibold text-leste-blue disabled:opacity-40" disabled={!transcript} onClick={() => void copy(transcript)} type="button"><Copy className="mr-1 inline h-4 w-4" /> Copiar</button></div>
          <div className="mt-2 min-h-[150px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-800" role="log">{transcript || "Os trechos confirmados aparecerão aqui."}{interim ? <p className="mt-2 border-l-2 border-leste-gold pl-2 text-slate-500">Provisório: {interim}</p> : null}</div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-slate-900">{MODE_LABELS[mode]}</h3>{isInterpreting ? <span className="text-xs text-slate-500">Atualizando entendimento...</span> : null}</div>
          {semantic.intent && mode !== "transcription" ? <p className="mt-2 text-xs text-slate-600">Intenção: {semantic.intent}{semantic.domain ? ` · Contexto: ${semantic.domain}` : ""}</p> : null}
          <textarea className="mt-2 min-h-[150px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800" onChange={(event) => setEditedOutput(event.target.value)} placeholder="O entendimento aparecerá após a primeira fala confirmada." readOnly={mode === "transcription"} value={output} />
          {semantic.exclusions.length ? <p className="mt-1 text-xs text-slate-600">Não incluir: {semantic.exclusions.join("; ")}</p> : null}
          {semantic.openQuestions.length ? <p className="mt-1 text-xs text-amber-800">A confirmar: {semantic.openQuestions.join("; ")}</p> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton disabled={!transcript || isInterpreting || mode === "transcription"} fullWidth={false} onClick={() => void interpret(true)} type="button" variant="ghost"><Wand2 className="h-4 w-4" /> Reinterpretar</ActionButton>
        <ActionButton disabled={!output} fullWidth={false} onClick={() => void copy(output)} type="button" variant="secondary">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiado" : "Copiar resultado"}</ActionButton>
        <ActionButton disabled={!output} fullWidth={false} onClick={() => downloadBlob(new Blob([normalizePlainText(`TRANSCRIÇÃO FIEL\n${transcript}\n\nTEXTO NORMALIZADO\n${semantic.normalizedText}\n\nINTERPRETAÇÃO\n${semantic.interpretation}\n\nRESULTADO\n${output}`)], { type: "text/plain;charset=utf-8" }), `entendimento-voz-leste-${new Date().toISOString().slice(0, 10)}.txt`)} type="button" variant="ghost"><Download className="h-4 w-4" /> TXT</ActionButton>
        <ActionButton disabled={!output} fullWidth={false} onClick={() => void downloadDocx()} type="button" variant="ghost"><Download className="h-4 w-4" /> DOCX</ActionButton>
      </div>
      <p className="mt-3 text-xs text-slate-500">A fala original não é sobrescrita pela interpretação. Revise inferências antes de usar. Se o Live falhar, a gravação seguirá pela transcrição de arquivo ao parar.</p>
    </section>
  );
}
