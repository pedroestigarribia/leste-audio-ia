import { normalizePlainText } from "@/lib/plain-text";

type SequenceItem = {
  id: string;
  name: string;
  transcription: string;
};

export function buildOrganizeSequencePrompt(items: SequenceItem[]) {
  const sourceText = items
    .map(
      (item, index) =>
        `ARQUIVO ${index + 1}\nID: ${item.id}\nNOME: ${item.name}\nTRANSCRIÇÃO:\n${normalizePlainText(item.transcription)}`,
    )
    .join("\n\n========================\n\n");

  return {
    system:
      "Você organiza relatos em português brasileiro. Preserve fatos, não invente conexões e responda somente JSON válido.",
    prompt: `Analise os arquivos abaixo. Eles podem estar fora de ordem, conter continuações da mesma fala, mudanças de assunto ou duplicações.

Crie uma proposta de grupos narrativos. Cada ID de arquivo deve aparecer uma única vez em groups.itemIds. Arquivos sem relação devem ficar em grupos próprios. A ordenação deve seguir a continuidade provável do conteúdo, não a data do nome do arquivo.

Retorne somente este JSON:
{
  "groups": [
    {
      "id": "grupo-1",
      "title": "Título curto do tema",
      "itemIds": ["id"],
      "explanation": "Relação e ordem sugerida sem afirmar certeza indevida",
      "confidence": 0
    }
  ],
  "warnings": ["Dúvidas, lacunas ou arquivos aparentemente independentes"]
}

Use confidence entre 0 e 100. Não inclua IDs inexistentes.

ARQUIVOS:\n${sourceText}`,
  };
}
