import { z } from "zod";

import { enqueueVideoJob, getStoredJob, toPublicJob, updateVideoJob } from "@/lib/video/job-store";
import { assertSafeJobId } from "@/lib/video/paths";
import { renderSelectedVideoClips } from "@/lib/video/render-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clipSchema = z.object({
  candidateId: z.string().min(1).max(80),
  startTime: z.number().nonnegative().optional(),
  endTime: z.number().nonnegative().optional(),
  title: z.string().trim().max(120).optional(),
});

const optionsSchema = z.object({
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  captionPreset: z.enum(["none", "simple", "dynamic"]).default("simple"),
  reframeMode: z.enum(["center", "face", "speaker", "subject", "screen"]).default("center"),
});

const bodySchema = z.union([
  z.object({ resume: z.literal(true) }),
  z.object({
    clips: z.array(clipSchema).min(1).max(20),
    options: optionsSchema.default({}),
  }),
]);

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    assertSafeJobId(jobId);
    const current = await getStoredJob(jobId);
    if (!current) return Response.json({ ok: false, error: "Job de vídeo não encontrado." }, { status: 404 });
    if (["validating", "acquiring", "probing", "extracting_audio", "transcribing", "analyzing_scenes", "analyzing_semantics", "generating_candidates", "ranking_candidates", "rendering"].includes(current.stage)) {
      return Response.json({ ok: true, job: toPublicJob(current), started: false });
    }

    const parsed = bodySchema.parse(await request.json());
    let clips: Array<z.infer<typeof clipSchema>>;
    let options: z.infer<typeof optionsSchema>;
    if ("resume" in parsed) {
      if (current.pendingAction !== "render" || !current.pendingRender) {
        return Response.json({ ok: false, error: "Não há uma renderização interrompida para retomar." }, { status: 409 });
      }
      clips = current.pendingRender.clips;
      options = current.pendingRender.options;
    } else {
      clips = parsed.clips;
      options = parsed.options;
    }
    const prepared = await updateVideoJob(jobId, {
      stage: "rendering",
      progress: 1,
      message: "Renderização iniciada. Cortes já concluídos serão preservados.",
      error: undefined,
      pendingAction: "render",
      pendingRender: { clips, options },
    });
    void enqueueVideoJob(jobId, async (signal) => {
      await renderSelectedVideoClips(jobId, clips, options, signal);
    });
    return Response.json({ ok: true, job: toPublicJob(prepared), started: true }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ ok: false, error: error.issues[0]?.message || "Dados de renderização inválidos." }, { status: 400 });
    }
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível gerar os cortes." }, { status: 500 });
  }
}
