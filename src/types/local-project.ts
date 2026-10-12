import type {
  AudioContentKind,
  AudioIntelligenceResult,
  AudioSpeaker,
  AutoDetectedIntent,
  ContinuityPlan,
  ContentSource,
  SessionNarrativeFormat,
  TranscriptSegment,
} from "@/types/audio";
import type { AudiobookChapter, PdfAudiobook } from "@/lib/audiobook";

export type PdfResultKey = "analysis" | "summary" | "interpretation" | "organized" | "grammar" | "clean";

export type SavedAudioItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  status: "done" | "error";
  progress: number;
  includeInAnalysis?: boolean;
  isDuplicate?: boolean;
  transcription?: string;
  segments?: TranscriptSegment[];
  speakers?: AudioSpeaker[];
  segmentWarning?: string;
  summary?: string;
  organizedText?: string;
  autoDetectedIntent?: AutoDetectedIntent;
  audioIntelligence?: AudioIntelligenceResult;
  generatedContents?: Partial<Record<AudioContentKind, string>>;
  error?: string;
};

export type EditorialMemory = {
  people: string;
  relationships: string;
  timeline: string;
  events: string;
  reportedFacts: string;
  confirmedFacts: string;
  inferences: string;
  voiceAndTone: string;
  openQuestions: string;
  characteristicQuotes?: string;
  conflicts?: string;
  milestones?: string;
  factOwnership?: string;
};

export type ChapterWorkflowStatus = "planned" | "draft" | "review" | "approved";

export type EditorialChapter = {
  title: string;
  text: string;
  narrationText?: string;
  narrationSourceFingerprint?: string;
  status: ChapterWorkflowStatus;
  sourceIds: string[];
  revisions: Array<{ text: string; savedAt: string; reason?: string }>;
};

export type MeetingActionStatus = "open" | "in-progress" | "done";
export type MeetingActionKind = "agreed" | "proposed" | "suggested";

export type MeetingAction = {
  id: string;
  title: string;
  owner: string;
  deadline: string;
  kind: MeetingActionKind;
  status: MeetingActionStatus;
  evidence: string;
  sourceName: string;
};

export type EditorialWorkflowSnapshot = {
  mode: "women-biography" | "full-biography" | "meeting";
  title: string;
  subject: string;
  chapterCount: number;
  narrator: "subject-first-person" | "ghostwriter-third-person";
  editorialNotes: string;
  collectionGuide: string;
  womenMethod10?: boolean;
  outlineApproved?: boolean;
  outlineApprovedFingerprint?: string;
  sourceSelection?: Record<string, boolean>;
  sourceRoles?: Record<string, "original" | "editor" | "derived">;
  projectSuggestion?: { type: "women-biography" | "full-biography" | "meeting" | "other"; reason: string; confidence: "low" | "medium" | "high"; sourceFingerprint?: string } | null;
  continuityNotes: string;
  memory: EditorialMemory;
  chapterNumber: number;
  chapterTitle: string;
  outline: string;
  chapters: Record<string, EditorialChapter>;
  followUpQuestions: string;
  meetingReport: string;
  meetingActions: MeetingAction[];
  qualityReport: string;
  narrationMode: "faithful" | "natural" | "adapted";
  pronunciationNotes: string;
  chapterSelection: Record<string, boolean>;
  sources: Array<{
    id?: string;
    name: string;
    transcription: string;
    interviewQuestion?: string;
    chapterNumber?: number | null;
  }>;
  sourceGuides: Record<string, { question: string; chapterNumber: string }>;
  outlineSourceFingerprint: string;
  chapterSourceFingerprints: Record<string, string>;
  meetingSourceFingerprint: string;
};

export type LocalProjectSnapshot = {
  version: 1;
  savedAudioItems: SavedAudioItem[];
  generalResults: Record<string, string>;
  promptResult: string;
  pdf: null | { fileName: string; fileSize: number; text: string; results: Record<PdfResultKey, string> };
  pdfAudiobook: null | {
    source: PdfAudiobook["source"];
    mode: PdfAudiobook["mode"];
    chapters: Array<Omit<AudiobookChapter, "status">>;
  };
  freeTextValue: string;
  imageText: null | { fileName: string; fileSize: number; text: string };
  sources: ContentSource[];
  contextText: string;
  lastActionResult: string | null;
  lastActionMode: string | null;
  continuityPlan: ContinuityPlan | null;
  sessionTranscriptOrder: "original" | "context";
  sessionNarrative: string;
  sessionNarrativeStale: boolean;
  sessionNarrativeFormat: SessionNarrativeFormat;
  docxSelection: Record<string, boolean>;
  editorial: EditorialWorkflowSnapshot | null;
};

export type LocalProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: LocalProjectSnapshot;
};
