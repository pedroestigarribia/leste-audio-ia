import { z } from "zod";

import { enqueueVideoJob, getStoredJob, toPublicJob, updateVideoJob } from "@/lib/video/job-store";
import { assertSafeJobId } from "@/lib/video/paths";
import { renderSelectedVideoClips } from "@/lib/video/render-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clips: z.array(z.object({
    candidateId: z.string().min(1).max(80),
    startTime: z.number().nonnegative().optional(),
    endTime: z.number().nonnegative().optional(),
  })).min(1).max(20),
  options: z.object({
    aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
    captionPreset: z.enum(["none", "simple", "dynamic"]).default("simple"),
    reframeMode: z.enum(["center", "face", "speaker", "subject", "screen"]).default("center"),
  }).default({}),
});

type RouteContext = { params: { jobId: string } };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeJobId(context.params.jobId);
    const current = await getStoredJob(context.params.jobId);
    if (!current) return Response.json({ ok: false, error: "Job de vídeo não encontrado." }, { status: 404 });
    if (["validating", "acquiring", "probing", "extracting_audio", "transcribing", "analyzing_scenes", "analyzing_semantics", "generating_candidates", "ranking_candidates", "rendering"].includes(current.stage)) {
      return Response.json({ ok: true, job: toPublicJob(current), started: false });
    }

    const parsed = bodySchema.parse(await request.json());
    const prepared = await updateVideoJob(context.params.jobId, {
      stage: "rendering",
      progress: 1,
      message: "Renderização iniciada.",
      error: undefined,
    });
    void enqueueVideoJob(context.params.jobId, async (signal) => {
      await renderSelectedVideoClips(context.params.jobId, parsed.clips, parsed.options, signal);
    });
    return Response.json({ ok: true, job: toPublicJob(prepared), started: true }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ ok: false, error: error.issues[0]?.message || "Dados de renderização inválidos." }, { status: 400 });
    }
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível gerar os cortes." }, { status: 500 });
  }
}
