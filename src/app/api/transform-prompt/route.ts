import { NextResponse } from "next/server";
import { z } from "zod";

import { getTextAiModel, runTextTask } from "@/lib/text-ai";
import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { buildTransformPrompt } from "@/prompts/transformPrompt";
import type { PromptTransformFormat, TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const transformPromptSchema = z
  .object({
    analysis: z.string().optional().default(""),
    format: z.enum(["app", "webApp", "landingPage", "existingProject"]),
    intent: z.string().optional().default(""),
    keyData: z.string().optional().default(""),
    organized: z.string().optional().default(""),
    reply: z.string().optional().default(""),
    summary: z.string().optional().default(""),
    tasks: z.string().optional().default(""),
    transcriptions: z.string().optional().default(""),
  })
  .superRefine((value, context) => {
    const hasContent = [
      value.analysis,
      value.intent,
      value.keyData,
      value.organized,
      value.reply,
      value.summary,
      value.tasks,
      value.transcriptions,
    ].some((item) => item.trim());

    if (!hasContent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Envie transcrições ou algum resultado interpretado para transformar em prompt.",
      });
    }
  });

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = transformPromptSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        {
          ok: false,
          error: parsedBody.error.issues[0]?.message ?? "Corpo inválido.",
        },
        { status: 400 },
      );
    }

    const result = await runTextTask({
      system:
        "Você transforma análises de transcrições em prompts finais objetivos, completos, sem inventar e sem expor raciocínio oculto.",
      prompt: buildTransformPrompt({
        ...parsedBody.data,
        format: parsedBody.data.format as PromptTransformFormat,
      }),
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
          : "Falha ao transformar o conteúdo em prompt.";

    return NextResponse.json<TextProcessResponse>(
      {
        ok: false,
        error: message,
      },
      { status: 502 },
    );
  }
}
