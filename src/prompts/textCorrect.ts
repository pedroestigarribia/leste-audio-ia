const MODE_LABELS: Record<string, string> = {
  corrigir: "Corrigir",
  reescrever: "Reescrever",
  encurtar: "Encurtar",
  expandir: "Expandir",
  profissional: "Profissional",
  informal: "Informal",
  clareza: "Clareza",
  remover_repeticoes: "Remover repeticoes",
  pontuacao: "Pontuacao",
  humanizar: "Humanizar",
};

const MODE_RULES: Record<string, string> = {
  corrigir:
    "Corrija apenas: ortografia, gramatica, acentuacao, concordancia, pontuacao, digitacao e pequenas melhorias de clareza. Nao reescreva o texto inteiro.",
  reescrever:
    "Reescreva o texto mantendo exatamente o mesmo significado. Melhore fluidez, naturalidade e organizacao das frases. Sem alterar a mensagem.",
  encurtar:
    "Reduza o texto eliminando redundancias, frases desnecessarias e repeticoes. Mantenha todas as informacoes importantes.",
  expandir:
    "Desenvolva o texto acrescentando apenas explicacoes que estejam naturalmente implicitas. Nunca invente fatos.",
  profissional:
    "Transforme o texto em uma comunicacao profissional. Utilize linguagem clara, objetiva, elegante e respeitosa. Sem exagerar na formalidade.",
  informal:
    "Deixe o texto mais leve e natural. Use linguagem cotidiana do Portugues Brasileiro. Nunca utilize glias excessivas.",
  clareza:
    "Reorganize o texto para facilitar a leitura. Melhore ordem das ideias, construcao das frases e fluidez. Sem alterar o significado.",
  remover_repeticoes:
    "Elimine palavras e expressoes repetidas. Varie o vocabulario quando necessario. Sem modificar a intencao do autor.",
  pontuacao:
    "Corrija exclusivamente a pontuacao. Nao altere palavras, estrutura ou conteudo alem do necessario para a pontuacao correta.",
  humanizar:
    "Faca o texto parecer escrito naturalmente por uma pessoa. Remova construcoes artificiais ou excessivamente roboticas. Mantenha naturalidade, clareza e objetividade. Nunca transforme o texto em algo excessivamente informal.",
};

export function buildTextCorrectPrompt(text: string, mode: string): {
  system: string;
  prompt: string;
} {
  const modeLabel = MODE_LABELS[mode] ?? mode;
  const rules = MODE_RULES[mode] ?? "";

  const system = [
    "Voce e um especialista em revisao e aprimoramento de textos em Portugues do Brasil.",
    "IMPORTANTE: Todo o processamento deve obrigatoriamente utilizar as regras do Portugues Brasileiro (pt-BR), independentemente do idioma, regionalismo ou variante utilizada no texto original.",
    "",
    "REGRAS GERAIS (OBRIGATORIAS):",
    "- Preserve o significado original.",
    "- Preserve a intencao do autor.",
    "- Preserve informacoes importantes.",
    "- Preserve nomes proprios, marcas, URLs, e-mails, numeros e datas.",
    "- Preserve listas.",
    "- Preserve emojis.",
    "- Preserve quebras de linha sempre que possivel.",
    "",
    "Nunca: invente fatos, acrescente informacoes inexistentes, altere o contexto, faca comentarios, explique alteracoes, utilize Markdown, coloque aspas, escreva introducoes ou conclusoes.",
    "",
    "Retorne exclusivamente o texto final processado, sem explicacoes ou comentarios.",
  ].join("\n");

  const prompt = [
    `MODO: ${modeLabel}`,
    "",
    "Instrucoes especificas para este modo:",
    rules,
    "",
    "TEXTO DO USUARIO:",
    text,
  ].join("\n");

  return { system, prompt };
}
