export function buildSummaryPrompt(text: string, mode: "single" | "all"): string {
  const header = mode === "all"
    ? "Resuma o conjunto de transcricoes abaixo em portugues brasileiro de forma objetiva e pronta para uso."
    : "Resuma o conteudo abaixo em portugues brasileiro de forma objetiva.";

  const outputRules =
    mode === "all"
      ? `Formato de saida:

1. Panorama geral.
2. Pontos principais.
3. Tarefas e pendencias.
4. Dvidas e riscos.
5. Resumo final em texto corrido.`
      : `Formato de saida:

1. Assunto principal.
2. Pontos principais.
3. Tarefas ou combinados.
4. Dvidas, se houver.`;

  return `${header}

Regras:

- Preserve as ideias principais.
- Nao invente informacoes.
- Nao acrescente intencao que nao esteja no texto.
- Se houver algo ambiguo, sinalize como duvida.
- Entregue em topicos claros.
- Use linguagem direta.
- Nao use floreio.
- Nao use frases motivacionais.
- Nao use markdown com **, ##, tabelas ou blocos de codigo.
- Entregue apenas texto puro.

${outputRules}

Texto:
${text}`;
}
