import type { AnalyzeAllItem, AnalyzeAllMode } from "@/types/audio";

function buildPromptByMode(mode: AnalyzeAllMode) {
  if (mode === "tasks") {
    return `Analise todas as transcricoes abaixo e extraia apenas o que precisa virar acao.

Entregue:

1. Tarefas confirmadas.
2. Pendencias.
3. Responsaveis citados, se houver.
4. Datas, horarios e prazos.
5. Pontos que ainda dependem de confirmacao.

Regras:

- Nao invente.
- Se algo nao estiver claro, marque como duvida.
- Nao use markdown com **, ##, tabelas ou blocos de codigo.
- Entregue apenas texto puro.`;
  }

  if (mode === "keyData") {
    return `Analise todas as transcricoes abaixo e extraia os dados mais importantes para consulta rapida.

Entregue:

1. Nomes de pessoas.
2. Empresas e marcas.
3. Lugares.
4. Datas e horarios.
5. Valores, numeros e quantidades.
6. Decisoes ou combinados relevantes.

Regras:

- Nao invente.
- Nao preencha lacunas com suposicoes.
- Se houver ambiguidade, marque como duvida.
- Nao use markdown com **, ##, tabelas ou blocos de codigo.
- Entregue apenas texto puro.`;
  }

  if (mode === "reply") {
    return `Analise todas as transcricoes abaixo e produza uma resposta pronta para WhatsApp baseada apenas no que foi dito.

Entregue:

1. Uma resposta curta.
2. Uma resposta mais completa.
3. Se houver duvidas pendentes, liste antes da resposta final.

Regras:

- Nao invente.
- Nao acrescente contexto externo.
- Preserve o tom natural do portugues brasileiro.
- Nao use markdown com **, ##, tabelas ou blocos de codigo.
- Entregue apenas texto puro.`;
  }

  if (mode === "intent") {
    return `Analise todas as transcrições como um único conjunto e identifique, com profundidade, a intenção global e o que precisa ser feito a partir delas.

Entregue nesta ordem:

1. Assunto e contexto geral.
2. Intenção principal consolidada.
3. Intenções secundárias, quando existirem.
4. Objetivo ou resultado esperado.
5. O que precisa ser feito, em ações práticas e ordenadas por prioridade.
6. Requisitos, preferências, restrições e decisões já citadas.
7. Dados que ainda faltam ou precisam de confirmação.
8. Riscos, ambiguidades ou conflitos entre as falas.
9. Sugestões práticas de próximos passos, separadas claramente dos fatos confirmados.
10. Grau de confiança da interpretação e interpretações alternativas relevantes, se houver.

Regras:

- Considere o conjunto inteiro antes de concluir a intenção.
- Não invente fatos, pessoas, prazos, decisões ou necessidades.
- Diferencie explicitamente fatos citados, inferências prováveis e sugestões.
- Não trate uma ação apenas mencionada como um pedido confirmado sem evidência no contexto.
- Quando a intenção não estiver clara, diga isso e informe o que falta para torná-la executável.
- Use português brasileiro direto, natural e copiável.
- Não use markdown com **, ##, tabelas ou blocos de código.
- Entregue apenas texto puro.`;
  }

  return `Analise todas as transcricoes abaixo e organize o conteudo em portugues brasileiro.

Entregue:

1. Resumo geral.
2. Pontos principais.
3. Tarefas citadas.
4. Decisoes citadas.
5. Nomes, empresas, lugares, datas, horarios e valores mencionados.
6. Possiveis duvidas.
7. Resposta pronta para WhatsApp, quando fizer sentido.
8. Texto final copiavel.

Regras:

- Nao invente.
- Nao acrescente dados externos.
- Nao transforme duvida em certeza.
- Quando algo estiver ambiguo, sinalize como duvida.
- Preserve o sentido original.
- Nao embeleze demais.
- Nao transforme fala informal em texto artificial.
- Nao use "nao e..., e...".
- Nao use "execucao" como termo padrao.
- Nao use "jornada".
- Nao use "bonito" ou "bonita".
- Nao use "simples".
- Use portugues brasileiro direto e natural.
- Nao use markdown com **, ##, tabelas ou blocos de codigo.
- Entregue apenas texto puro.`;
}

export function buildAnalyzeAllPrompt(items: AnalyzeAllItem[], mode: AnalyzeAllMode = "analysis"): string {
  const joinedTranscriptions = items
    .map(
      (item, index) =>
        `AUDIO ${index + 1}: ${item.name}
TRANSCRICAO:
${item.transcription}`,
    )
    .join("\n\n========================\n\n");

  return `${buildPromptByMode(mode)}

Transcricoes:
${joinedTranscriptions}`;
}
