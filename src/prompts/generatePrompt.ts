export function buildUnifiedPromptGeneratorPrompt(params: {
  painelGeral: {
    summary: string;
    organized: string;
    analysis: string;
    tasks: string;
    keyData: string;
    reply: string;
  };
  transcriptions: string[];
  videoContext?: string;
}): string {
  const { painelGeral, transcriptions, videoContext } = params;

  const transcriptionsBlock = transcriptions.length
    ? transcriptions
        .map((t, i) => `--- TRANSCRIÇÃO ${i + 1} ---\n${t}`)
        .join("\n\n")
    : "(nenhuma transcrição disponível)";

  const painelBlock = [
    painelGeral.summary ? `RESUMO GERAL:\n${painelGeral.summary}` : null,
    painelGeral.organized ? `ORGANIZAÇÃO GERAL:\n${painelGeral.organized}` : null,
    painelGeral.analysis ? `INTERPRETAÇÃO GERAL:\n${painelGeral.analysis}` : null,
    painelGeral.tasks ? `TAREFAS E PENDÊNCIAS:\n${painelGeral.tasks}` : null,
    painelGeral.keyData ? `DADOS-CHAVE:\n${painelGeral.keyData}` : null,
    painelGeral.reply ? `RESPOSTA PARA WHATSAPP:\n${painelGeral.reply}` : null,
    videoContext ? `CONTEXTO DO VÍDEO:\n${videoContext}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return `Você é um gerador de prompts inteligente. Analise todas as informações disponíveis e gere um prompt estruturado, técnico e reutilizável.

INSTRUÇÕES:
1. Leia todo o conteúdo do Painel Geral.
2. Leia todas as transcrições disponíveis.
3. Unifique as informações, removendo duplicações.
4. Identifique objetivo, contexto, requisitos, restrições e resultado esperado.
5. Se alguma informação essencial estiver ausente, liste os dados faltantes.
6. Gere um prompt claro, técnico e reutilizável.

CONTEÚDO DO PAINEL GERAL:
${painelBlock || "(painel gera sem conteúdo ainda)"}

TRANSCRIÇÕES:
${transcriptionsBlock}

FORMATO DE SAÍDA JSON:
{
  "hasActionableIntent": true|false,
  "detectedObjective": "Objetivo principal detectado a partir de todo o conteúdo.",
  "prompt": "O prompt estruturado completo, pronto para uso.",
  "missingInfo": "Lista de informações ausentes que seriam necessárias para um prompt mais preciso, ou string vazia se não houver nada faltando."
}

O prompt gerado DEVE conter as seguintes seções:
- Objetivo
- Contexto
- Requisitos
- Restrições
- Passo a passo
- Formato da resposta esperado

Regras:
- Não invente informações.
- Utilize primeiro o Painel Geral e depois as transcrições.
- Aproveite todo o contexto disponível.
- Gere prompts claros, técnicos e reutilizáveis.
- Se não houver intenção clara de ação, retorne hasActionableIntent como false e prompt como string vazia.
- Não afirme emoções ou estados psicológicos como fato.
- Não use markdown com **, ##, tabelas ou blocos de código no prompt gerado.
- Entregue apenas JSON válido.`;
}
