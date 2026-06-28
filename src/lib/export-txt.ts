import type { AudioItem } from "@/types/audio";
import { normalizePlainText } from "@/lib/plain-text";

type ExportAudioPayload = Pick<AudioItem, "name" | "transcription" | "summary" | "organizedText">;

export type ExportPayload = {
  items: ExportAudioPayload[];
  generalSummary?: string;
  generalOrganizedText?: string;
  generalAnalysis?: string;
  generalTasks?: string;
  generalKeyData?: string;
  generalReply?: string;
  generatedAt?: Date;
};

export type ExportSection = {
  title: string;
  content: string;
};

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
    `AUDIO: ${item.name}`,
    "",
    "TRANSCRICAO:",
    normalizePlainText(item.transcription ?? "") || "(sem transcricao)",
    "",
    "RESUMO:",
    normalizePlainText(item.summary ?? "") || "(sem resumo)",
    "",
    "CONTEUDO ORGANIZADO:",
    normalizePlainText(item.organizedText ?? "") || "(sem organizacao)",
  ].join("\n");
}

export function buildTranscriptionsOnlyText(items: ExportAudioPayload[], generatedAt = new Date()) {
  const sections = items
    .filter((item) => item.transcription?.trim())
    .map((item) =>
      [
        "========================",
        `AUDIO: ${item.name}`,
        "",
        "TRANSCRICAO:",
        normalizePlainText(item.transcription ?? ""),
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "LESTE AUDIO IA",
    `DATA: ${generatedAt.toLocaleString("pt-BR")}`,
    "",
    sections || "========================\nNenhuma transcricao disponivel.",
  ].join("\n");
}

export function buildOrganizedExportText({
  generalSummary,
  generalOrganizedText,
  generalAnalysis,
  generalTasks,
  generalKeyData,
  generalReply,
  generatedAt = new Date(),
}: Omit<ExportPayload, "items">) {
  const sections: ExportSection[] = [
    {
      title: "RESUMO GERAL",
      content: normalizePlainText(generalSummary ?? "") || "(sem resumo geral)",
    },
    {
      title: "ORGANIZACAO GERAL",
      content: normalizePlainText(generalOrganizedText ?? "") || "(sem organizacao geral)",
    },
    {
      title: "INTERPRETACAO GERAL",
      content: normalizePlainText(generalAnalysis ?? "") || "(sem interpretacao geral)",
    },
    {
      title: "TAREFAS E PENDENCIAS",
      content: normalizePlainText(generalTasks ?? "") || "(sem tarefas extraidas)",
    },
    {
      title: "DADOS-CHAVE",
      content: normalizePlainText(generalKeyData ?? "") || "(sem dados-chave)",
    },
    {
      title: "RESPOSTA PRONTA PARA WHATSAPP",
      content: normalizePlainText(generalReply ?? "") || "(sem resposta pronta)",
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
  generalTasks,
  generalKeyData,
  generalReply,
  generatedAt = new Date(),
}: ExportPayload) {
  const audioSections = items
    .map((item) => ["========================", buildSingleAudioExportSection(item)].join("\n"))
    .join("\n\n");

  return [
    "LESTE AUDIO IA",
    `DATA: ${generatedAt.toLocaleString("pt-BR")}`,
    "",
    audioSections || "========================\nNenhum audio processado.",
    "",
    "========================",
    "RESUMO GERAL",
    "",
    normalizePlainText(generalSummary ?? "") || "(sem resumo geral)",
    "",
    "========================",
    "ORGANIZACAO GERAL",
    "",
    normalizePlainText(generalOrganizedText ?? "") || "(sem organizacao geral)",
    "",
    "========================",
    "ANALISE GERAL",
    "",
    normalizePlainText(generalAnalysis ?? "") || "(sem analise geral)",
    "",
    "========================",
    "TAREFAS E PENDENCIAS",
    "",
    normalizePlainText(generalTasks ?? "") || "(sem tarefas extraidas)",
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
  ].join("\n");
}

export function buildExportFileBaseName(date = new Date()) {
  const { year, month, day, hours, minutes } = formatDateTimeParts(date);
  return `transcricoes-leste-audio-ia-${year}-${month}-${day}-${hours}-${minutes}`;
}

export function buildExportFileName(date = new Date()) {
  return `${buildExportFileBaseName(date)}.txt`;
}
