export type PdfTaskMode =
  | "analysis"
  | "summary"
  | "interpretation"
  | "organize"
  | "grammar"
  | "clean";

const MODE_INSTRUCTIONS: Record<PdfTaskMode, string> = {
  analysis: `Analise e identifique o documento abaixo em português brasileiro.

Entregue, em texto puro e com os titulos abaixo:
TIPO DE DOCUMENTO:
O QUE E ESTE DOCUMENTO:
FINALIDADE APARENTE:
PARTES, EMISSORES OU DESTINATÁRIOS:
DATAS, PRAZOS, VALORES, NÚMEROS E REFERÊNCIAS:
PONTOS PRINCIPAIS:
OBRIGAÇÕES, RESPONSABILIDADES OU CONDIÇÕES:
RISCOS, ATENÇÕES E PONTOS A CONFERIR:
INFORMAÇÕES AUSENTES OU AMBÍGUAS:

Classifique pelo conteúdo, por exemplo: contrato, aditivo, proposta, política, notificação, relatório, livro, material acadêmico, fatura ou outro. Se não houver certeza, informe a classificação como provável.

Se for contrato ou documento jurídico, destaque somente cláusulas, partes, vigência, valores, obrigações, penalidades, renovação, rescisão, confidencialidade e proteção de dados que estiverem expressos no texto. Não ofereça parecer jurídico, não determine validade legal e recomende revisão profissional quando houver risco ou ambiguidade.`,
  summary: `Resuma o texto extraído do PDF em português brasileiro.

Entregue:
1. Resumo geral.
2. Pontos principais.
3. Tarefas ou informações acionáveis, se houver.
4. Dúvidas ou trechos incompletos, se houver.
5. Conclusao objetiva.`,
  interpretation: `Interprete o conteúdo do documento abaixo com base apenas no que está escrito.

Entregue, em texto puro e com os titulos abaixo:
LEITURA DO DOCUMENTO:
IMPLICAÇÕES PRÁTICAS:
DECISÕES, COMPROMISSOS OU PRÓXIMOS PASSOS:
RISCOS E PONTOS DE ATENÇÃO:
DÚVIDAS QUE PRECISAM DE CONFIRMAÇÃO:
CONCLUSAO:

Para contratos ou documentos juridicos, explique de forma acessivel as consequencias praticas aparentes das clausulas, sem substituir advogado, sem afirmar validade juridica e sem inventar obrigacoes. Para outros documentos, explique contexto, objetivo, impacto e acoes indicadas pelo proprio texto.`,
  organize: `Organize o texto extraído do PDF para ficar claro, estruturado e pronto para copiar.

Entregue:
1. Título sugerido, se fizer sentido.
2. Conteúdo organizado por seções.
3. Pontos importantes.
4. Texto final copiavel.`,
  grammar: `Ajuste gramaticalmente o texto extraído do PDF.

Regras:
- Corrija ortografia, pontuacao, concordancia e clareza.
- Preserve o sentido original.
- Nao acrescente informacoes.
- Mantenha nomes, datas, valores e lugares.`,
  clean: `Deixe o conteúdo extraído do PDF mais limpo, organizado e pronto para copiar.

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
