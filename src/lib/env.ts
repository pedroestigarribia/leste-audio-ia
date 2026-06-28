import "server-only";

import { z } from "zod";

const DEFAULTS = {
  geminiModel: "gemini-3.5-flash",
  deepSeekBaseUrl: "https://api.deepseek.com",
  deepSeekModel: "deepseek-v4-pro",
  maxParallel: 3,
  maxFileSizeMb: 25,
  tempUploadDir: "./tmp/uploads",
  appName: "Leste Audio IA",
};

const rawEnvSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().optional(),
  DEEPSEEK_MODEL: z.string().optional(),
  MAX_PARALLEL_TRANSCRIPTIONS: z.string().optional(),
  MAX_FILE_SIZE_MB: z.string().optional(),
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
  deepSeekApiKey?: string;
  deepSeekBaseUrl: string;
  deepSeekModel: string;
  maxParallelTranscriptions: number;
  maxFileSizeMb: number;
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

  cachedEnv = {
    geminiApiKey: normalizeOptionalString(parsed.GEMINI_API_KEY),
    geminiModel: normalizeOptionalString(parsed.GEMINI_MODEL) ?? DEFAULTS.geminiModel,
    deepSeekApiKey: normalizeOptionalString(parsed.DEEPSEEK_API_KEY),
    deepSeekBaseUrl:
      normalizeOptionalString(parsed.DEEPSEEK_BASE_URL) ?? DEFAULTS.deepSeekBaseUrl,
    deepSeekModel: normalizeOptionalString(parsed.DEEPSEEK_MODEL) ?? DEFAULTS.deepSeekModel,
    maxParallelTranscriptions: parsePositiveInt(
      parsed.MAX_PARALLEL_TRANSCRIPTIONS,
      DEFAULTS.maxParallel,
    ),
    maxFileSizeMb: parsePositiveInt(parsed.MAX_FILE_SIZE_MB, DEFAULTS.maxFileSizeMb),
    tempUploadDir: normalizeOptionalString(parsed.TEMP_UPLOAD_DIR) ?? DEFAULTS.tempUploadDir,
    appName: normalizeOptionalString(parsed.APP_NAME) ?? DEFAULTS.appName,
  };

  return cachedEnv;
}

export function getServerEnv(): ParsedEnv {
  return readEnv();
}

export function getAppConfig() {
  const env = readEnv();

  return {
    appName: env.appName,
    geminiModel: env.geminiModel,
    deepSeekModel: env.deepSeekModel,
    maxParallelTranscriptions: env.maxParallelTranscriptions,
    maxFileSizeMb: env.maxFileSizeMb,
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
