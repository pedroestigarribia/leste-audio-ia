import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { cleanupExpiredVideoJobs, countActiveVideoJobs, createVideoJob, deleteVideoJob, toPublicJob, updateVideoJob } from "@/lib/video/job-store";
import { normalizeClipPreferences } from "@/lib/video/preferences";
import { saveVideoUploadFromMultipart } from "@/lib/video/upload";
import { validateYoutubeUrl } from "@/lib/video/youtube-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const youtubeBodySchema = z.object({
  sourceType: z.literal("youtube"),
  url: z.string().trim().min(1, "Envie um link do YouTube."),
  preferences: z.unknown().optional(),
});

function errorResponse(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    await cleanupExpiredVideoJobs();
    const activeJobs = await countActiveVideoJobs();
    if (activeJobs >= getServerEnv().maxActiveCutJobs) {
      return errorResponse("O limite de processamentos simultâneos foi atingido. Aguarde um job terminar.", 429);
    }

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = youtubeBodySchema.parse(await request.json());
      const { url } = validateYoutubeUrl(body.url);
      const preferences = normalizeClipPreferences(body.preferences ?? {});
      const job = await createVideoJob({
        sourceType: "youtube",
        sourceName: url,
        sourceUrl: url,
        preferences,
      });
      return Response.json({ ok: true, jobId: job.jobId, job: toPublicJob(job) }, { status: 201 });
    }

    if (!contentType.includes("multipart/form-data")) {
      return errorResponse("Envie um arquivo de vídeo em multipart/form-data ou um link do YouTube em JSON.");
    }

    const env = getServerEnv();
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
      const savedJob = await updateVideoJob(job.jobId, { sourcePath: saved.sourcePath, sourceName: saved.originalName, preferences });
      return Response.json({ ok: true, jobId: savedJob.jobId, job: toPublicJob(savedJob) }, { status: 201 });
    } catch (error) {
      await deleteVideoJob(job.jobId);
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0]?.message || "Dados inválidos.");
    }
    return errorResponse(error instanceof Error ? error.message : "Não foi possível criar o processamento.", 500);
  }
}
