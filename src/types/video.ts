export type VideoSourceType = "upload" | "youtube";

export type VideoMetadata = {
  sourceType: VideoSourceType;
  title: string;
  channel?: string;
  thumbnail?: string;
  durationSec: number;
  width: number;
  height: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  sampleRate?: number;
  fileSize?: number;
};

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  speakerId?: string;
};

export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  speakerId?: string;
  confidence?: number;
  words: TranscriptWord[];
};

export type Participant = {
  id: string;
  label: string;
  confidence?: number;
  speakingTime?: number;
};

export type SemanticSegment = {
  id: string;
  start: number;
  end: number;
  transcript: string;
  speakers: string[];
  topic: string;
  subtopics: string[];
  sceneIds: string[];
  sentiment?: string;
  emotion?: string;
  hasQuestion: boolean;
  hasAnswer: boolean;
  hasCTA: boolean;
  hasStory: boolean;
  hasInsight: boolean;
  hasStrongStatement: boolean;
  semanticStartConfidence: number;
  semanticEndConfidence: number;
};

export type RetentionBreakdown = {
  hook: number;
  narrativeFlow: number;
  standaloneClarity: number;
  practicalValue: number;
  emotionalStrength: number;
  memorableStatement: number;
  endingQuality: number;
  transcriptQuality: number;
};

export type ClipCandidate = {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  hook: string;
  summary: string;
  category: string;
  topic: string;
  retentionScore: number;
  retentionBreakdown: RetentionBreakdown;
  reason: string;
  suggestedCaption: string;
  suggestedCopy: string;
  hashtags: string[];
  participants: string[];
  transcriptExcerpt: string;
  sceneIds: string[];
  hasCTA: boolean;
  hasQuestion: boolean;
  hasStory: boolean;
  hasInsight: boolean;
  warnings: string[];
  confidence: number;
};

export type ClipPreferences = {
  mode: "discover" | "find";
  query?: string;
  genre: string;
  durationPreset: "30" | "30-60" | "60-90" | "90-180" | "custom";
  minDurationSec?: number;
  maxDurationSec?: number;
  desiredCount?: number;
};

export type AspectRatio = "9:16" | "1:1" | "16:9";
export type CaptionPreset = "none" | "simple" | "dynamic";
export type ReframeMode = "center" | "face" | "speaker" | "subject" | "screen";

export type RenderOptions = {
  aspectRatio: AspectRatio;
  captionPreset: CaptionPreset;
  reframeMode: ReframeMode;
};

export type RenderedClip = {
  id: string;
  candidateId: string;
  title: string;
  fileName: string;
  srtFileName?: string;
  filePath: string;
  srtPath?: string;
  downloadUrl: string;
  srtDownloadUrl?: string;
  createdAt: string;
  expiresAt: string;
};

export type JobStage =
  | "created"
  | "validating"
  | "acquiring"
  | "probing"
  | "extracting_audio"
  | "transcribing"
  | "analyzing_scenes"
  | "analyzing_semantics"
  | "generating_candidates"
  | "ranking_candidates"
  | "ready_for_review"
  | "rendering"
  | "completed"
  | "cancelled"
  | "failed";

export type JobProgress = {
  jobId: string;
  stage: JobStage;
  progress: number;
  message: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
};

export type VideoJobState = JobProgress & {
  sourceType: VideoSourceType;
  sourceName: string;
  sourceUrl?: string;
  metadata?: VideoMetadata;
  preferences?: ClipPreferences;
  transcript?: {
    language: string;
    segments: TranscriptSegment[];
    participants: Participant[];
  };
  semanticSegments?: SemanticSegment[];
  candidates: ClipCandidate[];
  outputs: RenderedClip[];
};
