import { NextResponse } from "next/server";
import { z } from "zod";

import { buildExportFileName, buildExportText } from "@/lib/export-txt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const exportItemSchema = z.object({
  name: z.string().trim().min(1),
  transcription: z.string().optional(),
  summary: z.string().optional(),
  organizedText: z.string().optional(),
});

const exportSchema = z.object({
  items: z.array(exportItemSchema),
  generalSummary: z.string().optional(),
  generalOrganizedText: z.string().optional(),
  generalAnalysis: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = exportSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsedBody.error.issues[0]?.message ?? "Corpo invalido.",
        },
        { status: 400 },
      );
    }

    const content = buildExportText(parsedBody.data);
    const fileName = buildExportFileName(new Date());

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao gerar o TXT.",
      },
      { status: 500 },
    );
  }
}
