import { z } from "zod";

import { enqueueVideoJob, getStoredJob, toPublicJob, updateVideoJob } from "@/lib/video/job-store";
import { processVideoJob } from "@/lib/video/pipeline";
import { assertSafeJobId } from "@/lib/video/paths";
import { normalizeClipPreferences } from "@/lib/video/preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ preferences: z.unknown().optional() }).default({});

type RouteContext = { params: { jobId: string } };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeJobId(context.params.jobId);
    const current = await getStoredJob(context.params.jobId);
    if (!current) return Response.json({ ok: false, error: "Job de vídeo não encontrado." }, { status: 404 });
    if (["validating", "acquiring", "probing", "extracting_audio", "transcribing", "analyzing_scenes", "analyzing_semantics", "generating_candidates", "ranking_candidates", "rendering"].includes(current.stage)) {
      return Response.json({ ok: true, jobId: current.jobId, job: toPublicJob(current), started: false });
    }

    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const preferences = normalizeClipPreferences(body.preferences ?? current.preferences ?? {});
    const prepared = await updateVideoJob(context.params.jobId, {
      preferences,
      stage: "validating",
      progress: 1,
      message: "Processamento iniciado.",
      error: undefined,
    });
    void enqueueVideoJob(context.params.jobId, (signal) => processVideoJob(context.params.jobId, signal));
    return Response.json({ ok: true, jobId: prepared.jobId, job: toPublicJob(prepared), started: true }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ ok: false, error: error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    }
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível iniciar a análise." }, { status: 500 });
  }
}
