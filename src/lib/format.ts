import type { AudioStatus } from "@/types/audio";

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const precision = value >= 10 || exponent === 0 ? 0 : 1;

  return `${value.toFixed(precision)} ${units[exponent]}`;
}

export function formatStatusLabel(status: AudioStatus) {
  const labels: Record<AudioStatus, string> = {
    idle: "Aguardando",
    queued: "Na fila",
    uploading: "Enviando",
    converting: "Convertendo",
    transcribing: "Transcrevendo",
    done: "Concluido",
    error: "Erro",
  };

  return labels[status];
}
