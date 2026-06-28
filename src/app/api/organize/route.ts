import { NextResponse } from "next/server";
import { z } from "zod";

import { MissingApiKeyError, getDeepSeekMissingKeyMessage, getServerEnv } from "@/lib/env";
import { runDeepSeekTextTask } from "@/lib/deepseek";
import { normalizePlainText } from "@/lib/plain-text";
import { buildOrganizePrompt } from "@/prompts/organize";
import type { TextProcessResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const organizeSchema = z.object({
  text: z.string().trim().min(1, "Envie um texto para organizar."),
  mode: z.enum(["single", "all"]),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = organizeSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        {
          ok: false,
          error: parsedBody.error.issues[0]?.message ?? "Corpo invalido.",
        },
        { status: 400 },
      );
    }

    const result = await runDeepSeekTextTask({
      system:
        "Voce organiza transcricoes em portugues brasileiro sem alterar o sentido original.",
      prompt: buildOrganizePrompt(parsedBody.data.text, parsedBody.data.mode),
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
          : "Falha ao organizar o texto.";

    return NextResponse.json<TextProcessResponse>(
      {
        ok: false,
        error: message,
      },
      { status: 502 },
    );
  }
}
