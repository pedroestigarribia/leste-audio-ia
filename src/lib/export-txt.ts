import type { AudioItem, AudioIntelligenceResult } from "@/types/audio";
import { normalizePlainText } from "@/lib/plain-text";

type ExportAudioPayload = Pick<
  AudioItem,
  "name" | "transcription" | "summary" | "organizedText" | "audioIntelligence" | "generatedContents" | "segments"
>;

export type ExportPayload = {
  items: ExportAudioPayload[];
  generalSummary?: string;
  generalOrganizedText?: string;
  generalAnalysis?: string;
  generalIntent?: string;
  generalTasks?: string;
  generalKeyData?: string;
  generalReply?: string;
  promptResult?: string;
  generatedAt?: Date;
};

export type ExportSection = {
  title: string;
  content: string;
};

function formatAudioIntelligence(analysis?: AudioIntelligenceResult) {
  if (!analysis) {
    return "(sem interpretação automática)";
  }

  const tasks = analysis.tasks.length
    ? analysis.tasks
        .map((task) =>
          [
            task.title,
            task.owner && `Responsável: ${task.owner}`,
            task.dueDate && `Prazo: ${task.dueDate}`,
            task.evidence && `Base: ${task.evidence}`,
          ]
            .filter(Boolean)
            .join(" | "),
        )
        .join("\n")
    : "Nenhuma tarefa identificada.";
  const decisions = analysis.decisions.length
    ? analysis.decisions
        .map((decision) => [decision.text, decision.evidence && `Base: ${decision.evidence}`].filter(Boolean).join(" | "))
        .join("\n")
    : "Nenhuma decisão identificada.";
  const suggestedContents = analysis.suggestedContents.length
    ? analysis.suggestedContents
        .map((content) => [content.type, content.title, content.purpose].filter(Boolean).join(": "))
        .join("\n")
    : "Nenhum conteúdo sugerido.";
  const narrativeChapters = analysis.narrative.chapters.length
    ? analysis.narrative.chapters
        .map((chapter) => [chapter.title, chapter.synopsis].filter(Boolean).join(": "))
        .join("\n")
    : "Nenhum capítulo identificado.";

  return [
    `Assunto: ${analysis.subject}`,
    `Contexto: ${analysis.context}`,
    `Idioma: ${analysis.language}`,
    `Intenção: ${analysis.primaryIntent}`,
    `Confiança: ${analysis.confidence}%`,
    "",
    "Resumo da análise:",
    analysis.summary,
    "",
    "Temas:",
    analysis.topics.join("\n") || "Nenhum tema identificado.",
    "",
    "Pontos principais:",
    analysis.keyPoints.join("\n") || "Nenhum ponto identificado.",
    "",
    "Insights:",
    analysis.insights.join("\n") || "Nenhum insight identificado.",
    "",
    "Tarefas:",
    tasks,
    "",
    "Decisões:",
    decisions,
    "",
    "Oportunidades:",
    analysis.opportunities.join("\n") || "Nenhuma oportunidade identificada.",
    "",
    "Riscos:",
    analysis.risks.join("\n") || "Nenhum risco identificado.",
    "",
    "Dúvidas:",
    analysis.questions.join("\n") || "Nenhuma dúvida identificada.",
    "",
    "Dados-chave:",
    `Pessoas: ${analysis.entities.people.join(", ") || "não identificado"}`,
    `Empresas: ${analysis.entities.companies.join(", ") || "não identificado"}`,
    `Datas: ${analysis.entities.dates.join(", ") || "não identificado"}`,
    `Valores: ${analysis.entities.values.join(", ") || "não identificado"}`,
    `Links: ${analysis.entities.links.join(", ") || "não identificado"}`,
    "",
    "Conteúdos sugeridos:",
    suggestedContents,
    "",
    "Estrutura narrativa:",
    `Título: ${analysis.narrative.title || "não identificado"}`,
    `Premissa: ${analysis.narrative.premise || "não identificada"}`,
    `Início: ${analysis.narrative.beginning || "não identificado"}`,
    `Desenvolvimento: ${analysis.narrative.middle || "não identificado"}`,
    `Encerramento: ${analysis.narrative.ending || "não identificado"}`,
    "Capítulos:",
    narrativeChapters,
  ].join("\n");
}

function formatGeneratedContents(item: ExportAudioPayload) {
  const contents = Object.entries(item.generatedContents ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));

  if (!contents.length) {
    return "(nenhum conteúdo derivado gerado)";
  }

  return contents.map(([kind, text]) => `${kind.toUpperCase()}:\n${normalizePlainText(text)}`).join("\n\n");
}

function formatSegments(item: ExportAudioPayload) {
  if (!item.segments?.length) return "(sem identificação de falantes ou marcação temporal disponível)";
  return item.segments.map((segment) => {
    const start = typeof segment.startSeconds === "number" ? `${segment.startSeconds}s` : "tempo não disponível";
    const end = typeof segment.endSeconds === "number" ? ` - ${segment.endSeconds}s` : "";
    return `${segment.speakerLabel || "Falante não identificado"} | ${start}${end}\n${normalizePlainText(segment.text)}`;
  }).join("\n\n");
}

function formatDateTimeParts(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return {
    year: date.getFullYear(),
    month: pad(date.getMonth() + 1),
    day: pad(date.getDate()),
    hours: pad(date.getHours()),
    minutes: pad(date.getMinutes()),
  };
}

