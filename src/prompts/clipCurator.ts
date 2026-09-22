import type { ClipPreferences, SemanticSegment, VideoMetadata } from "@/types/video";

export function buildClipCuratorPrompt(params: {
  metadata: VideoMetadata;
  segments: SemanticSegment[];
  preferences: ClipPreferences;
}) {
  const { metadata, segments, preferences } = params;
  return `
Você é um curador editorial de cortes para vídeos sociais. Encontre trechos independentes e fiéis ao conteúdo original.

Não prometa viralização. Use somente o conceito de potencial de retenção heurístico.
Não altere fatos, não invente falas e não retire frases de um contexto que mude seu sentido.
Priorize começo forte, desenvolvimento suficiente e final semântico completo.

Metadados:
${JSON.stringify(metadata)}

Preferências:
${JSON.stringify(preferences)}

Transcrição segmentada:
${JSON.stringify(segments)}

Retorne somente um array JSON válido. Gere até ${preferences.desiredCount ?? 8} candidatos diferentes.
Cada item deve seguir:
{
  "id": "candidate-1",
  "startTime": 0,
  "endTime": 60,
  "duration": 60,
  "title": "",
  "hook": "",
  "summary": "",
  "category": "",
  "topic": "",
  "retentionScore": 0,
  "retentionBreakdown": {
    "hook": 0,
    "narrativeFlow": 0,
    "standaloneClarity": 0,
    "practicalValue": 0,
    "emotionalStrength": 0,
    "memorableStatement": 0,
    "endingQuality": 0,
    "transcriptQuality": 0
  },
  "reason": "",
  "suggestedCaption": "",
  "suggestedCopy": "",
  "hashtags": [],
  "participants": [],
  "transcriptExcerpt": "",
  "sceneIds": [],
  "hasCTA": false,
  "hasQuestion": false,
  "hasStory": false,
  "hasInsight": false,
  "warnings": [],
  "confidence": 0
}
`;
}
