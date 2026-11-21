import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { cleanupExpiredVideoJobs, countActiveVideoJobs, createVideoJob, deleteVideoJob, toPublicJob, updateVideoJob } from "@/lib/video/job-store";
import { normalizeClipPreferences } from "@/lib/video/preferences";
import { InvalidVideoSourceUrlError, validatePublicVideoUrl } from "@/lib/video/source-url";
import { saveVideoUploadFromMultipart } from "@/lib/video/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const youtubeBodySchema = z.object({
  sourceType: z.literal("youtube"),
  url: z.string().trim().min(1, "Envie um link do YouTube.").max(2048),
  preferences: z.unknown().optional(),
});

function errorResponse(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

function getYoutubeReference(value: string) {
  const source = validatePublicVideoUrl(value);
  if (source.platform !== "youtube") {
    throw new InvalidVideoSourceUrlError("Use um link público do YouTube.");
  }
  return source.url;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = youtubeBodySchema.parse(await request.json());
      const sourceUrl = getYoutubeReference(body.url);
      await cleanupExpiredVideoJobs();
      if (await countActiveVideoJobs() >= getServerEnv().maxActiveCutJobs) {
        return errorResponse("O limite de processamentos simultâneos foi atingido. Aguarde um job terminar.", 429);
      }
      const job = await createVideoJob({
        sourceType: "youtube",
        sourceName: "Vídeo do YouTube",
        sourceUrl,
        preferences: normalizeClipPreferences(body.preferences ?? {}),
      });
      return Response.json({ ok: true, jobId: job.jobId, job: toPublicJob(job) }, { status: 201 });
    }

    if (!contentType.includes("multipart/form-data")) {
      return errorResponse("Envie um arquivo de vídeo em multipart/form-data.");
    }

    const env = getServerEnv();
    await cleanupExpiredVideoJobs();
    if (await countActiveVideoJobs() >= env.maxActiveCutJobs) {
      return errorResponse("O limite de processamentos simultâneos foi atingido. Aguarde um job terminar.", 429);
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    const maxBytes = env.maxVideoUploadMb * 1024 * 1024;
    if (contentLength > maxBytes) {
      return errorResponse(`O arquivo excede o limite de ${env.maxVideoUploadMb} MB.`);
    }

    const job = await createVideoJob({ sourceType: "upload", sourceName: "video.mp4", preferences: normalizeClipPreferences({}) });
    try {
      const saved = await saveVideoUploadFromMultipart(request, job.jobId, maxBytes);
      let preferences = normalizeClipPreferences({});
      if (saved.preferences) preferences = normalizeClipPreferences(JSON.parse(saved.preferences) as unknown);
      const sourceUrl = saved.sourceUrl ? getYoutubeReference(saved.sourceUrl) : undefined;
      const savedJob = await updateVideoJob(job.jobId, {
        sourcePath: saved.sourcePath,
        sourceName: saved.originalName,
        sourceUrl,
        preferences,
      });
      return Response.json({ ok: true, jobId: savedJob.jobId, job: toPublicJob(savedJob) }, { status: 201 });
    } catch (error) {
      await deleteVideoJob(job.jobId);
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0]?.message || "Dados inválidos.");
    }
    if (error instanceof InvalidVideoSourceUrlError) return errorResponse(error.message);
    return errorResponse(error instanceof Error ? error.message : "Não foi possível criar o processamento.", 500);
  }
}
