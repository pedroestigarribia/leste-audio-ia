import { NextResponse } from "next/server";
import { z } from "zod";

import { getTextAiModel, runTextTask } from "@/lib/text-ai";
import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { buildPdfTaskPrompt } from "@/prompts/pdf";
import type { PdfTaskMode } from "@/prompts/pdf";
import type { TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pdfProcessSchema = z.object({
  text: z.string().trim().min(1, "Envie o texto extraído do documento."),
  mode: z.enum(["analysis", "summary", "interpretation", "organize", "grammar", "clean"]),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = pdfProcessSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        {
          ok: false,
          error: parsedBody.error.issues[0]?.message ?? "Corpo inválido.",
        },
        { status: 400 },
      );
    }

    const mode = parsedBody.data.mode as PdfTaskMode;
    const result = await runTextTask({
      system:
        "Você trata textos extraídos de contratos e documentos em português brasileiro com precisão, clareza e sem inventar. Não ofereça parecer jurídico nem afirme validade legal.",
      prompt: buildPdfTaskPrompt(parsedBody.data.text, mode),
      temperature: 0.2,
    });

    return NextResponse.json<TextProcessResponse>({
      ok: true,
      result: normalizePlainText(result),
      model: getTextAiModel(),
    });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getDeepSeekMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Falha ao processar o texto do documento.";

    return NextResponse.json<TextProcessResponse>(
      {
        ok: false,
        error: message,
      },
      { status: 502 },
    );
  }
}
