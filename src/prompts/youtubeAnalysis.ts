import type { YoutubeSegment } from "@/types/youtube";

export function buildYoutubeAnalysisPrompt(params: {
  title: string;
  channel: string;
  segments: YoutubeSegment[];
  language: string;
  sceneNotes: string;
}): string {
  const { title, channel, segments, language, sceneNotes } = params;

  const transcriptionBlock = segments
    .map((seg) => {
      const start = formatClock(seg.startTime);
      const end = formatClock(seg.endTime);
      return `[${start} - ${end}]
Participante: ${seg.participant}
Texto: ${seg.text}
Tonalidade: ${seg.tone}
Confiança: ${(seg.confidence * 100).toFixed(0)}%`;
    })
    .join("\n\n");

  return `Você é um especialista em análise de conteúdo, comunicação e linguagem.

Analise a transcrição estruturada abaixo e produza os resultados solicitados.

Vídeo: "${title}"
Canal: ${channel}
Idioma detectado: ${language}

Notas de cena: ${sceneNotes || "(sem análise visual)"}

TRANSCRIÇÃO ESTRUTURADA:

${transcriptionBlock}

---

Produza os resultados no formato exato abaixo, usando os marcadores indicados. Cada marcador deve aparecer em uma linha própria, seguido do conteúdo. Não adicione texto antes do primeiro marcador.

===TRANSCRICAO_REVISADA===
Revise e organize a transcrição. Corrija erros óbvios de transcrição, melhore a pontuação e a separação de falas, mas NÃO altere o sentido. Mantenha os timestamps no formato [HH:MM:SS - HH:MM:SS].

===RESUMO===
Resuma o conteúdo de forma objetiva. Inclua os pontos principais, ideias centrais e informações mais relevantes.

===INTERPRETACAO===
Interprete o conteúdo. Explique o contexto, a intenção comunicativa observável (sem afirmar estado psicológico como fato), os argumentos utilizados e o que cada participante parece defender ou expor.

===ASSUNTOS===
Separe e liste os assuntos abordados, agrupando por tema. Para cada assunto, indique o intervalo de tempo aproximado.

===FRASES_IMPORTANTES===
Identifique as frases mais importantes, impactantes ou representativas do trecho. Cite cada frase entre aspas e indique o participante e o timestamp.

===ESTILO_LINGUAGEM===
Analise o estilo de linguagem observado. Descreva: registro (formal/informal), vocabulário, uso de gírias, repetições, recursos retóricos, clareza, coesão. Compare os estilos entre os participantes quando houver mais de um.

===PERFIL_COMUNICACAO===
Crie um perfil de comunicação para cada participante (ou para o conjunto, se houver apenas um). Descreva: ritmo de fala, clareza, objetividade, uso de pausas, tendências de argumentação, traços observáveis. NÃO afirme emoções ou estados psicológicos como fato.

===CONTEUDO_GERADO===
Gere conteúdo prático a partir do vídeo:
- Um roteiro resumido para repostagem.
- Uma versão em post para Instagram (carrossel de 3-5 slides).
- Uma legenda curta para o vídeo.
- Sugestões de título alternativo.
Adapte o tom ao conteúdo original.

REGRAS:
- Não invente informações que não estejam na transcrição.
- Não afirme emoção ou estado psicológico como fato.
- Descreva apenas características observáveis.
- Use português brasileiro natural.
- Não use markdown com **, ##, tabelas ou blocos de código.
- Entregue texto puro e bem estruturado.`;
}

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
}
