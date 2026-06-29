export type PdfTaskMode = "summary" | "organize" | "grammar" | "clean";

const MODE_INSTRUCTIONS: Record<PdfTaskMode, string> = {
  summary: `Resuma o texto extraido do PDF em portugues brasileiro.

Entregue:
1. Resumo geral.
2. Pontos principais.
3. Tarefas ou informacoes acionaveis, se houver.
4. Duvidas ou trechos incompletos, se houver.`,
  organize: `Organize o texto extraido do PDF para ficar claro, estruturado e pronto para copiar.

Entregue:
1. Titulo sugerido, se fizer sentido.
2. Conteudo organizado por secoes.
3. Pontos importantes.
4. Texto final copiavel.`,
  grammar: `Ajuste gramaticalmente o texto extraido do PDF.

Regras:
- Corrija ortografia, pontuacao, concordancia e clareza.
- Preserve o sentido original.
- Nao acrescente informacoes.
- Mantenha nomes, datas, valores e lugares.`,
  clean: `Deixe o conteudo extraido do PDF mais limpo, organizado e pronto para copiar.

Regras:
- Remova quebras estranhas, repeticoes obvias e ruidos de extracao.
- Preserve o sentido original.
- Nao invente informacoes.
- Entregue uma versao final natural e copiavel.`,
};

export function buildPdfTaskPrompt(text: string, mode: PdfTaskMode) {
  return `${MODE_INSTRUCTIONS[mode]}

Regras gerais:
- Use portugues brasileiro direto e natural.
- Nao use markdown com **, ##, tabelas ou blocos de codigo.
- Nao invente informacoes.
- Se o PDF parecer incompleto ou com texto mal extraido, sinalize isso.
- Entregue apenas texto puro.

Texto extraido do PDF:
${text}`;
}
