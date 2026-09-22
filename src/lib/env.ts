import "server-only";

import { z } from "zod";

const DEFAULTS = {
  geminiModel: "gemini-3.7-flash",
  geminiTranscribeModel: "gemini-3.5-transcribe",
  geminiAudioUnderstandingModel: "gemini-3.8-flash",
  geminiTextModel: "gemini-3.8-flash",
  geminiTtsModel: "gemini-3.1-flash-tts-preview",
  geminiTtsAudiobookModel: "gemini-2.5-pro-preview-tts",
  geminiLiveModel: "gemini-3.1-flash-live-preview",
  geminiTtsVoice: "Kore",
  textAiProvider: "gemini" as const,
  deepSeekBaseUrl: "https://api.deepseek.com",
  deepSeekModel: "deepseek-v4-pro",
  maxParallel: 20,
  maxFileSizeMb: 125,
  maxVideoUploadMb: 125,
  maxVideoDurationSec: 7_200,
  maxActiveCutJobs: 2,
  maxAnalysisConcurrency: 1,
  maxRenderConcurrency: 1,
  cutOutputTtlMinutes: 60,
  processTimeoutMs: 900_000,
  ytDlpBin: "yt-dlp",
  tempUploadDir: "./tmp/uploads",
  appName: "Leste Audio IA",
};

const rawEnvSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  GEMINI_TRANSCRIBE_MODEL: z.string().optional(),
  GEMINI_AUDIO_UNDERSTANDING_MODEL: z.string().optional(),
  GEMINI_TEXT_MODEL: z.string().optional(),
  GEMINI_TTS_MODEL: z.string().optional(),
  GEMINI_TTS_AUDIOBOOK_MODEL: z.string().optional(),
  GEMINI_LIVE_MODEL: z.string().optional(),
  GEMINI_TTS_VOICE: z.string().optional(),
  TEXT_AI_PROVIDER: z.enum(["gemini", "deepseek"]).optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().optional(),
  DEEPSEEK_MODEL: z.string().optional(),
  MAX_PARALLEL_TRANSCRIPTIONS: z.string().optional(),
  MAX_FILE_SIZE_MB: z.string().optional(),
  MAX_VIDEO_UPLOAD_MB: z.string().optional(),
  MAX_VIDEO_DURATION_SEC: z.string().optional(),
  MAX_ACTIVE_CUT_JOBS: z.string().optional(),
  MAX_ANALYSIS_CONCURRENCY: z.string().optional(),
  MAX_RENDER_CONCURRENCY: z.string().optional(),
  CUT_OUTPUT_TTL_MINUTES: z.string().optional(),
  PROCESS_TIMEOUT_MS: z.string().optional(),
  YTDLP_BIN: z.string().optional(),
  FFMPEG_BIN: z.string().optional(),
  FFPROBE_BIN: z.string().optional(),
  TEMP_UPLOAD_DIR: z.string().optional(),
  APP_NAME: z.string().optional(),
});

export class MissingApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingApiKeyError";
  }
}

type ParsedEnv = {
  geminiApiKey?: string;
  geminiModel: string;
  geminiTranscribeModel: string;
  geminiAudioUnderstandingModel: string;
  geminiTextModel: string;
  geminiTtsModel: string;
  geminiTtsAudiobookModel: string;
  geminiLiveModel: string;
  geminiTtsVoice: string;
  textAiProvider: "gemini" | "deepseek";
  deepSeekApiKey?: string;
  deepSeekBaseUrl: string;
  deepSeekModel: string;
  maxParallelTranscriptions: number;
  maxFileSizeMb: number;
  maxVideoUploadMb: number;
  maxVideoDurationSec: number;
  maxActiveCutJobs: number;
  maxAnalysisConcurrency: number;
  maxRenderConcurrency: number;
  cutOutputTtlMinutes: number;
  processTimeoutMs: number;
  ytDlpBin: string;
  ffmpegBin?: string;
  ffprobeBin?: string;
  tempUploadDir: string;
  appName: string;
};

