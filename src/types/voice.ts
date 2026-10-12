export const VOICE_MODES = [
  "auto", "transcription", "clean", "interpretation", "prompt", "dev",
  "codex", "claude", "chatgpt", "document", "whatsapp", "creative",
] as const;

export type VoiceMode = (typeof VOICE_MODES)[number];

export type VoiceSemanticState = {
  intent: string;
  domain: string;
  artifact: string;
  requirements: string[];
  exclusions: string[];
  technologies: string[];
  corrections: string[];
  openQuestions: string[];
  normalizedText: string;
  interpretation: string;
  output: string;
};

export const EMPTY_VOICE_STATE: VoiceSemanticState = {
  intent: "", domain: "", artifact: "", requirements: [], exclusions: [],
  technologies: [], corrections: [], openQuestions: [], normalizedText: "",
  interpretation: "", output: "",
};
