export function buildVideoTranscriptionPrompt(params: { title: string; durationSec: number }) {
  return `
Transcreva e analise o áudio do vídeo em português brasileiro. Retorne apenas JSON válido.

Vídeo: ${params.title}
Duração aproximada: ${Math.round(params.durationSec)} segundos

Regras:
- Preserve o sentido original e marque trechos inaudíveis como [inaudível].
- Crie segmentos com início e fim em segundos, sem sobreposição e em ordem crescente.
- Separe participantes como Participante 1, Participante 2 e assim por diante quando houver evidência de troca de voz.
- Não invente nomes, falas, timestamps ou cenas.
- Os timestamps podem ser por segmento. A lista words deve ficar vazia quando não for possível identificar o tempo de cada palavra com segurança.
- Identifique perguntas, respostas, CTAs, histórias, insights e frases fortes apenas quando houver evidência.
- O campo tone deve descrever somente características audíveis, sem afirmar estados mentais.

Estrutura obrigatória:
{
  "language": "pt-BR",
  "segments": [
    {
      "id": "seg-1",
      "start": 0,
      "end": 10,
      "text": "",
      "speakerId": "p1",
      "confidence": 0.8,
      "words": []
    }
  ],
  "participants": [
    { "id": "p1", "label": "Participante 1", "confidence": 0.7, "speakingTime": 10 }
  ],
  "semanticHints": [
    {
      "segmentId": "seg-1",
      "topic": "",
      "subtopics": [],
      "hasQuestion": false,
      "hasAnswer": false,
      "hasCTA": false,
      "hasStory": false,
      "hasInsight": false,
      "hasStrongStatement": false,
      "emotion": "",
      "sentiment": ""
    }
  ]
}
`;
}
