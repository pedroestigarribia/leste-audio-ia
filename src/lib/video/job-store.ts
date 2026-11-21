import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { getServerEnv } from "@/lib/env";
import { createJobId, ensureJobDir, fileExists, getCutsRoot, getJobDir, safeDeletePath } from "@/lib/video/paths";
import type { ClipPreferences, RenderOptions, VideoJobState, VideoSourceType } from "@/types/video";

type StoredJob = VideoJobState & {
  sourcePath?: string;
  audioPath?: string;
  transcriptPath?: string;
  pendingAction?: "analyze" | "render";
  pendingRender?: {
    clips: Array<{ candidateId: string; startTime?: number; endTime?: number; title?: string }>;
    options: RenderOptions;
  };
};

const ACTIVE_STAGES = new Set<StoredJob["stage"]>([
  "created", "validating", "acquiring", "probing", "extracting_audio", "transcribing",
  "analyzing_scenes", "analyzing_semantics", "generating_candidates", "ranking_candidates", "rendering",
]);

export const YOUTUBE_CUT_UPLOAD_REQUIRED = "Para gerar cortes, envie o arquivo MP4 original ou autorizado. O link do YouTube fica apenas como referência.";

export function requiresYoutubeUpload(job: Pick<StoredJob, "sourceType" | "sourcePath">) {
  return job.sourceType === "youtube" && !job.sourcePath;
}

export function getStaleJobAction(
  stage: StoredJob["stage"],
  pendingAction: StoredJob["pendingAction"],
  hasSource: boolean,
) {
  return pendingAction ?? (stage !== "rendering" && hasSource ? "analyze" : undefined);
}

type JobRuntime = {
  running: Map<string, Promise<void>>;
  controllers: Map<string, AbortController>;
};

declare global {
  // eslint-disable-next-line no-var
  var lesteVideoJobRuntime: JobRuntime | undefined;
}

function getRuntime(): JobRuntime {
  globalThis.lesteVideoJobRuntime ??= {
    running: new Map(),
    controllers: new Map(),
  };
  return globalThis.lesteVideoJobRuntime;
}

function getStatePath(jobId: string) {
  return path.join(getJobDir(jobId), "state.json");
}

async function saveJob(job: StoredJob) {
  await ensureJobDir(job.jobId);
  await fs.writeFile(getStatePath(job.jobId), JSON.stringify(job, null, 2), "utf8");
}

export async function getStoredJob(jobId: string): Promise<StoredJob | null> {
  try {
    const raw = await fs.readFile(getStatePath(jobId), "utf8");
    return JSON.parse(raw) as StoredJob;
  } catch {
    return null;
  }
}

export function toPublicJob(job: StoredJob) {
  const outputs = job.outputs.map((output) => {
    const { filePath: _filePath, srtPath: _srtPath, renderKey: _renderKey, ...publicOutput } = output;
    return publicOutput;
  });

  const {
    sourcePath: _sourcePath,
    audioPath: _audioPath,
    transcriptPath: _transcriptPath,
    pendingAction: _pendingAction,
    pendingRender: _pendingRender,
    ...publicJob
  } = job;
  if (requiresYoutubeUpload(job)) {
    return {
      ...publicJob,
      outputs,
      stage: job.stage === "cancelled" ? job.stage : "failed" as const,
      message: job.stage === "cancelled" ? job.message : "Arquivo original necessário.",
      error: job.stage === "cancelled" ? undefined : YOUTUBE_CUT_UPLOAD_REQUIRED,
      recoverableAction: undefined,
    };
  }
  return {
    ...publicJob,
    outputs,
    recoverableAction: job.stage === "failed" ? job.pendingAction : undefined,
  };
}

export async function createVideoJob(params: {
  sourceType: VideoSourceType;
  sourceName: string;
  sourceUrl?: string;
  sourcePath?: string;
  preferences?: ClipPreferences;
}) {
  const jobId = createJobId();
  const now = new Date().toISOString();
  const job: StoredJob = {
    jobId,
    stage: "created",
    progress: 0,
    message: "Job criado.",
    startedAt: now,
    updatedAt: now,
    sourceType: params.sourceType,
    sourceName: params.sourceName,
    sourceUrl: params.sourceUrl,
    sourcePath: params.sourcePath,
    preferences: params.preferences,
    candidates: [],
    outputs: [],
  };
  await saveJob(job);
  return job;
}

