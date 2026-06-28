export function buildOrganizePrompt(text: string, mode: "single" | "all"): string {
  const header = mode === "all"
    ? "Organize o conjunto de transcricoes abaixo para deixa-lo mais claro, mais util e mais facil de consultar, mantendo o sentido original."
    : "Organize o texto abaixo para deixa-lo mais claro, mantendo o sentido original.";

  const outputRules =
    mode === "all"
      ? `Formato de saida:

1. Contexto geral.
2. Assuntos agrupados por tema.
3. Tarefas, pendencias e proximos passos.
4. Datas, horarios, valores, nomes e lugares.
5. Texto final limpo e copiavel.`
      : `Formato de saida:

1. Texto reorganizado.
2. Tarefas ou combinados.
3. Dvidas, se houver.`;

  return `${header}

Regras:

- Nao invente informacoes.
- Nao acrescente intencao que nao esteja no texto.
- Corrija apenas estrutura, clareza e ordem das ideias.
- Preserve nomes, datas, valores, lugares e compromissos.
- Use portugues brasileiro natural.
- Entregue uma versao clara e copiavel.
- Se houver trecho duvidoso, mantenha sinalizado.
- Nao use markdown com **, ##, tabelas ou blocos de codigo.
- Entregue apenas texto puro.

${outputRules}

Texto:
${text}`;
}
