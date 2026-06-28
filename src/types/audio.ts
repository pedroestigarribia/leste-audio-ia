export type AudioStatus =
  | "idle"
  | "queued"
  | "uploading"
  | "converting"
  | "transcribing"
  | "done"
  | "error";

export type AudioItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  extension: string;
  status: AudioStatus;
  progress: number;
  transcription?: string;
  summary?: string;
  organizedText?: string;
  error?: string;
};

export type TranscriptionResponse = {
  ok: boolean;
  transcription?: string;
  error?: string;
  meta?: {
    originalFileName: string;
    converted: boolean;
    model: string;
  };
};

export type TextProcessResponse = {
  ok: boolean;
  result?: string;
  error?: string;
  model?: string;
};

export type AnalyzeAllItem = {
  name: string;
  transcription: string;
};

export type AnalyzeAllMode = "analysis" | "tasks" | "keyData" | "reply";
