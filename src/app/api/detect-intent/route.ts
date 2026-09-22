import { NextResponse } from "next/server";
import { z } from "zod";

import { runTextTask } from "@/lib/text-ai";
import { MissingApiKeyError, getDeepSeekMissingKeyMessage } from "@/lib/env";
import { normalizePlainText } from "@/lib/plain-text";
import { buildDetectIntentPrompt } from "@/prompts/detectIntent";
import type { TextProcessResponse, AutoDetectedIntent } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const detectIntentSchema = z.object({
  text: z.string().trim().min(1, "Envie uma transcrição para analisar."),
});

function parseIntentJson(raw: string): AutoDetectedIntent | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (
      typeof parsed.intencao_principal !== "string" ||
      typeof parsed.tipo_de_solicitacao !== "string" ||
      typeof parsed.instrucao_convertida !== "string" ||
      typeof parsed.resposta_para_o_usuario !== "string"
    ) {
      return null;
    }
    return {
      intencao_principal: parsed.intencao_principal,
      intencoes_secundarias: Array.isArray(parsed.intencoes_secundarias)
        ? parsed.intencoes_secundarias.filter((x: unknown) => typeof x === "string")
        : [],
      tipo_de_solicitacao: parsed.tipo_de_solicitacao,
      resumo_do_entendimento: typeof parsed.resumo_do_entendimento === "string" ? parsed.resumo_do_entendimento : "",
      objetivo_final: typeof parsed.objetivo_final === "string" ? parsed.objetivo_final : "",
      entidades_identificadas: {
        conteudos: Array.isArray(parsed.entidades_identificadas?.conteudos) ? parsed.entidades_identificadas.conteudos : [],
        pessoas: Array.isArray(parsed.entidades_identificadas?.pessoas) ? parsed.entidades_identificadas.pessoas : [],
        formatos: Array.isArray(parsed.entidades_identificadas?.formatos) ? parsed.entidades_identificadas.formatos : [],
        datas: Array.isArray(parsed.entidades_identificadas?.datas) ? parsed.entidades_identificadas.datas : [],
        restricoes: Array.isArray(parsed.entidades_identificadas?.restricoes) ? parsed.entidades_identificadas.restricoes : [],
        preferencias: Array.isArray(parsed.entidades_identificadas?.preferencias) ? parsed.entidades_identificadas.preferencias : [],
      },
      acoes_necessarias: Array.isArray(parsed.acoes_necessarias) ? parsed.acoes_necessarias : [],
      ordem_de_execucao: Array.isArray(parsed.ordem_de_execucao) ? parsed.ordem_de_execucao : [],
      informacoes_faltantes: Array.isArray(parsed.informacoes_faltantes) ? parsed.informacoes_faltantes : [],
      nivel_de_confianca: typeof parsed.nivel_de_confianca === "number" ? parsed.nivel_de_confianca : 0,
      pode_executar_automaticamente: typeof parsed.pode_executar_automaticamente === "boolean" ? parsed.pode_executar_automaticamente : false,
      instrucao_convertida: parsed.instrucao_convertida,
      resposta_para_o_usuario: parsed.resposta_para_o_usuario,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsedBody = detectIntentSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json<TextProcessResponse>(
        { ok: false, error: parsedBody.error.issues[0]?.message ?? "Corpo inválido." },
        { status: 400 },
      );
    }

    const result = await runTextTask({
      system:
        "Você é um analisador inteligente de intenções em português brasileiro. Analisa transcrições com profundidade, considera contexto completo, corrige erros de transcrição, identifica intenções compostas e converte a fala em instruções estruturadas. Não inventa fatos. Não afirma emoções como fato. Retorna apenas JSON válido.",
      prompt: buildDetectIntentPrompt(parsedBody.data.text),
      temperature: 0.1,
    });

    const parsed = parseIntentJson(result);

    if (!parsed) {
      return NextResponse.json<TextProcessResponse>(
        { ok: false, error: "A IA não retornou JSON válido." },
        { status: 502 },
      );
    }

    return NextResponse.json<TextProcessResponse>({
      ok: true,
      result: JSON.stringify(parsed),
    });
  } catch (error) {
    const message =
      error instanceof MissingApiKeyError
        ? getDeepSeekMissingKeyMessage()
        : error instanceof Error
          ? error.message
          : "Falha ao detectar intenção.";

    return NextResponse.json<TextProcessResponse>(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
