import { NextResponse } from "next/server";
import { z } from "zod";

import { runDeepSeekTextTask } from "@/lib/deepseek";
import { MissingApiKeyError, getDeepSeekMissingKeyMessage, getServerEnv } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { buildPdfTaskPrompt } from "@/prompts/pdf";
import type { PdfTaskMode } from "@/prompts/pdf";
import type { TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pdfProcessSchema = z.object({
  text: z.string().trim().min(1, "Envie o texto extraido do PDF."),
  mode: z.enum(["summary", "organize", "grammar", "clean"]),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = pdfProcessSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        {
          ok: false,
          error: parsedBody.error.issues[0]?.message ?? "Corpo invalido.",
        },
        { status: 400 },
      );
    }

    const mode = parsedBody.data.mode as PdfTaskMode;
    const result = await runDeepSeekTextTask({
      system: "Voce trata textos extraidos de PDFs em portugues brasileiro com precisao, clareza e sem inventar.",
      prompt: buildPdfTaskPrompt(parsedBody.data.text, mode),
      temperature: 0.2,
    });

    return NextResponse.json<TextProcessResponse>({
      ok: true,
      result: normalizePlainText(result),
      model: getServerEnv().deepSeekModel,
    });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getDeepSeekMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Falha ao processar o texto do PDF.";

    return NextResponse.json<TextProcessResponse>(
      {
        ok: false,
        error: message,
      },
      { status: 502 },
    );
  }
}
