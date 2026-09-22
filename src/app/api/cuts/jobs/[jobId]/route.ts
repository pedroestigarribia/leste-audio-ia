import { assertSafeJobId } from "@/lib/video/paths";
import { cleanupExpiredVideoJobs, deleteVideoJob, getStoredJob, toPublicJob } from "@/lib/video/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { jobId: string } };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await cleanupExpiredVideoJobs();
    assertSafeJobId(context.params.jobId);
    const job = await getStoredJob(context.params.jobId);
    if (!job) return Response.json({ ok: false, error: "Job de vídeo não encontrado." }, { status: 404 });
    return Response.json({ ok: true, job: toPublicJob(job) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Job inválido." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    assertSafeJobId(context.params.jobId);
    const job = await getStoredJob(context.params.jobId);
    if (!job) return Response.json({ ok: false, error: "Job de vídeo não encontrado." }, { status: 404 });
    await deleteVideoJob(context.params.jobId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível remover o job." }, { status: 400 });
  }
}
