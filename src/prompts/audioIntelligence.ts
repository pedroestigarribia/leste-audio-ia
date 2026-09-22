export const AUDIO_INTELLIGENCE_PROMPT = `
Analise o arquivo de áudio ou vídeo recebido em português brasileiro. O objetivo é compreender o conteúdo, sem inventar fatos, e preparar uma base confiável para criação de textos e narrativas.

Regras obrigatórias:
- Use somente informações observáveis no arquivo. Quando algo não estiver claro, deixe a informação fora ou registre como dúvida.
- Não atribua emoções, intenções, características pessoais ou dados sensíveis sem evidência explícita.
- Identifique o assunto, o contexto e a intenção principal de forma objetiva.
- Extraia tarefas, decisões, nomes, empresas, datas, valores e links somente quando estiverem claramente citados.
- Para cada tarefa e decisão, use "evidence" para citar brevemente o trecho que sustenta a extração. Se não houver, deixe a lista vazia.
- "confidence" é um inteiro de 0 a 100 sobre a classificação do assunto e intenção, não sobre a veracidade das falas.
- "suggestedContents" deve propor usos editoriais coerentes com o material, sem afirmar que o conteúdo original contém informações que não contém.
- "narrative" é uma estrutura editorial inspirada pelos fatos narrados, não uma história inventada. Caso o arquivo não tenha narrativa suficiente, use strings vazias e chapters vazio.
- Use texto direto, natural e copiável. Não use Markdown, asteriscos ou títulos com #.
- Quando houver mais de uma voz claramente distinguível, inclua "diarization" com falantes e segmentos. Só preencha startSeconds e endSeconds quando conseguir estimar os tempos a partir do próprio arquivo; marque timingApproximate como true nesses casos. Não invente nomes reais: use Pessoa 1, Pessoa 2 ou Falante não identificado.
`;

export function buildTranscriptionIntelligencePrompt(transcription: string) {
  return `
Analise a transcrição abaixo em português brasileiro. A transcrição veio de um áudio já processado e deve ser a única fonte de fatos.

${AUDIO_INTELLIGENCE_PROMPT}

Retorne somente um JSON válido, sem Markdown, seguindo exatamente esta estrutura:
{
  "subject": "",
  "context": "",
  "language": "pt-BR",
  "primaryIntent": "",
  "confidence": 0,
  "summary": "",
  "topics": [],
  "keyPoints": [],
  "insights": [],
  "tasks": [{ "title": "", "owner": "", "dueDate": "", "evidence": "" }],
  "decisions": [{ "text": "", "evidence": "" }],
  "entities": { "people": [], "companies": [], "dates": [], "values": [], "links": [] },
  "opportunities": [],
  "risks": [],
  "questions": [],
  "suggestedContents": [{ "type": "", "title": "", "purpose": "" }],
  "narrative": {
    "title": "",
    "premise": "",
    "beginning": "",
    "middle": "",
    "ending": "",
    "chapters": [{ "title": "", "synopsis": "" }]
  },
  "diarization": {
    "speakers": [{ "id": "speaker-1", "label": "Pessoa 1", "confidence": 0, "unverified": false }],
    "segments": [{ "id": "segment-1", "text": "", "startSeconds": 0, "endSeconds": 0, "speakerId": "speaker-1", "speakerLabel": "Pessoa 1", "confidence": 0, "timingApproximate": true }]
  }
}

Para listas sem elementos, use []. Não invente itens apenas para preencher a estrutura.

TRANSCRIÇÃO:
${transcription}
`;
}
