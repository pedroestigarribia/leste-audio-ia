import { NextResponse } from "next/server";

import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { runTextTask } from "@/lib/text-ai";
import { normalizePlainText } from "@/lib/plain-text";
import type {
  NarrationPrepMode,
  PreparedText,
  TextProcessResponse,
} from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPTS: Record<NarrationPrepMode, string> = {
  fiel: `Voce e um especialista em preparacao de textos para narracao.
Preserve integralmente o conteudo original.
Nao resuma, nao parafraseie, nao altere o sentido de nenhuma frase.
Apenas remova elementos que prejudicariam a leitura em voz alta:
- cabeçalhos e rodapes repetidos
- numeros de pagina
- quebras de linha inadequadas
- caracteres estranhos
- palavras quebradas

Reconstrua paragrafos corretamente.
Identifique titulos e subtitulos com marcadores ##.
Identifique capitulos com marcadores #.
Mantenha listas intactas.
Transforme links em descricoes legiveis entre parenteses.
Preserve o conteudo original integralmente.`,

  natural: `Voce e um especialista em preparacao de textos para narracao natural.
Preserve integralmente o conteudo original.
Nao resuma, nao parafraseie, nao altere o sentido.

Ajustes permitidos:
- corrigir pontuacao para melhorar a fluidez da leitura
- ajustar quebras de linha e reconstruir paragrafos
- remover cabecalhos, rodapes e numeros de pagina repetidos
- corrigir palavras quebradas
- remover caracteres estranhos
- interpretar abreviacoes (ex: "Sr." -> "Senhor", "Dr." -> "Doutor")
- preparar numeros, datas e valores para leitura natural (ex: "R$ 1.500,00" -> "mil e quinhentos reais")
- transformar links em descricao compreensivel
- detectar e preservar citacoes

Identifique titulos com ## e capitulos com #.
Nao remova nenhum conteudo informativo.`,

  adaptada: `Voce e um especialista em adaptacao de textos para audio.
Preserve o conteudo original, mas reorganize a estrutura para uma experiencia de escuta mais fluida e agradavel.

O que fazer:
- reorganizar paragrafos muito longos em unidades menores
- ajustar pontuacao para pausas naturais
- remocer cabecalhos, rodapes e numeros de pagina
- preparar numeros, datas, valores e abreviacoes para leitura natural
- transformar listas em texto corrido com marcadores verbais
- transformar links em descricao entre parenteses
- adicionar indicacoes de transicao entre topicos
- identificar titulos com ## e capitulos com #
- criar uma estrutura que flui bem quando lida em voz alta
- manter integralmente o conteudo informativo

Nao resumir. Nao omitir informacoes. Nao adicionar opinioes.`,
};

function buildPrompt(text: string, mode: NarrationPrepMode): string {
  return `Prepare o texto abaixo para narracao em portugues brasileiro no modo "${mode}".

TEXTO ORIGINAL:
${text}

INSTRUCOES:
1. Aplique as regras do modo "${mode}" descritas no sistema.
2. Preserve TITULOS com ## e CAPITULOS com # no inicio da linha.
3. Retorne APENAS o texto preparado, sem explicacoes.
4. Mantenha a estrutura de paragrafos usando linhas em branco entre eles.

TEXTO PREPARADO:`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      text: string;
      mode: NarrationPrepMode;
    };

    const text = normalizePlainText(body.text ?? "");
    const mode: NarrationPrepMode = body.mode ?? "natural";

    if (!text.trim()) {
      return NextResponse.json<TextProcessResponse>(
        { ok: false, error: "Nenhum texto para preparar." },
        { status: 400 },
      );
    }

    if (!["fiel", "natural", "adaptada"].includes(mode)) {
      return NextResponse.json<TextProcessResponse>(
        { ok: false, error: `Modo inválido: ${mode}` },
        { status: 400 },
      );
    }

    const system = SYSTEM_PROMPTS[mode];
    const prompt = buildPrompt(text, mode);

    const result = await runTextTask({
      system,
      prompt,
      temperature: mode === "fiel" ? 0.05 : 0.2,
    });

    const prepared = normalizePlainText(result);
    const paragraphs = prepared.split(/\n\s*\n/).filter(Boolean);
    const titles = paragraphs
      .filter((p) => p.startsWith("##"))
      .map((p) => p.replace(/^##\s*/, "").trim());
    const chapters = paragraphs
      .filter((p) => p.startsWith("#"))
      .map((p) => p.replace(/^#\s*/, "").trim());
    const wordCount = prepared.split(/\s+/).filter(Boolean).length;
    const charCount = prepared.length;
    const estimatedMinutes = Math.ceil(charCount / 900);

    const payload: PreparedText = {
      original: text,
      prepared,
      mode,
      metadata: {
        titulos: titles,
        capitulos: chapters,
        totalCaracteres: charCount,
        totalPalavras: wordCount,
        totalParagrafos: paragraphs.length,
        chunkCount: Math.ceil(charCount / 3500),
        estimatedDurationMinutes: estimatedMinutes,
      },
    };

    return NextResponse.json({ ok: true, result: JSON.stringify(payload) } satisfies TextProcessResponse);
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getDeepSeekMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Falha ao preparar texto para narração.";

    return NextResponse.json<TextProcessResponse>({ ok: false, error: message }, { status: 502 });
  }
}
