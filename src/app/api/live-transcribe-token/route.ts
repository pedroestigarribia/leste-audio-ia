import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getGeminiMissingKeyMessage,
  getOpenAIMissingKeyMessage,
  getServerEnv,
  MissingApiKeyError,
  requireGeminiApiKey,
  requireOpenAIApiKey,
} from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attempts = new Map<string, number[]>();
const MAX_SESSIONS_PER_MINUTE = 10;

class LiveProviderConnectionError extends Error {
  constructor() {
    super("Não foi possível conectar ao serviço de voz do Google após novas tentativas.");
    this.name = "LiveProviderConnectionError";
  }
}

function checkRateLimit(request: Request) {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const recent = (attempts.get(ip) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= MAX_SESSIONS_PER_MINUTE) return false;
  if (attempts.size > 500) {
    for (const [entryIp, times] of attempts) if (times.every((time) => now - time >= 60_000)) attempts.delete(entryIp);
  }
  attempts.set(ip, [...recent, now]);
  return true;
}

function providerError(status: number) {
  if (status === 400 || status === 404) return "O modelo de transcrição ao vivo não está disponível ou não aceita esta configuração. Confira OPENAI_LIVE_TRANSCRIBE_MODEL no .env.local.";
  if (status === 401 || status === 403) return "A OpenAI recusou a chave ou ela não tem acesso à transcrição ao vivo. Confira OPENAI_API_KEY e as permissões do projeto.";
  if (status === 429) return "O limite temporário da API OpenAI foi atingido. Aguarde um pouco e tente novamente.";
  if (status >= 500) return "O serviço de transcrição ao vivo da OpenAI está temporariamente indisponível. A gravação comum continua disponível.";
  return `A OpenAI não iniciou a sessão de voz (HTTP ${status}). A gravação comum continua disponível.`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function createProviderToken(apiKey: string, body: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });

      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
        return response;
      }
    } catch {
      if (attempt === 2) throw new LiveProviderConnectionError();
    }

    await wait(500 * (attempt + 1));
  }

  throw new LiveProviderConnectionError();
}

function getProviderError(status: number) {
  if (status === 400 || status === 404) {
    return "O modelo de transcrição ao vivo não está disponível ou não aceita esta configuração. Confira GEMINI_LIVE_TRANSCRIBE_MODEL no .env.local.";
  }
  if (status === 401) {
    return "O Google recusou a chave da API. Confira GEMINI_API_KEY no .env.local.";
  }
  if (status === 403) {
    return "A chave da API não tem permissão para transcrição ao vivo. Confira o acesso à Gemini API no projeto Google.";
  }
  if (status === 429) {
    return "O limite temporário da API Gemini foi atingido. Aguarde um pouco e tente novamente.";
  }
  if (status >= 500) {
    return "O serviço de voz do Google está temporariamente indisponível. A gravação comum continua disponível; tente a escuta ao vivo novamente.";
  }
  return `O Google não iniciou a sessão de voz (HTTP ${status}). A gravação comum continua disponível.`;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, error: "Origem não permitida." }, { status: 403 });
  }

  try {
    const body = z.object({ vocabulary: z.array(z.string().trim().min(1).max(80)).max(50).optional() })
      .safeParse(await request.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ ok: false, error: "Vocabulário inválido." }, { status: 400 });
    if (!checkRateLimit(request)) {
      return NextResponse.json({ ok: false, error: "Muitas sessões de voz em sequência. Aguarde um minuto antes de tentar novamente." }, { status: 429 });
    }

    if (getServerEnv().audioAiProvider === "openai") {
      const model = getServerEnv().openAiLiveTranscribeModel;
      const keywords = Array.from(new Set([
        "Leste Valley", "Codex", "Claude Code", "ChatGPT", "React", "Next.js",
        "TypeScript", "Supabase", "GitHub", "WebSocket", "SEO", "WhatsApp",
        ...(body.data.vocabulary ?? []),
      ])).filter((term) => !/[<>\r\n]/.test(term)).slice(0, 50);
      const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requireOpenAIApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expires_after: { anchor: "created_at", seconds: 60 },
          session: {
            type: "transcription",
            audio: {
              input: {
                transcription: {
                  model,
                  languages: ["pt"],
                  keywords,
                  prompt: "Transcrição fiel em português brasileiro. Preserve nomes próprios e termos técnicos; não resuma nem invente.",
                },
                turn_detection: null,
              },
            },
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return NextResponse.json({ ok: false, error: providerError(response.status) }, { status: response.status === 429 || response.status >= 500 ? 503 : 502 });
      }
      const result = await response.json() as { value?: string; expires_at?: number };
      if (!result.value) throw new Error("Token temporário da OpenAI não recebido.");
      return NextResponse.json(
        { ok: true, provider: "openai", token: result.value, model, expiresAt: result.expires_at },
        { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
      );
    }

    const key = requireGeminiApiKey();
    const model = getServerEnv().geminiLiveTranscribeModel;
    const vocabulary = Array.from(new Set([
      "Leste Valley", "Codex", "Claude Code", "ChatGPT", "React", "Next.js",
      "TypeScript", "Supabase", "GitHub", "WebSocket", "SEO", "WhatsApp",
      ...(body.data.vocabulary ?? []),
    ]));
    const config = { responseModalities: ["TEXT"], inputAudioTranscription: { languageCodes: ["pt-BR"], mode: "VERBATIM", customVocabulary: vocabulary } };
    const now = Date.now();

    const response = await createProviderToken(key, {
        uses: 1,
        newSessionExpireTime: new Date(now + 90_000).toISOString(),
        expireTime: new Date(now + 12 * 60_000).toISOString(),
        bidiGenerateContentSetup: {
          model: `models/${model}`,
          generationConfig: { responseModalities: config.responseModalities },
          inputAudioTranscription: config.inputAudioTranscription,
        },
      });
    if (!response.ok) {
      const unavailable = response.status === 429 || response.status >= 500;
      return NextResponse.json({ ok: false, error: getProviderError(response.status) }, { status: unavailable ? 503 : 502 });
    }
    const token = await response.json() as { name?: string };
    if (!token.name) throw new Error("Token temporário não recebido.");
    return NextResponse.json({ ok: true, provider: "gemini", token: token.name, model, config }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof MissingApiKeyError
      ? getServerEnv().audioAiProvider === "openai" ? getOpenAIMissingKeyMessage() : getGeminiMissingKeyMessage()
      : error instanceof LiveProviderConnectionError
        ? `${error.message} A gravação comum continua disponível.`
        : "Falha ao preparar a sessão ao vivo. A gravação comum continua disponível.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
