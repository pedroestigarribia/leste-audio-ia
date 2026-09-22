import { createReadStream, promises as fs, statSync } from "node:fs";
import { Readable } from "node:stream";

import { getStoredJob } from "@/lib/video/job-store";
import { assertSafeJobId } from "@/lib/video/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTPUT_ID_PATTERN = /^output-[A-Za-z0-9_-]{10,24}$/;

type RouteContext = { params: { jobId: string; outputId: string } };

export async function GET(request: Request, context: RouteContext) {
  try {
    assertSafeJobId(context.params.jobId);
    if (!OUTPUT_ID_PATTERN.test(context.params.outputId)) {
      return Response.json({ ok: false, error: "Identificador de saída inválido." }, { status: 400 });
    }
    const job = await getStoredJob(context.params.jobId);
    const output = job?.outputs.find((item) => item.id === context.params.outputId);
    if (!output) return Response.json({ ok: false, error: "Saída não encontrada." }, { status: 404 });
    if (new Date(output.expiresAt).getTime() < Date.now()) {
      return Response.json({ ok: false, error: "Esta saída expirou. Gere o corte novamente." }, { status: 410 });
    }

    const wantsSrt = new URL(request.url).searchParams.get("format") === "srt";
    const filePath = wantsSrt ? output.srtPath : output.filePath;
    if (!filePath) return Response.json({ ok: false, error: "Legenda não disponível." }, { status: 404 });
    if (!wantsSrt) {
      const size = statSync(filePath).size;
      const range = request.headers.get("range");
      const match = range?.match(/^bytes=(\d*)-(\d*)$/);
      let start = 0;
      let end = size - 1;
      if (match) {
        start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2] || 0));
        end = match[2] ? Number(match[2]) : end;
        if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
        end = Math.min(end, size - 1);
      }
      const stream = createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream) as unknown as BodyInit, {
        status: match ? 206 : 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(end - start + 1),
          ...(match ? { "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes" } : { "Accept-Ranges": "bytes" }),
          "Content-Disposition": `inline; filename="${output.fileName}"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    }
    const data = await fs.readFile(filePath);
    return new Response(data, {
      headers: {
        "Content-Type": wantsSrt ? "application/x-subrip; charset=utf-8" : "video/mp4",
        "Content-Disposition": `${wantsSrt ? "attachment" : "inline"}; filename="${wantsSrt ? output.srtFileName : output.fileName}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return Response.json({ ok: false, error: "O arquivo de saída não está mais disponível." }, { status: 404 });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível baixar a saída." }, { status: 500 });
  }
}