let cachedEnv: ParsedEnv | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? "").trim(), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readEnv(): ParsedEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = rawEnvSchema.parse(process.env);

  const nextEnv: ParsedEnv = {
    geminiApiKey: normalizeOptionalString(parsed.GEMINI_API_KEY),
    geminiModel: normalizeOptionalString(parsed.GEMINI_MODEL) ?? DEFAULTS.geminiModel,
    geminiTranscribeModel:
      normalizeOptionalString(parsed.GEMINI_TRANSCRIBE_MODEL) ?? DEFAULTS.geminiTranscribeModel,
    geminiAudioUnderstandingModel:
      normalizeOptionalString(parsed.GEMINI_AUDIO_UNDERSTANDING_MODEL) ??
      DEFAULTS.geminiAudioUnderstandingModel,
    geminiTextModel:
      normalizeOptionalString(parsed.GEMINI_TEXT_MODEL) ?? DEFAULTS.geminiTextModel,
    geminiTtsModel: normalizeOptionalString(parsed.GEMINI_TTS_MODEL) ?? DEFAULTS.geminiTtsModel,
    geminiTtsAudiobookModel:
      normalizeOptionalString(parsed.GEMINI_TTS_AUDIOBOOK_MODEL) ?? DEFAULTS.geminiTtsAudiobookModel,
    geminiLiveModel: normalizeOptionalString(parsed.GEMINI_LIVE_MODEL) ?? DEFAULTS.geminiLiveModel,
    geminiTtsVoice: normalizeOptionalString(parsed.GEMINI_TTS_VOICE) ?? DEFAULTS.geminiTtsVoice,
    textAiProvider: parsed.TEXT_AI_PROVIDER ?? DEFAULTS.textAiProvider,
    deepSeekApiKey: normalizeOptionalString(parsed.DEEPSEEK_API_KEY),
    deepSeekBaseUrl:
      normalizeOptionalString(parsed.DEEPSEEK_BASE_URL) ?? DEFAULTS.deepSeekBaseUrl,
    deepSeekModel: normalizeOptionalString(parsed.DEEPSEEK_MODEL) ?? DEFAULTS.deepSeekModel,
    maxParallelTranscriptions: parsePositiveInt(
      parsed.MAX_PARALLEL_TRANSCRIPTIONS,
      DEFAULTS.maxParallel,
    ),
    maxFileSizeMb: parsePositiveInt(parsed.MAX_FILE_SIZE_MB, DEFAULTS.maxFileSizeMb),
    maxVideoUploadMb: parsePositiveInt(parsed.MAX_VIDEO_UPLOAD_MB, DEFAULTS.maxVideoUploadMb),
    maxVideoDurationSec: parsePositiveInt(parsed.MAX_VIDEO_DURATION_SEC, DEFAULTS.maxVideoDurationSec),
    maxActiveCutJobs: parsePositiveInt(parsed.MAX_ACTIVE_CUT_JOBS, DEFAULTS.maxActiveCutJobs),
    maxAnalysisConcurrency: parsePositiveInt(parsed.MAX_ANALYSIS_CONCURRENCY, DEFAULTS.maxAnalysisConcurrency),
    maxRenderConcurrency: parsePositiveInt(parsed.MAX_RENDER_CONCURRENCY, DEFAULTS.maxRenderConcurrency),
    cutOutputTtlMinutes: parsePositiveInt(parsed.CUT_OUTPUT_TTL_MINUTES, DEFAULTS.cutOutputTtlMinutes),
    processTimeoutMs: parsePositiveInt(parsed.PROCESS_TIMEOUT_MS, DEFAULTS.processTimeoutMs),
    ytDlpBin: normalizeOptionalString(parsed.YTDLP_BIN) ?? DEFAULTS.ytDlpBin,
    ffmpegBin: normalizeOptionalString(parsed.FFMPEG_BIN),
    ffprobeBin: normalizeOptionalString(parsed.FFPROBE_BIN),
    tempUploadDir: normalizeOptionalString(parsed.TEMP_UPLOAD_DIR) ?? DEFAULTS.tempUploadDir,
    appName: normalizeOptionalString(parsed.APP_NAME) ?? DEFAULTS.appName,
  };

  cachedEnv = nextEnv;

  return nextEnv;
}

export function getServerEnv(): ParsedEnv {
  return readEnv();
}

export function getAppConfig() {
  const env = readEnv();

  return {
    appName: env.appName,
    geminiModel: env.geminiModel,
    geminiTranscribeModel: env.geminiTranscribeModel,
    geminiAudioUnderstandingModel: env.geminiAudioUnderstandingModel,
    textModel: env.geminiTextModel,
    geminiTtsModel: env.geminiTtsModel,
    geminiTtsAudiobookModel: env.geminiTtsAudiobookModel,
    geminiLiveModel: env.geminiLiveModel,
    textAiProvider: env.textAiProvider,
    deepSeekModel: env.deepSeekModel,
    maxParallelTranscriptions: env.maxParallelTranscriptions,
    maxFileSizeMb: env.maxFileSizeMb,
    maxVideoUploadMb: env.maxVideoUploadMb,
    maxVideoDurationSec: env.maxVideoDurationSec,
    maxActiveCutJobs: env.maxActiveCutJobs,
    maxAnalysisConcurrency: env.maxAnalysisConcurrency,
    maxRenderConcurrency: env.maxRenderConcurrency,
    cutOutputTtlMinutes: env.cutOutputTtlMinutes,
    processTimeoutMs: env.processTimeoutMs,
    ytDlpBin: env.ytDlpBin,
  };
}

export function getMaxFileSizeBytes() {
  return readEnv().maxFileSizeMb * 1024 * 1024;
}

export function getGeminiMissingKeyMessage() {
  return "Configure a chave da API no arquivo .env.local";
}

export function getDeepSeekMissingKeyMessage() {
  return "Configure a chave da API no arquivo .env.local";
}

export function requireGeminiApiKey() {
  const key = readEnv().geminiApiKey;

  if (!key) {
    throw new MissingApiKeyError(getGeminiMissingKeyMessage());
  }

  return key;
}

export function requireDeepSeekApiKey() {
  const key = readEnv().deepSeekApiKey;

  if (!key) {
    throw new MissingApiKeyError(getDeepSeekMissingKeyMessage());
  }

  return key;
}
