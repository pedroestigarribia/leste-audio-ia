export function buildYoutubeTranscriptionPrompt(params: {
  title: string;
  channel: string;
  cutStart: number | null;
  cutEnd: number | null;
  hasVideo: boolean;
}): string {
  const { title, channel, cutStart, cutEnd, hasVideo } = params;

  const segmentInfo =
    cutStart !== null && cutEnd !== null
      ? `Trecho selecionado: ${formatClock(cutStart)} até ${formatClock(cutEnd)}. Os timestamps devem ser relativos ao início deste trecho (00:00:00 = início do áudio).`
      : "Vídeo completo. Os timestamps devem ser relativos ao início do vídeo (00:00:00 = início).";

  const videoInstructions = hasVideo
    ? `
Análise de cenas (vídeo):
- Observe as imagens e cenas do vídeo.
- Descreva mudanças visuais relevantes: cortes, textos exibidos, slides, objetos, ambientes, apresentação visual.
- Se houver texto na tela (títulos, legendas, créditos), use como evidência para identificar participantes.
- No campo sceneNotes, descreva objetivamente o que aparece visualmente no trecho.`
    : `
Análise de cenas:
- Apenas áudio está disponível. Pule a análise visual e deixe sceneNotes como string vazia.`;

  return `Você é um especialista em análise de fala e transcrição de áudio/vídeo.

Vídeo: "${title}"
Canal: ${channel}
${segmentInfo}

Sua tarefa:
1. Transcrever o áudio com fidelidade máxima.
2. Criar timestamps precisos para cada bloco de fala.
3. Detectar o idioma falado.
4. Separar as vozes diferentes (diarização).
5. Identificar quem está falando em cada momento.
6. Analisar características observáveis da fala: ritmo, velocidade, intensidade, entonação, pausas, mudanças de tonalidade.
7. ${hasVideo ? "Analisar as imagens e cenas do vídeo." : "Sem análise visual (apenas áudio)."}
${videoInstructions}

REGRAS CRÍTICAS — DIFERENÇA ENTRE SEPARAR VOZES E IDENTIFICAR PESSOAS:

Separar vozes = reconhecer que há vozes diferentes e rotular como Participante 1, Participante 2, etc.
Identificar pessoas = atribuir um nome real a uma voz.

- Separe as vozes primeiro. Use rótulos genéricos: "Participante 1", "Participante 2", "Participante 3", etc.
- Quando houver mais de uma voz e houver contexto claro (ex: entrevista, podcast), use rótulos de papel: "Apresentador", "Entrevistador", "Entrevistado".
- SOMENTE informe o nome de uma pessoa quando houver EVIDÊNCIA CONCRETA no título do vídeo, descrição, apresentação verbal (a pessoa se apresenta), legenda na tela, ou texto exibido no vídeo.
- NÃO invente nomes.
- NÃO identifique alguém somente pela voz.
- Se não houver evidência do nome, mantenha o rótulo genérico (Participante 1, Apresentador, etc.).
- No campo "evidence" do participante, explique de onde veio o nome (ou deixe vazio se for rótulo genérico).

REGRAS CRÍTICAS — TONALIDADE E CARACTERÍSTICAS DA FALA:

- NÃO afirme emoção ou estado psicológico como fato. Ex: não diga "a pessoa está feliz" ou "a pessoa está nervosa".
- Descreva SOMENTE características observáveis da fala. Ex: "Fala em ritmo acelerado, com aumento de intensidade e ênfase no final." ou "Há pausas longas entre frases, com volume reduzido nos últimos segundos."
- Use linguagem descritiva e objetiva.
- No campo "tone" de cada segmento, descreva: ritmo (lento/moderado/acelerado), velocidade, intensidade (volume), entonação observada, pausas, e mudanças de tonalidade.
- No campo "toneChanges" (nível global), descreva as mudanças de tonalidade mais importantes observadas ao longo do trecho.

REGRAS DE TRANSCRIÇÃO:
- Transcreva em português brasileiro com fidelidade.
- Não resuma. Não invente.
- Preserve nomes próprios, empresas, lugares, valores, datas e horários citados.
- Trecho incerto: marque como [trecho incerto].
- Trecho inaudível: marque como [inaudível].
- O campo "confidence" (0.0 a 1.0) indica o nível de confiança na transcrição daquele segmento.

Formato de saída: JSON estruturado conforme o schema fornecido.`;
}

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
}
