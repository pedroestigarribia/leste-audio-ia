export function buildSummaryPrompt(text: string, mode: "single" | "all"): string {
  const header = mode === "all"
    ? "Resuma o conjunto de transcrições abaixo em português brasileiro de forma objetiva e pronta para uso."
    : "Resuma o conteúdo abaixo em português brasileiro de forma objetiva.";

  const outputRules =
    mode === "all"
      ? `Formato de saída:

1. Panorama geral.
2. Pontos principais.
3. Tarefas e pendências.
4. Dúvidas e riscos.
5. Resumo final em texto corrido.`
      : `Formato de saída:

1. Assunto principal.
2. Pontos principais.
3. Tarefas ou combinados.
4. Dúvidas, se houver.`;

  return `${header}

Regras:

- Preserve as ideias principais.
- Não invente informações.
- Não acrescente intenção que não esteja no texto.
- Se houver algo ambíguo, sinalize como dúvida.
- Entregue em tópicos claros.
- Use linguagem direta.
- Não use floreio.
- Não use frases motivacionais.
- Não use markdown com **, ##, tabelas ou blocos de código.
- Entregue apenas texto puro.

${outputRules}

Texto:
${text}`;
}
