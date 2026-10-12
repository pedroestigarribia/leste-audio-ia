import type { AnalyzeAllItem, SessionNarrativeFormat } from "@/types/audio";
import { normalizePlainText } from "@/lib/plain-text";

const formatLabels: Record<SessionNarrativeFormat, string> = {
  faithful: "relato fiel, preservando o tom original",
  chronological: "relato cronológico",
  biography: "biografia",
  storytelling: "storytelling natural e humano",
  script: "roteiro",
  professionalProfile: "perfil profissional",
  report: "reportagem ou relatório",
  whatsapp: "texto natural para WhatsApp",
};

export function buildSessionNarrativePrompt(items: AnalyzeAllItem[], format: SessionNarrativeFormat) {
  const sourceText = items.map((item, index) =>
    `FONTE ${index + 1}: ${item.name}\nCONTEÚDO:\n${normalizePlainText(item.transcription)}`,
  ).join("\n\n========================\n\n");

  return `Crie uma narrativa em português brasileiro no formato: ${formatLabels[format]}.

Use todo o conteúdo recebido. Preserve fatos, nomes, datas, relações, acontecimentos, decisões e ressalvas. Não invente eventos para preencher lacunas. Quando uma conexão entre relatos for editorial e não explícita, marque-a como [Transição editorial sugerida]. Indique a fonte pelo nome do áudio junto a fatos relevantes, sem atribuir uma informação à fonte errada.

Quando houver material suficiente, use título, contexto inicial, desenvolvimento, pontos de virada e conclusão. Se as fontes forem independentes ou a ordem não puder ser confirmada, mantenha os blocos separados e informe a dúvida. Preserve o tom informal quando fizer sentido; não deixe o texto artificial.

Retorne somente o texto final, sem **, ##, tabelas ou blocos de código.

FONTES COMPLETAS:\n${sourceText}`;
}
