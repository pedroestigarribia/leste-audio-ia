export type YoutubeSegment = {
  startTime: number;
  endTime: number;
  participant: string;
  text: string;
  tone: string;
  confidence: number;
};

export type YoutubeParticipant = {
  id: string;
  label: string;
  name?: string;
  segmentsCount: number;
  totalTime: number;
  evidence?: string;
};

export type YoutubeGeminiResult = {
  language: string;
  segments: YoutubeSegment[];
  participants: YoutubeParticipant[];
  sceneNotes: string;
  toneChanges: string;
};

export type YoutubeDeepSeekResult = {
  revisedTranscription: string;
  summary: string;
  interpretation: string;
  topics: string;
  keyPhrases: string;
  styleAnalysis: string;
  communicationProfile: string;
  generatedContent: string;
};

export type YoutubeVideoInfo = {
  videoId: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
};

export type YoutubeAnalysisState = {
  video: YoutubeVideoInfo;
  cutStart: number | null;
  cutEnd: number | null;
  gemini: YoutubeGeminiResult;
  deepseek: YoutubeDeepSeekResult;
  processedAt: string;
};

export type YoutubeProgressEvent =
  | { step: "validate"; status: "done"; message: string }
  | { step: "info"; status: "done"; video: YoutubeVideoInfo }
  | { step: "download"; status: "in_progress"; message: string; progress: number }
  | { step: "download"; status: "done"; message: string }
  | { step: "gemini"; status: "in_progress"; message: string }
  | { step: "gemini"; status: "done"; message: string }
  | { step: "deepseek"; status: "in_progress"; message: string }
  | { step: "deepseek"; status: "done"; message: string }
  | { step: "complete"; status: "done"; result: YoutubeAnalysisState }
  | { step: "error"; status: "done"; message: string };
