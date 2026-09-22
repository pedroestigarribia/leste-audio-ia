import { cancelVideoJob, getStoredJob, toPublicJob } from "@/lib/video/job-store";
import { assertSafeJobId } from "@/lib/video/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { jobId: string } };

export async function POST(_request: Request, context: RouteContext) {
  try {
    assertSafeJobId(context.params.jobId);
    const current = await getStoredJob(context.params.jobId);
    if (!current) return Response.json({ ok: false, error: "Job de vídeo não encontrado." }, { status: 404 });
    const job = await cancelVideoJob(context.params.jobId);
    return Response.json({ ok: true, job: job ? toPublicJob(job) : undefined });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível cancelar." }, { status: 400 });
  }
}
