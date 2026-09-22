import { normalizePlainText } from "@/lib/plain-text";

export type AskSourceChunk = {
  chunkId: string;
  text: string;
  speakerLabel?: string;
  startSeconds?: number;
  endSeconds?: number;
};

export type AskSource = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  chunks: AskSourceChunk[];
};

export function buildAskFilesPrompt(question: string, sources: AskSource[]) {
  const context = sources
    .map((source) => {
      const chunks = source.chunks
        .map(
          (chunk) =>
            `[${source.sourceId}/${chunk.chunkId}]${chunk.speakerLabel ? ` Falante: ${chunk.speakerLabel}.` : ""}${typeof chunk.startSeconds === "number" ? ` Tempo: ${chunk.startSeconds}s-${chunk.endSeconds ?? "?"}s.` : ""}\n${normalizePlainText(chunk.text)}`,
        )
        .join("\n\n");
      return `FONTE: ${source.sourceName} (${source.sourceType})\n${chunks}`;
    })
    .join("\n\n========================\n\n");

  return {
    system:
      "Você responde perguntas usando exclusivamente as fontes fornecidas, em português brasileiro. Nunca invente fatos ou citações. Responda somente JSON válido.",
    prompt: `Pergunta: ${normalizePlainText(question)}

Responda com base apenas no conteúdo abaixo. Diferencie fatos encontrados de inferências. Se não houver base suficiente, escreva isso em notFound. Toda afirmação factual relevante deve citar ao menos um trecho disponível.

Retorne somente este JSON:
{
  "answer": "resposta direta",
  "facts": ["fato"],
  "inferences": ["inferência explicitamente marcada"],
  "notFound": ["o que não foi localizado"],
  "references": [
    {"sourceId":"id da fonte", "chunkId":"id do trecho", "quote":"trecho curto que sustenta a resposta"}
  ]
}

FONTES:\n${context}`,
  };
}