export function buildSingleAudioExportSection(item: ExportAudioPayload) {
  return [
    `ÁUDIO: ${item.name}`,
    "",
    "TRANSCRIÇÃO:",
    normalizePlainText(item.transcription ?? "") || "(sem transcrição)",
    "",
    "RESUMO:",
    normalizePlainText(item.summary ?? "") || "(sem resumo)",
    "",
    "CONTEÚDO ORGANIZADO:",
    normalizePlainText(item.organizedText ?? "") || "(sem organização)",
    "",
    "FALANTES E TRECHOS:",
    formatSegments(item),
    "",
    "INTERPRETAÇÃO AUTOMÁTICA:",
    formatAudioIntelligence(item.audioIntelligence),
    "",
    "CONTEÚDOS DERIVADOS:",
    formatGeneratedContents(item),
  ].join("\n");
}

export function buildTranscriptionsOnlyText(items: ExportAudioPayload[], generatedAt = new Date()) {
  const sections = items
    .filter((item) => item.transcription?.trim())
    .map((item) =>
      [
        "========================",
        `ÁUDIO: ${item.name}`,
        "",
        "TRANSCRIÇÃO:",
        normalizePlainText(item.transcription ?? ""),
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "LESTE AUDIO IA",
    `DATA: ${generatedAt.toLocaleString("pt-BR")}`,
    "",
    sections || "========================\nNenhuma transcrição disponível.",
  ].join("\n");
}

export function buildOrganizedExportText({
  generalSummary,
  generalOrganizedText,
  generalAnalysis,
  generalIntent,
  generalTasks,
  generalKeyData,
  generalReply,
  promptResult,
  generatedAt = new Date(),
}: Omit<ExportPayload, "items">) {
  const sections: ExportSection[] = [
    {
      title: "RESUMO GERAL",
      content: normalizePlainText(generalSummary ?? "") || "(sem resumo geral)",
    },
    {
      title: "ORGANIZAÇÃO GERAL",
      content: normalizePlainText(generalOrganizedText ?? "") || "(sem organização geral)",
    },
    {
      title: "INTERPRETAÇÃO GERAL",
      content: normalizePlainText(generalAnalysis ?? "") || "(sem interpretação geral)",
    },
    {
      title: "TAREFAS E PENDÊNCIAS",
      content: normalizePlainText(generalTasks ?? "") || "(sem tarefas extraídas)",
    },
    {
      title: "DADOS-CHAVE",
      content: normalizePlainText(generalKeyData ?? "") || "(sem dados-chave)",
    },
    {
      title: "RESPOSTA PRONTA PARA WHATSAPP",
      content: normalizePlainText(generalReply ?? "") || "(sem resposta pronta)",
    },
    {
      title: "INTENÇÃO CONSOLIDADA E RECOMENDAÇÕES",
      content: normalizePlainText(generalIntent ?? "") || "(sem intenção consolidada)",
    },
    {
      title: "PROMPT FINAL",
      content: normalizePlainText(promptResult ?? "") || "(sem prompt final)",
    },
  ];

  return [
    "LESTE AUDIO IA",
    `DATA: ${generatedAt.toLocaleString("pt-BR")}`,
    "",
    ...sections.flatMap((section) => ["========================", section.title, "", section.content, ""]),
  ]
    .join("\n")
    .trim();
}

export function buildExportText({
  items,
  generalSummary,
  generalOrganizedText,
  generalAnalysis,
  generalIntent,
  generalTasks,
  generalKeyData,
  generalReply,
  promptResult,
  generatedAt = new Date(),
}: ExportPayload) {
  const audioSections = items
    .map((item) => ["========================", buildSingleAudioExportSection(item)].join("\n"))
    .join("\n\n");

  return [
    "LESTE AUDIO IA",
    `DATA: ${generatedAt.toLocaleString("pt-BR")}`,
    "",
    audioSections || "========================\nNenhum áudio processado.",
    "",
    "========================",
    "RESUMO GERAL",
    "",
    normalizePlainText(generalSummary ?? "") || "(sem resumo geral)",
    "",
    "========================",
    "ORGANIZAÇÃO GERAL",
    "",
    normalizePlainText(generalOrganizedText ?? "") || "(sem organização geral)",
    "",
    "========================",
    "ANÁLISE GERAL",
    "",
    normalizePlainText(generalAnalysis ?? "") || "(sem análise geral)",
    "",
    "TAREFAS E PENDÊNCIAS",
    "",
    normalizePlainText(generalTasks ?? "") || "(sem tarefas extraídas)",
    "",
    "========================",
    "DADOS-CHAVE",
    "",
    normalizePlainText(generalKeyData ?? "") || "(sem dados-chave)",
    "",
    "========================",
    "RESPOSTA PRONTA PARA WHATSAPP",
    "",
    normalizePlainText(generalReply ?? "") || "(sem resposta pronta)",
    "",
    "========================",
    "INTENÇÃO CONSOLIDADA E RECOMENDAÇÕES",
    "",
    normalizePlainText(generalIntent ?? "") || "(sem intenção consolidada)",
    "",
    "========================",
    "PROMPT FINAL",
    "",
    normalizePlainText(promptResult ?? "") || "(sem prompt final)",
  ].join("\n");
}

export function buildExportFileBaseName(date = new Date()) {
  const { year, month, day, hours, minutes } = formatDateTimeParts(date);
  return `transcricoes-leste-audio-ia-${year}-${month}-${day}-${hours}-${minutes}`;
}

export function buildExportFileName(date = new Date()) {
  return `${buildExportFileBaseName(date)}.txt`;
}
