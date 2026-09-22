export function buildOrganizePrompt(text: string, mode: "single" | "all"): string {
  const header = mode === "all"
    ? "Organize o conjunto de transcrições abaixo para deixá-lo mais claro, mais útil e mais fácil de consultar, mantendo o sentido original."
    : "Organize o texto abaixo para deixá-lo mais claro, mantendo o sentido original.";

  const outputRules =
    mode === "all"
      ? `Formato de saída:

1. Contexto geral.
2. Assuntos agrupados por tema.
3. Tarefas, pendências e próximos passos.
4. Datas, horários, valores, nomes e lugares.
5. Texto final limpo e copiável.`
      : `Formato de saída:

1. Texto reorganizado.
2. Tarefas ou combinados.
3. Dúvidas, se houver.`;

  return `${header}

Regras:

- Não invente informações.
- Não acrescente intenção que não esteja no texto.
- Corrija apenas estrutura, clareza e ordem das ideias.
- Preserve nomes, datas, valores, lugares e compromissos.
- Use português brasileiro natural.
- Entregue uma versão clara e copiável.
- Se houver trecho duvidoso, mantenha sinalizado.
- Não use markdown com **, ##, tabelas ou blocos de código.
- Entregue apenas texto puro.

${outputRules}

Texto:
${text}`;
}