export async function updateVideoJob(jobId: string, patch: Partial<StoredJob>) {
  const current = await getStoredJob(jobId);
  if (!current) {
    throw new Error("Job de vídeo não encontrado.");
  }

  const next: StoredJob = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await saveJob(next);
  return next;
}

export async function setJobProgress(jobId: string, stage: StoredJob["stage"], progress: number, message: string) {
  return updateVideoJob(jobId, {
    stage,
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    message,
    error: undefined,
  });
}

export async function countActiveVideoJobs() {
  const runtimeCount = getRuntime().running.size;

  try {
    const entries = await fs.readdir(getCutsRoot(), { withFileTypes: true });
    let diskCount = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const job = await getStoredJob(entry.name);
      if (job && ACTIVE_STAGES.has(job.stage) && !requiresYoutubeUpload(job)) {
        diskCount += 1;
      }
    }

    return Math.max(runtimeCount, diskCount);
  } catch {
    return runtimeCount;
  }
}

export async function cleanupExpiredVideoJobs() {
  try {
    const entries = await fs.readdir(getCutsRoot(), { withFileTypes: true });
    const env = getServerEnv();
    const expiration = env.cutOutputTtlMinutes * 60_000;
    const runtime = getRuntime();
    await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      const job = await getStoredJob(entry.name);
      if (!job || runtime.running.has(job.jobId)) return;
      const idleMs = Date.now() - new Date(job.updatedAt).getTime();
      if (idleMs > expiration) {
        await safeDeletePath(getJobDir(entry.name));
        return;
      }
      if (ACTIVE_STAGES.has(job.stage) && !requiresYoutubeUpload(job) && idleMs > env.processTimeoutMs) {
        await updateVideoJob(job.jobId, {
          stage: "failed",
          message: "O processamento foi interrompido e pode ser retomado.",
          error: "A execução anterior parou antes de concluir. Retome para continuar; resultados de cortes já concluídos serão preservados.",
          pendingAction: getStaleJobAction(job.stage, job.pendingAction, Boolean(job.sourcePath)),
        });
      }
    }));
  } catch {
    // Cleanup is opportunistic and must never block a new request.
  }
}

export async function enqueueVideoJob(jobId: string, task: (signal: AbortSignal) => Promise<void>) {
  const runtime = getRuntime();
  if (runtime.running.has(jobId)) {
    return runtime.running.get(jobId);
  }

  const controller = new AbortController();
  runtime.controllers.set(jobId, controller);
  const promise = task(controller.signal)
    .catch(async (error) => {
      if (controller.signal.aborted) {
        await updateVideoJob(jobId, {
          stage: "cancelled",
          progress: 0,
          message: "Processamento cancelado.",
          error: undefined,
          pendingAction: undefined,
          pendingRender: undefined,
        }).catch(() => undefined);
        return;
      }

      const message = error instanceof Error ? error.message : "Falha no processamento do vídeo.";
      await updateVideoJob(jobId, {
        stage: "failed",
        progress: 0,
        message: "O processamento falhou.",
        error: message.slice(0, 600),
      }).catch(() => undefined);
    })
    .finally(() => {
      runtime.running.delete(jobId);
      runtime.controllers.delete(jobId);
    });

  runtime.running.set(jobId, promise);
  return promise;
}

export async function cancelVideoJob(jobId: string) {
  const runtime = getRuntime();
  runtime.controllers.get(jobId)?.abort();
  const job = await getStoredJob(jobId);
  if (!job) return null;

  await fs.writeFile(path.join(getJobDir(jobId), "cancel.flag"), "cancelled", "utf8").catch(() => undefined);
  return updateVideoJob(jobId, {
    stage: "cancelled",
    progress: job.progress,
    message: "Cancelamento solicitado.",
  });
}

export async function isJobCancelled(jobId: string, signal?: AbortSignal) {
  if (signal?.aborted) return true;
  return fileExists(path.join(getJobDir(jobId), "cancel.flag"));
}

export async function deleteVideoJob(jobId: string) {
  const runtime = getRuntime();
  runtime.controllers.get(jobId)?.abort();
  runtime.running.delete(jobId);
  runtime.controllers.delete(jobId);
  await safeDeletePath(getJobDir(jobId));
}

export function getJobOutputTtlDate() {
  return new Date(Date.now() + getServerEnv().cutOutputTtlMinutes * 60_000);
}

export type InternalVideoJob = StoredJob;
