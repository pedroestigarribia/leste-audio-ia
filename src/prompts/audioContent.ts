import type { AudioContentKind, AudioIntelligenceResult } from "@/types/audio";

const outputInstructions: Record<AudioContentKind, string> = {
  article: "Crie um artigo claro, com título, abertura, desenvolvimento em seções curtas e conclusão prática.",
  businessPlan: "Crie um plano de negócios baseado exclusivamente no que foi identificado: contexto, problema, proposta, público, oportunidades, riscos, ações e dúvidas que ainda precisam de validação.",
  copy: "Crie uma copy persuasiva alinhada ao contexto, sem promessas que não estejam sustentadas pelo material.",
  marketingStrategy: "Crie uma estratégia de marketing prática com objetivo, público, mensagem, canais, ações prioritárias, métricas sugeridas e lacunas que precisam de validação.",
  post: "Crie um post para redes sociais com gancho, desenvolvimento, chamada para ação coerente e linguagem natural.",
  script: "Crie um roteiro narrável, com abertura, blocos de fala, transições e encerramento.",
  storytelling: "Transforme os fatos em storytelling estruturado, preservando o que é conhecido e marcando lacunas como dúvidas.",
  whatsapp: "Crie uma mensagem pronta para WhatsApp, objetiva, cordial e adequada ao contexto identificado.",
  audiobookOutline: "Estruture um plano de audiolivro com título, premissa, capítulos, objetivo de cada capítulo e orientação de narração.",
};

export function buildAudioContentPrompt({
  kind,
  transcription,
  analysis,
}: {
  kind: AudioContentKind;
  transcription: string;
  analysis: AudioIntelligenceResult;
}) {
  return `
Você é um editor de conteúdo em português brasileiro. Use a transcrição e a análise abaixo para gerar conteúdo novo, útil e fiel à fonte.

Formato solicitado: ${outputInstructions[kind]}

Regras:
- Não invente fatos, números, nomes, resultados, promessas ou contexto externo.
- Trate hipóteses, incertezas e lacunas como dúvida.
- Não exponha raciocínio interno.
- Entregue apenas o conteúdo final, em texto simples copiável, sem Markdown, sem asteriscos e sem títulos iniciados por #.

ANÁLISE ESTRUTURADA:
${JSON.stringify(analysis)}

TRANSCRIÇÃO DE ORIGEM:
${transcription}
`;
}
