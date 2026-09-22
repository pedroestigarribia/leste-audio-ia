"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, Mic, Square } from "lucide-react";

import ActionButton from "@/components/ActionButton";

type RecorderState = "idle" | "recording" | "processing" | "error";

type AudioRecorderProps = {
  disabled?: boolean;
  maxFileSizeMb: number;
  onRecordingReady: (file: File) => Promise<void>;
};

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function getPreferredMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  return MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  return "webm";
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function buildRecordingName(extension: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `gravacao-${timestamp}.${extension}`;
}

export default function AudioRecorder({
  disabled = false,
  maxFileSizeMb,
  onRecordingReady,
}: AudioRecorderProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<RecorderState>("idle");
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  useEffect(() => {
    return () => {
      clearTimer();
      releaseStream();
    };
  }, []);

  async function startRecording() {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("error");
      setError("Este navegador não oferece suporte à gravação de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      // Register the stream first so failures while creating MediaRecorder still release the microphone.
      streamRef.current = stream;
      const preferredMimeType = getPreferredMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        void finishRecording(recorder, preferredMimeType);
      });

      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      recorder.start(1000);
      setState("recording");
    } catch (cause) {
      releaseStream();
      setState("error");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Permita o uso do microfone para gravar o áudio."
          : "Não foi possível iniciar a gravação. Verifique o microfone e tente novamente.",
      );
    }
  }

  async function finishRecording(recorder: MediaRecorder, preferredMimeType: string) {
    clearTimer();
    const mimeType = recorder.mimeType || preferredMimeType || chunksRef.current[0]?.type || "audio/webm";
    const chunks = chunksRef.current;
    chunksRef.current = [];
    releaseStream();

    if (!chunks.length) {
      setState("error");
      setError("A gravação não gerou áudio. Tente novamente.");
      return;
    }

    const recording = new Blob(chunks, { type: mimeType });
    const maxBytes = maxFileSizeMb * 1024 * 1024;

    if (recording.size > maxBytes) {
      setState("error");
      setError(`A gravação ultrapassou o limite de ${maxFileSizeMb} MB.`);
      return;
    }

    const file = new File([recording], buildRecordingName(extensionForMimeType(mimeType)), {
      type: mimeType,
    });

    setState("processing");

    try {
      await onRecordingReady(file);
      setState("idle");
      setElapsedSeconds(0);
    } catch (cause) {
      setState("error");
      setError(cause instanceof Error ? cause.message : "Falha ao transcrever a gravação.");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }

  const isRecording = state === "recording";
  const isProcessing = state === "processing";

  return (
    <div className="mt-5 border-t border-blue-100 pt-5">
      <div className="flex flex-col gap-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              isRecording ? "bg-red-600 text-white animate-pulse" : "bg-leste-blue text-white",
            ].join(" ")}
          >
            <Mic className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-slate-950">Gravar áudio</h3>
            <p className="mt-1 text-sm text-slate-600">
              {isRecording
                ? `Gravando agora: ${formatElapsed(elapsedSeconds)}`
                : isProcessing
                  ? "Gravação finalizada. Enviando para transcrição e análise automática."
                  : "Use o microfone e, ao parar, a gravação seguirá para transcrição automaticamente."}
            </p>
          </div>
        </div>

        {isRecording ? (
          <ActionButton className="sm:w-auto" fullWidth onClick={stopRecording} type="button" variant="danger">
            <Square className="h-4 w-4 fill-current" />
            Parar e transcrever
          </ActionButton>
        ) : (
          <ActionButton
            className="sm:w-auto"
            disabled={disabled || isProcessing}
            fullWidth
            loading={isProcessing}
          onClick={() => void startRecording()}
          type="button"
          variant="primary"
        >
            <Mic className="h-4 w-4" />
            Gravar áudio
          </ActionButton>
        )}
      </div>

      {error ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
