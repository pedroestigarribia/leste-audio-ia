"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Copy, Download, FileDown, FileUp, Headphones, LoaderCircle, Mic2, PenLine, Users, WandSparkles, CircleHelp, CheckCircle2, RotateCcw } from "lucide-react";
import { strToU8, zipSync } from "fflate";
import { nanoid } from "nanoid";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import { prepareSessionBatches } from "@/lib/session-batches";
import type { AnalyzeAllItem } from "@/types/audio";
import type { ChapterWorkflowStatus, EditorialChapter, EditorialMemory, EditorialWorkflowSnapshot, MeetingAction } from "@/types/local-project";

type WorkflowMode = "women-biography" | "full-biography" | "meeting";
type NarratorMode = "subject-first-person" | "ghostwriter-third-person";
type TaskMode = "detect-project-type" | "biography-outline" | "biography-chapter" | "biography-chapter-preview" | "meeting-analysis" | "biography-memory" | "biography-followups" | "meeting-followups" | "meeting-actions" | "editorial-quality" | "biography-rewrite-passage" | "narration-review";
type ConsolidationMode = "biography-outline-merge" | "biography-chapter-merge" | "meeting-analysis-merge";

type WorkflowSource = {
  id?: string;
  name: string;
  transcription: string;
  interviewQuestion?: string;
  chapterNumber?: number | null;
};

const EMPTY_MEMORY: EditorialMemory = {
  people: "", relationships: "", timeline: "", events: "", reportedFacts: "",
  confirmedFacts: "", inferences: "", voiceAndTone: "", openQuestions: "",
  characteristicQuotes: "", conflicts: "", milestones: "", factOwnership: "",
};

function makeChapter(title = "", text = "", status: ChapterWorkflowStatus = "draft", sourceIds: string[] = []): EditorialChapter {
  return { title, text, status, sourceIds, revisions: [], narrationText: "", narrationSourceFingerprint: "" };
}

function normalizeEditorialChapters(value: unknown): Record<string, EditorialChapter> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([number, entry]) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.title !== "string" || typeof candidate.text !== "string") return [];
    const statuses: ChapterWorkflowStatus[] = ["planned", "draft", "review", "approved"];
    const revisions = Array.isArray(candidate.revisions) ? candidate.revisions.flatMap((revision) => {
      if (!revision || typeof revision !== "object") return [];
      const item = revision as Record<string, unknown>;
      return typeof item.text === "string" ? [{ text: item.text, savedAt: typeof item.savedAt === "string" ? item.savedAt : "", reason: typeof item.reason === "string" ? item.reason : undefined }] : [];
    }) : [];
    return [[number, {
      title: candidate.title.slice(0, 300), text: candidate.text,
      status: statuses.includes(candidate.status as ChapterWorkflowStatus) ? candidate.status as ChapterWorkflowStatus : "draft",
      sourceIds: Array.isArray(candidate.sourceIds) ? candidate.sourceIds.filter((id): id is string => typeof id === "string") : [],
      revisions,
      narrationText: typeof candidate.narrationText === "string" ? candidate.narrationText : "",
      narrationSourceFingerprint: typeof candidate.narrationSourceFingerprint === "string" ? candidate.narrationSourceFingerprint : "",
    } satisfies EditorialChapter]];
  }));
}

type ProjectFile = {
  format: "leste-audio-ia-project";
  version: 1;
  savedAt: string;
  mode: WorkflowMode;
  title: string;
  subject: string;
  chapterCount: number;
  narrator: NarratorMode;
  editorialNotes: string;
  continuityNotes: string;
  outline: string;
  chapters: Record<string, EditorialChapter>;
  collectionGuide?: string;
  womenMethod10?: boolean;
  outlineApproved?: boolean;
  outlineApprovedFingerprint?: string;
  sourceSelection?: Record<string, boolean>;
  sourceRoles?: Record<string, "original" | "editor" | "derived">;
  projectSuggestion?: EditorialWorkflowSnapshot["projectSuggestion"];
  memory?: EditorialMemory;
  followUpQuestions?: string;
  meetingActions?: MeetingAction[];
  qualityReport?: string;
  sourceGuides?: Record<string, { question: string; chapterNumber: string }>;
  narrationMode?: "faithful" | "natural" | "adapted";
  pronunciationNotes?: string;
  chapterSelection?: Record<string, boolean>;
  meetingReport: string;
  sources: WorkflowSource[];
  outlineSourceFingerprint?: string;
  chapterSourceFingerprints?: Record<string, string>;
  meetingSourceFingerprint?: string;
};

const WORKFLOW_MODES: Array<{ id: WorkflowMode; title: string; detail: string; icon: typeof BookOpen }> = [
  { id: "women-biography", title: "Biografia Mulheres do Leste", detail: "Projeto editorial de 5 a 10 capítulos.", icon: BookOpen },
  { id: "full-biography", title: "Biografia completa", detail: "História de vida estruturada em até 30 capítulos.", icon: BookOpen },
  { id: "meeting", title: "Reunião de trabalho", detail: "Intenção, assuntos, decisões, tarefas e próximos passos.", icon: Users },
];

const TASK_LABELS: Record<TaskMode | ConsolidationMode, string> = {
  "detect-project-type": "Identificando o tipo de material",
  "biography-outline": "Montando o plano do livro",
  "biography-outline-merge": "Consolidando o plano do livro",
  "biography-chapter": "Escrevendo o capítulo",
  "biography-chapter-preview": "Preparando uma prévia do capítulo",
  "biography-chapter-merge": "Unindo as partes do capítulo",
  "meeting-analysis": "Analisando a reunião",
  "meeting-analysis-merge": "Consolidando a reunião",
  "biography-memory": "Atualizando a memória editorial",
  "biography-followups": "Preparando perguntas complementares",
  "meeting-followups": "Preparando perguntas de acompanhamento",
  "meeting-actions": "Extraindo encaminhamentos da reunião",
  "editorial-quality": "Conferindo a entrega editorial",
  "biography-rewrite-passage": "Revisando o trecho selecionado",
  "narration-review": "Preparando o texto para narração",
};

function isWorkflowMode(value: unknown): value is WorkflowMode {
  return value === "women-biography" || value === "full-biography" || value === "meeting";
}

function normalizeProjectSources(sources: unknown): WorkflowSource[] {
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((source) => {
    if (!source || typeof source !== "object") return [];
    const candidate = source as Record<string, unknown>;
    if (typeof candidate.name !== "string" || typeof candidate.transcription !== "string" || !candidate.transcription.trim()) return [];
    const chapterNumber = typeof candidate.chapterNumber === "number" && Number.isInteger(candidate.chapterNumber) && candidate.chapterNumber > 0
      ? candidate.chapterNumber
      : null;
    return [{
      id: typeof candidate.id === "string" ? candidate.id : undefined,
      name: candidate.name.slice(0, 300),
      transcription: candidate.transcription,
      interviewQuestion: typeof candidate.interviewQuestion === "string" ? candidate.interviewQuestion.slice(0, 1_000) : "",
      chapterNumber,
    }];
  });
}

function normalizeChapterDrafts(value: unknown) {
  return normalizeEditorialChapters(value);
}

function cleanNarrationText(value: string) {
  const body = value.split(/\n\s*(?:Pontos para confirmar|Fontes e observações editoriais)\s*:?\s*\n/i)[0];
  return body
    .replace(/\[(?:Fonte|Transição editorial sugerida|Fala original|Interpretação da IA|Sugestão narrativa):?[^\]]*\]/gi, "")
    .replace(/^\s*(?:Fonte|Referência|Observação editorial)\s*:\s*.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanBookText(value: string) {
  return cleanNarrationText(value).replace(/^\s*#{1,6}\s*/gm, "").replace(/\*\*/g, "").trim();
}

function chapterTitleFromOutline(outline: string, number: number) {
  const heading = new RegExp(`^\\s*(?:#{1,6}\\s*)?cap[ií]tulo\\s+${number}\\s*[—–:-]\\s*`, "i");
  const line = outline.split(/\r?\n/).find((part) => heading.test(part.replace(/\*\*/g, "")));
  return line?.replace(/\*\*/g, "").replace(heading, "").trim() ?? "";
}

function chapterNarrationText(chapter: EditorialChapter) {
  return cleanNarrationText(chapter.narrationText?.trim() || chapter.text);
}

function applyPronunciationReplacements(text: string, notes: string) {
  let output = text;
  for (const line of notes.split(/\r?\n/)) {
    const match = /^\s*(?:original\s*:\s*)?(.+?)\s*(?:->|=>|\|)\s*(?:pron[uú]ncia\s*:\s*)?(.+?)\s*$/i.exec(line);
    if (!match) continue;
    output = output.replace(new RegExp(match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), match[2]);
  }
  return output;
}

function parseJsonResult<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const objectStart = cleaned.indexOf("{");
    const arrayStart = cleaned.indexOf("[");
    const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
    const end = start >= 0 ? Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]")) : -1;
    if (start < 0 || end <= start) throw new Error("A resposta não contém JSON válido.");
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

function parseEditorialMemory(text: string, current: EditorialMemory): EditorialMemory {
  const parsed = parseJsonResult<unknown>(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Memória inválida");
  const next = { ...EMPTY_MEMORY, ...current };
  let updated = false;
  for (const key of Object.keys(EMPTY_MEMORY) as Array<keyof EditorialMemory>) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === "string" || Array.isArray(value) || (value && typeof value === "object")) {
      next[key] = typeof value === "string" ? value : Array.isArray(value)
        ? value.map((entry) => typeof entry === "string" ? entry : JSON.stringify(entry)).join("\n")
        : JSON.stringify(value, null, 2);
      updated = true;
    }
  }
  if (!updated) throw new Error("A memória não contém campos válidos");
  return next;
}

function normalizeFingerprintMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function fingerprintSources(sources: WorkflowSource[]) {
  let hash = 2166136261;
  for (const source of sources) {
    const value = `${source.name}\u0000${source.transcription}\u0000${source.interviewQuestion ?? ""}\u0000${source.chapterNumber ?? ""}\u0001`;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${sources.length}-${(hash >>> 0).toString(36)}`;
}

function textFingerprint(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}-${(hash >>> 0).toString(36)}`;
}

function sourceKey(source: WorkflowSource) {
  return textFingerprint(`${source.name}\u0000${source.transcription}`);
}

function defaultSourceRole(source: WorkflowSource): "original" | "editor" | "derived" {
  if (source.name.startsWith("CONTEÚDO DERIVADO/IA")) return "derived";
  if (source.name.startsWith("CONTEXTO DE APOIO") || source.name.startsWith("CONTEXTO EDITORIAL")) return "derived";
  return "original";
}

export default function EditorialWorkflowPanel({
  sources,
  initialSnapshot,
  onSnapshotChange,
  onCopy,
  onUseInContext,
  onDownloadDocx,
  onSpeak,
  onDownloadSpeech,
  onStopSpeech,
  onOutputStateChange,
  speechAudioUrls,
  speechErrors,
  loadingMap,
  activeSpeechKey,
}: {
  sources: WorkflowSource[];
  initialSnapshot: EditorialWorkflowSnapshot | null;
  onSnapshotChange: (snapshot: EditorialWorkflowSnapshot) => void;
  onCopy: (key: string, text: string) => void;
  onUseInContext: (text: string) => void;
  onDownloadDocx: (title: string, sections: Array<{ title: string; content: string }>) => void;
  onSpeak: (key: string, title: string, text: string, options?: { autoplay?: boolean }) => Promise<string | null>;
  onDownloadSpeech: (key: string, title: string) => void;
  onStopSpeech: () => void;
  onOutputStateChange: (hasOutput: boolean) => void;
  speechAudioUrls: Record<string, string | undefined>;
  speechErrors: Record<string, string | undefined>;
  loadingMap: Record<string, boolean>;
  activeSpeechKey: string | null;
}) {
  const [mode, setMode] = useState<WorkflowMode>(initialSnapshot?.mode ?? "women-biography");
  const [projectTitle, setProjectTitle] = useState(initialSnapshot?.title ?? "");
  const [subjectName, setSubjectName] = useState(initialSnapshot?.subject ?? "");
  const [womenMethod10, setWomenMethod10] = useState(initialSnapshot?.womenMethod10 ?? !initialSnapshot);
  const [chapterCount, setChapterCount] = useState(initialSnapshot?.chapterCount ?? 10);
  const [narrator, setNarrator] = useState<NarratorMode>(initialSnapshot?.narrator ?? "subject-first-person");
  const [editorialNotes, setEditorialNotes] = useState(initialSnapshot?.editorialNotes ?? "");
  const [collectionGuide, setCollectionGuide] = useState(initialSnapshot?.collectionGuide ?? "");
  const [memory, setMemory] = useState<EditorialMemory>({ ...EMPTY_MEMORY, ...initialSnapshot?.memory });
  const [continuityNotes, setContinuityNotes] = useState(initialSnapshot?.continuityNotes ?? "");
  const [chapterNumber, setChapterNumber] = useState(initialSnapshot?.chapterNumber ?? 1);
  const [chapterTitle, setChapterTitle] = useState(initialSnapshot?.chapterTitle ?? "");
  const [outline, setOutline] = useState(initialSnapshot?.outline ?? "");
  const [outlineSourceFingerprint, setOutlineSourceFingerprint] = useState(initialSnapshot?.outlineSourceFingerprint ?? "");
  const [outlineApproved, setOutlineApproved] = useState(initialSnapshot?.outlineApproved ?? false);
  const [outlineApprovedFingerprint, setOutlineApprovedFingerprint] = useState(initialSnapshot?.outlineApprovedFingerprint ?? "");
  const [chapters, setChapters] = useState<Record<string, EditorialChapter>>(() => normalizeEditorialChapters(initialSnapshot?.chapters));
  const [chapterSourceFingerprints, setChapterSourceFingerprints] = useState(initialSnapshot?.chapterSourceFingerprints ?? {});
  const [meetingReport, setMeetingReport] = useState(initialSnapshot?.meetingReport ?? "");
  const [meetingSourceFingerprint, setMeetingSourceFingerprint] = useState(initialSnapshot?.meetingSourceFingerprint ?? "");
  const [followUpQuestions, setFollowUpQuestions] = useState(initialSnapshot?.followUpQuestions ?? "");
  const [meetingActions, setMeetingActions] = useState<MeetingAction[]>(initialSnapshot?.meetingActions ?? []);
  const [qualityReport, setQualityReport] = useState(initialSnapshot?.qualityReport ?? "");
  const [importedSources, setImportedSources] = useState<WorkflowSource[]>(initialSnapshot?.sources ?? []);
  const [sourceSelection, setSourceSelection] = useState<Record<string, boolean>>(initialSnapshot?.sourceSelection ?? {});
  const [sourceRoles, setSourceRoles] = useState<Record<string, "original" | "editor" | "derived">>(initialSnapshot?.sourceRoles ?? {});
  const [projectSuggestion, setProjectSuggestion] = useState<EditorialWorkflowSnapshot["projectSuggestion"]>(initialSnapshot?.projectSuggestion ?? null);
  const [newTextTitle, setNewTextTitle] = useState("");
  const [newTextBody, setNewTextBody] = useState("");
  const [newTextRole, setNewTextRole] = useState<"original" | "editor">("original");
  const [sourceGuides, setSourceGuides] = useState<Record<string, { question: string; chapterNumber: string }>>(initialSnapshot?.sourceGuides ?? {});
  const [pendingChapter, setPendingChapter] = useState<{ chapterNumber: number; title: string; text: string; sourceIds: string[]; sourceFingerprint: string } | null>(null);
  const [chapterPreview, setChapterPreview] = useState("");
  const [passageCandidate, setPassageCandidate] = useState<{ start: number; end: number; original: string; revised: string } | null>(null);
  const [selectedPassage, setSelectedPassage] = useState("");
  const [narrationMode, setNarrationMode] = useState<"faithful" | "natural" | "adapted">(initialSnapshot?.narrationMode ?? "natural");
  const [pronunciationNotes, setPronunciationNotes] = useState(initialSnapshot?.pronunciationNotes ?? "");
  const [chapterSelection, setChapterSelection] = useState<Record<string, boolean>>(initialSnapshot?.chapterSelection ?? {});
  const [audiobookProgress, setAudiobookProgress] = useState("");
  const [audiobookTtsModel, setAudiobookTtsModel] = useState("gemini-2.5-pro-preview-tts");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const guideFileInputRef = useRef<HTMLInputElement>(null);
  const chapterTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const chapterEditBaselineRef = useRef<{ number: number; text: string } | null>(null);
  const maxChapterCount = mode === "women-biography" ? 10 : 30;
  const minChapterCount = mode === "women-biography" ? womenMethod10 ? 10 : 5 : 1;

  useEffect(() => {
    let active = true;
    void fetch("/api/health").then((response) => response.json()).then((health: { geminiAudiobookTtsModel?: string }) => {
      if (active && health.geminiAudiobookTtsModel) setAudiobookTtsModel(health.geminiAudiobookTtsModel);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const allSources = useMemo(() => {
    const seen = new Set<string>();
    return [...importedSources, ...sources].filter((source) => {
      const key = `${source.name}\u0000${source.transcription}`;
      if (!source.transcription.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((source) => {
      const guide = sourceGuides[textFingerprint(`${source.name}\u0000${source.transcription}`)];
      const parsedChapter = guide?.chapterNumber ? Number(guide.chapterNumber) : source.chapterNumber ?? null;
      return {
        ...source,
        interviewQuestion: guide?.question ?? source.interviewQuestion ?? "",
        chapterNumber: Number.isInteger(parsedChapter) && Number(parsedChapter) > 0 ? Number(parsedChapter) : null,
      };
    });
  }, [importedSources, sources, sourceGuides]);
  const activeSources = useMemo(() => allSources.filter((source) => sourceSelection[sourceKey(source)] !== false), [allSources, sourceSelection]);
  const sourceFingerprint = useMemo(() => `${fingerprintSources(activeSources)}${Object.keys(sourceRoles).length ? `-${textFingerprint(JSON.stringify(sourceRoles))}` : ""}`, [activeSources, sourceRoles]);

  const currentChapter = chapters[String(chapterNumber)];
  const currentSpeechTitle = mode === "meeting" ? "relatório da reunião" : `capítulo ${chapterNumber}`;
  const narrationBase = mode === "meeting"
    ? cleanNarrationText(meetingReport)
    : cleanNarrationText(currentChapter?.narrationText?.trim() || currentChapter?.text || "");
  const currentSpeechText = applyPronunciationReplacements(narrationBase, pronunciationNotes);
  const narrationIsStale = Boolean(currentChapter?.narrationText && currentChapter.narrationSourceFingerprint !== textFingerprint(currentChapter.text));
  const currentSpeechKey = useMemo(
    () => `review:workflow-${mode === "meeting" ? "meeting" : `chapter-${chapterNumber}`}-${textFingerprint(currentSpeechText)}`,
    [currentSpeechText, mode, chapterNumber],
  );
  const currentSpeechUrl = speechAudioUrls[currentSpeechKey];
  const currentSpeechError = speechErrors[currentSpeechKey];
  const currentSpeechLoading = Boolean(loadingMap[`speech:${currentSpeechKey}`]);
  const currentSpeechActive = activeSpeechKey === currentSpeechKey;
  const outlineIsStale = Boolean(outline && outlineSourceFingerprint && outlineSourceFingerprint !== sourceFingerprint);
  const outlineIsApproved = Boolean(outline && outlineApproved && outlineApprovedFingerprint === textFingerprint(outline) && !outlineIsStale);
  const canWriteCurrentChapter = mode !== "women-biography" || !womenMethod10 || (outlineIsApproved && (chapterNumber === 1 || chapters[String(chapterNumber - 1)]?.status === "approved"));
  const chapterIsStale = Boolean(currentChapter && chapterSourceFingerprints[String(chapterNumber)] && chapterSourceFingerprints[String(chapterNumber)] !== sourceFingerprint);
  const meetingIsStale = Boolean(meetingReport && meetingSourceFingerprint && meetingSourceFingerprint !== sourceFingerprint);
  const chapterStatusLabels: Record<ChapterWorkflowStatus, string> = { planned: "Planejado", draft: "Rascunho", review: "Em revisão", approved: "Aprovado" };
  const sourceId = (source: WorkflowSource) => source.id ?? `source-${textFingerprint(`${source.name}\u0000${source.transcription}`)}`;
  const usedSourceIds = new Set(Object.values(chapters).flatMap((chapter) => chapter.sourceIds));
  const unusedSources = activeSources.filter((source) => !usedSourceIds.has(sourceId(source)));
  const nextRecommendedAction = mode === "meeting"
    ? !meetingReport ? "Analisar a reunião e produzir o relatório" : !meetingActions.length ? "Extrair e revisar os encaminhamentos" : "Atualizar responsáveis, prazos e situações"
    : !activeSources.length ? "Adicionar entrevistas, transcrições ou documentos" : !Object.values(memory).some(Boolean) ? "Conferir fatos e montar a memória editorial" : !outline ? "Propor a estrutura dos capítulos" : womenMethod10 && !outlineIsApproved ? "Revisar e aprovar o sumário estratégico" : Object.values(chapters).some((chapter) => chapter.status !== "approved") ? "Revisar e aprovar os capítulos planejados" : "Executar a conferência editorial final";

  function sourcesForChapter(number: number) {
    const chapter = chapters[String(number)];
    if (chapter?.sourceIds.length) return activeSources.filter((source) => chapter.sourceIds.includes(sourceId(source)));
    return activeSources.filter((source) => source.chapterNumber == null || source.chapterNumber === number);
  }

  function addTextSource() {
    const text = newTextBody.trim();
    if (!text) {
      setError("Cole o texto recebido antes de adicioná-lo ao projeto.");
      return;
    }
    const name = newTextTitle.trim() || `Texto recebido ${importedSources.length + 1}`;
    const source = { id: `manual-${nanoid()}`, name, transcription: text };
    setImportedSources((current) => [...current, source]);
    setSourceRoles((current) => ({ ...current, [sourceKey(source)]: newTextRole }));
    setNewTextTitle("");
    setNewTextBody("");
    setError("");
    setSuccess(`“${name}” foi adicionado às fontes do projeto.`);
  }

  const workflowSnapshot = useMemo<EditorialWorkflowSnapshot>(() => ({
    mode, title: projectTitle, subject: subjectName, chapterCount, narrator, editorialNotes,
    collectionGuide, womenMethod10, outlineApproved, outlineApprovedFingerprint, sourceSelection, sourceRoles, projectSuggestion,
    continuityNotes, memory, chapterNumber, chapterTitle, outline,
    chapters, followUpQuestions, meetingReport, meetingActions, qualityReport,
    narrationMode, pronunciationNotes, chapterSelection,
    sources: allSources, sourceGuides, outlineSourceFingerprint, chapterSourceFingerprints, meetingSourceFingerprint,
  }), [mode, projectTitle, subjectName, chapterCount, narrator, editorialNotes, collectionGuide, womenMethod10, outlineApproved, outlineApprovedFingerprint, sourceSelection, sourceRoles, projectSuggestion, continuityNotes, memory, chapterNumber, chapterTitle, outline, chapters, followUpQuestions, meetingReport, meetingActions, qualityReport, narrationMode, pronunciationNotes, chapterSelection, allSources, sourceGuides, outlineSourceFingerprint, chapterSourceFingerprints, meetingSourceFingerprint]);

  useEffect(() => {
    onSnapshotChange(workflowSnapshot);
  }, [onSnapshotChange, workflowSnapshot]);

  async function requestTask(task: TaskMode | ConsolidationMode, items: AnalyzeAllItem[], memoryOverride?: EditorialMemory) {
    const priorChapter = chapters[String(chapterNumber - 1)];
    const priorTitles = Object.entries(chapters).filter(([number, chapter]) => Number(number) < chapterNumber && chapter.status === "approved").sort(([left], [right]) => Number(left) - Number(right)).map(([number, chapter]) => `${number}: ${chapter.title}`).join("; ").slice(0, 800);
    const previousChapterEnding = task.startsWith("biography-chapter") && chapterNumber > 1 && priorChapter?.status === "approved"
      ? `Capítulos aprovados: ${priorTitles}\nTrecho final do capítulo ${chapterNumber - 1}:\n${cleanBookText(priorChapter.text).slice(-3_000)}`.slice(0, 4_000)
      : "";
    const response = await fetch("/api/editorial-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: task,
        projectType: mode,
        projectTitle: projectTitle.trim(),
        subjectName: subjectName.trim(),
        chapterCount,
        narrator,
        chapterNumber,
        chapterTitle: chapterTitle.trim(),
        editorialNotes: editorialNotes.trim(),
        collectionGuide: collectionGuide.trim(),
        womenMethod10: mode === "women-biography" && womenMethod10,
        continuityNotes: continuityNotes.trim(),
        previousChapterEnding,
        memory: memoryOverride ?? memory,
        selectedPassage: task === "biography-rewrite-passage" ? selectedPassage : "",
        narrationMode,
        pronunciationNotes,
        outline,
        items,
      }),
    });
    const payload = await response.json().catch(() => null) as { ok?: boolean; result?: string; error?: string } | null;
    if (!response.ok || !payload?.ok || !payload.result?.trim()) {
      throw new Error(payload?.error || "Não foi possível gerar o conteúdo.");
    }
    return payload.result.trim();
  }

  async function runWorkflowTask(task: TaskMode, suppliedItems?: AnalyzeAllItem[], memoryOverride?: EditorialMemory) {
    if (!activeSources.length && !suppliedItems?.length) {
      setError("Adicione ou transcreva fontes antes de iniciar esta etapa.");
      return "";
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const chapterSources = suppliedItems ? [] : task.startsWith("biography-chapter") && mode !== "meeting"
        ? activeSources.filter((source) => source.chapterNumber == null || source.chapterNumber === chapterNumber)
        : activeSources;
      if (!suppliedItems && !chapterSources.length) {
        setError(`Nenhuma fonte está associada ao capítulo ${chapterNumber}. Ajuste a associação ou deixe fontes sem capítulo específico.`);
        return "";
      }
      const sourceItems = suppliedItems ?? chapterSources.map((source) => {
        const metadata = [
          `origem: ${sourceRoles[sourceKey(source)] ?? defaultSourceRole(source)}`,
          source.chapterNumber ? `capítulo ${source.chapterNumber}` : "",
          source.interviewQuestion?.trim() ? `pergunta respondida: ${source.interviewQuestion.trim()}` : "",
        ].filter(Boolean).join("; ");
        return {
          name: `${source.name.slice(0, 180)} [${metadata}]`.slice(0, 260),
          transcription: source.transcription,
        };
      });
      const initialBatches = prepareSessionBatches(sourceItems);
      let partialResults: AnalyzeAllItem[] = [];
      let completedCalls = 0;

      for (let batchIndex = 0; batchIndex < initialBatches.length; batchIndex += 1) {
        setProgress(`${TASK_LABELS[task]}: bloco ${batchIndex + 1} de ${initialBatches.length}.`);
        const result = await requestTask(task, initialBatches[batchIndex], memoryOverride);
        partialResults.push({ name: `Resultado parcial ${batchIndex + 1}`, transcription: result });
        completedCalls += 1;
      }

      const mergeTask: TaskMode | ConsolidationMode = task === "biography-outline"
        ? "biography-outline-merge"
        : task === "biography-chapter"
          ? "biography-chapter-merge"
          : task === "meeting-analysis"
            ? "meeting-analysis-merge"
            : task;
      let pass = 0;
      while (partialResults.length > 1) {
        pass += 1;
        if (pass > 10) throw new Error("A consolidação atingiu o limite seguro. Nenhuma fonte foi omitida; tente dividir o projeto em grupos menores.");
        const batches = prepareSessionBatches(partialResults);
        if (batches.length >= partialResults.length) throw new Error("Não foi possível reduzir os resultados sem risco de perda. Nenhuma fonte foi omitida.");
        const mergedResults: AnalyzeAllItem[] = [];
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
          setProgress(`${TASK_LABELS[mergeTask]}: etapa ${pass}, bloco ${batchIndex + 1} de ${batches.length}.`);
          const result = await requestTask(mergeTask, batches[batchIndex], memoryOverride);
          mergedResults.push({ name: `Consolidação ${pass}, parte ${batchIndex + 1}`, transcription: result });
          completedCalls += 1;
        }
        partialResults = mergedResults;
      }

      setSuccess(`Conteúdo gerado a partir de ${sourceItems.length} fonte(s), em ${completedCalls} chamada(s).`);
      return partialResults[0]?.transcription ?? "";
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Falha ao processar as fontes.");
      return "";
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function generateOutline() {
    const sourceVersion = sourceFingerprint;
    const result = await runWorkflowTask("biography-outline");
    if (result) {
      setOutline(result);
      setOutlineSourceFingerprint(sourceVersion);
      setOutlineApproved(false);
      setChapterTitle((current) => current.trim() || chapterTitleFromOutline(result, chapterNumber));
      onOutputStateChange(true);
    }
  }

  async function prepareBiography() {
    const memoryResult = await runWorkflowTask("biography-memory");
    if (!memoryResult) return;
    let updatedMemory: EditorialMemory;
    try {
      updatedMemory = parseEditorialMemory(memoryResult, memory);
    } catch {
      setError("A IA não retornou uma memória editorial válida. Suas fontes permanecem disponíveis; tente novamente.");
      return;
    }
    setMemory(updatedMemory);
    const sourceVersion = sourceFingerprint;
    const result = await runWorkflowTask("biography-outline", undefined, updatedMemory);
    if (result) {
      setOutline(result);
      setOutlineSourceFingerprint(sourceVersion);
      setOutlineApproved(false);
      setChapterTitle((current) => current.trim() || chapterTitleFromOutline(result, chapterNumber));
      onOutputStateChange(true);
    }
  }

  async function detectProjectType() {
    const result = await runWorkflowTask("detect-project-type");
    if (!result) return;
    try {
      const parsed = parseJsonResult<unknown>(result);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Formato inválido");
      const suggestion = parsed as Record<string, unknown>;
      if (suggestion.type !== "women-biography" && suggestion.type !== "full-biography" && suggestion.type !== "meeting" && suggestion.type !== "other") throw new Error("Tipo inválido");
      if (typeof suggestion.reason !== "string" || suggestion.reason.length > 1_000) throw new Error("Justificativa inválida");
      setProjectSuggestion({ type: suggestion.type, reason: suggestion.reason, confidence: suggestion.confidence === "high" || suggestion.confidence === "medium" ? suggestion.confidence : "low", sourceFingerprint });
    } catch {
      setError("Não foi possível validar a identificação do material. Você pode selecionar o fluxo manualmente.");
    }
  }

  async function generateChapter() {
    if (mode === "women-biography" && womenMethod10 && !outlineIsApproved) {
      setError("Revise e aprove o sumário estratégico antes de escrever capítulos.");
      return;
    }
    if (mode === "women-biography" && womenMethod10 && chapterNumber > 1 && chapters[String(chapterNumber - 1)]?.status !== "approved") {
      setError(`Aprove o capítulo ${chapterNumber - 1} antes de escrever o capítulo ${chapterNumber}.`);
      return;
    }
    if (!chapterTitle.trim()) {
      setError("Informe o título ou tema do capítulo antes de gerar o rascunho.");
      return;
    }
    const sourceVersion = sourceFingerprint;
    const result = await runWorkflowTask("biography-chapter");
    if (result) {
      const linkedSources = activeSources.filter((source) => source.chapterNumber == null || source.chapterNumber === chapterNumber);
      const sourceIds = linkedSources.map((source) => source.id ?? `source-${textFingerprint(`${source.name}\u0000${source.transcription}`)}`);
      if (currentChapter?.text.trim()) {
        setPendingChapter({ chapterNumber, title: chapterTitle.trim(), text: result, sourceIds, sourceFingerprint: sourceVersion });
        setSuccess("Nova versão pronta para comparação. O texto atual não foi substituído.");
      } else {
        setChapters((current) => ({ ...current, [chapterNumber]: makeChapter(chapterTitle.trim(), result, "draft", sourceIds) }));
        setChapterSourceFingerprints((current) => ({ ...current, [chapterNumber]: sourceVersion }));
      }
      onOutputStateChange(true);
    }
  }

  async function generateChapterPreview() {
    if (mode === "women-biography" && womenMethod10 && !outlineIsApproved) {
      setError("Aprove o sumário estratégico antes da prévia do capítulo.");
      return;
    }
    if (!chapterTitle.trim()) {
      setError("Informe o título ou tema do capítulo para gerar uma prévia.");
      return;
    }
    setChapterPreview("");
    const result = await runWorkflowTask("biography-chapter-preview");
    if (result) setChapterPreview(result);
  }

  function acceptPendingChapter() {
    if (!pendingChapter) return;
    const targetNumber = pendingChapter.chapterNumber;
    setChapters((current) => {
      const existing = current[String(targetNumber)];
      const next = makeChapter(pendingChapter.title, pendingChapter.text, "review", pendingChapter.sourceIds);
      next.revisions = existing?.text ? [...existing.revisions, { text: existing.text, savedAt: new Date().toISOString(), reason: "Versão anterior antes da substituição aprovada" }] : [];
      return { ...current, [targetNumber]: next };
    });
    setChapterSourceFingerprints((current) => ({ ...current, [targetNumber]: pendingChapter.sourceFingerprint }));
    if (targetNumber === chapterNumber) setChapterTitle(pendingChapter.title);
    setPendingChapter(null);
  }

  async function generatePassageRevision() {
    const selected = selectedPassage.trim();
    if (!currentChapter || !selected) {
      setError("Selecione um parágrafo ou trecho do capítulo antes de pedir a revisão.");
      return;
    }
    const start = currentChapter.text.indexOf(selected);
    if (start < 0) {
      setError("O trecho selecionado mudou. Selecione-o novamente no texto atual.");
      return;
    }
    const result = await runWorkflowTask("biography-rewrite-passage", [{ name: `Trecho do capítulo ${chapterNumber}`, transcription: currentChapter.text }]);
    if (result) setPassageCandidate({ start, end: start + selected.length, original: selected, revised: result });
  }

  function acceptPassageRevision() {
    if (!currentChapter || !passageCandidate) return;
    if (currentChapter.text.slice(passageCandidate.start, passageCandidate.end) !== passageCandidate.original) {
      setError("O capítulo mudou desde a geração. A revisão não foi aplicada para proteger suas edições.");
      return;
    }
    const revisedText = `${currentChapter.text.slice(0, passageCandidate.start)}${passageCandidate.revised}${currentChapter.text.slice(passageCandidate.end)}`;
    setChapters((current) => ({ ...current, [chapterNumber]: {
      ...currentChapter,
      text: revisedText,
      status: "review",
      revisions: [...currentChapter.revisions, { text: currentChapter.text, savedAt: new Date().toISOString(), reason: "Antes da revisão de trecho" }],
      narrationText: "",
      narrationSourceFingerprint: "",
    } }));
    setPassageCandidate(null);
    setSelectedPassage("");
  }

  async function extractEditorialMemory() {
    const result = await runWorkflowTask("biography-memory");
    if (!result) return;
    try {
      setMemory(parseEditorialMemory(result, memory));
    } catch {
      setError("A memória retornada não veio no formato esperado. O resultado foi mantido nas fontes, sem substituir suas anotações.");
    }
  }

  async function generateFollowUps() {
    const result = await runWorkflowTask(mode === "meeting" ? "meeting-followups" : "biography-followups");
    if (result) setFollowUpQuestions(result);
  }

  async function extractMeetingActions() {
    const result = await runWorkflowTask("meeting-actions");
    if (!result) return;
    try {
      const parsed = parseJsonResult<Array<Partial<MeetingAction>>>(result);
      if (!Array.isArray(parsed)) throw new Error("Formato inválido");
      setMeetingActions(parsed.map((action, index) => ({
        id: typeof action.id === "string" ? action.id : `meeting-action-${index}-${Date.now()}`,
        title: String(action.title ?? "Encaminhamento sem descrição"),
        owner: String(action.owner ?? "Não informado"),
        deadline: String(action.deadline ?? "Não informado"),
        kind: action.kind === "agreed" || action.kind === "proposed" ? action.kind : "suggested",
        status: "open",
        evidence: String(action.evidence ?? "Trecho de evidência não informado"),
        sourceName: String(action.sourceName ?? "Fonte não identificada"),
      })));
    } catch {
      setError("Não foi possível validar a lista estruturada de tarefas. O relatório da reunião continua disponível.");
    }
  }

  async function runFinalQualityCheck() {
    const staleAudioChapters = Object.entries(chapters).flatMap(([number, chapter]) => {
      const narration = applyPronunciationReplacements(chapterNarrationText(chapter), pronunciationNotes);
      const currentKey = `review:workflow-chapter-${number}-${textFingerprint(narration)}`;
      const hasOlderAudio = Object.keys(speechAudioUrls).some((key) => key.startsWith(`review:workflow-chapter-${number}-`) && key !== currentKey);
      return hasOlderAudio ? [`Capítulo ${number}: há MP3 de versão anterior; gere novamente antes da entrega`] : [];
    });
    const packageItems: AnalyzeAllItem[] = [
      ...Object.entries(chapters).map(([number, chapter]) => ({ name: `Capítulo ${number}: ${chapter.title} [estado: ${chapter.status}]`, transcription: chapter.text })),
      ...activeSources.map((source) => ({ name: `[origem: ${sourceRoles[sourceKey(source)] ?? defaultSourceRole(source)}] ${source.name}`.slice(0, 250), transcription: source.transcription })),
      { name: "Estrutura e pendências", transcription: JSON.stringify({ plannedChapterCount: chapterCount, presentChapterNumbers: Object.keys(chapters), outline, sourceNames: activeSources.map((source) => source.name), unusedSources: unusedSources.map((source) => source.name), followUpQuestions, staleAudioChapters }) },
    ];
    const result = await runWorkflowTask("editorial-quality", packageItems);
    if (result) setQualityReport(result);
  }

  async function loadCollectionGuide(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("O guia editorial deve ter até 2 MB.");
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["txt", "md", "markdown"].includes(extension)) throw new Error("Carregue o guia em TXT ou Markdown; você também pode colar o conteúdo no campo.");
      const content = await file.text();
      const merged = collectionGuide.trim() ? `${collectionGuide.trim()}\n\n--- ${file.name} ---\n${content}` : content;
      if (merged.length > 12_000) throw new Error("As orientações adicionais devem ter até 12.000 caracteres. O método padrão já está integrado ao app.");
      setCollectionGuide(merged);
      setSuccess(`Guia “${file.name}” carregado. Revise o texto antes de usar na geração.`);
    } catch (guideError) {
      setError(guideError instanceof Error ? guideError.message : "Não foi possível carregar o guia editorial.");
    } finally {
      if (guideFileInputRef.current) guideFileInputRef.current.value = "";
    }
  }

  async function analyzeMeeting() {
    const sourceVersion = sourceFingerprint;
    const result = await runWorkflowTask("meeting-analysis");
    if (result) {
      setMeetingReport(result);
      setMeetingSourceFingerprint(sourceVersion);
      onOutputStateChange(true);
    }
  }

  async function prepareNarrationDraft() {
    if (!currentChapter?.text.trim()) {
      setError("Gere ou selecione um capítulo antes de preparar a narração.");
      return;
    }
    const result = await runWorkflowTask("narration-review", [{ name: `Capítulo ${chapterNumber}: ${currentChapter.title}`, transcription: currentChapter.text }]);
    if (result) {
      const narrationText = cleanNarrationText(result);
      if (!narrationText) {
        setError("A preparação não retornou texto narrável. O capítulo editorial foi preservado.");
        return;
      }
      setChapters((current) => ({ ...current, [chapterNumber]: {
        ...currentChapter,
        narrationText,
        narrationSourceFingerprint: textFingerprint(currentChapter.text),
      } }));
    }
  }

  async function generateSelectedAudiobook() {
    const selected = Object.entries(chapterSelection)
      .filter(([, checked]) => checked)
      .map(([number]) => Number(number))
      .sort((left, right) => left - right)
      .map((number) => ({ number, chapter: chapters[String(number)] }))
      .filter((entry): entry is { number: number; chapter: EditorialChapter } => Boolean(entry.chapter?.text.trim()));
    if (!selected.length) {
      setError("Selecione ao menos um capítulo com texto para gerar o audiobook.");
      return;
    }

    setBusy(true);
    setError("");
    let failed = 0;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const { number, chapter } = selected[index];
        const cleanText = applyPronunciationReplacements(chapterNarrationText(chapter), pronunciationNotes);
        const key = `review:workflow-chapter-${number}-${textFingerprint(cleanText)}`;
        setAudiobookProgress(`Gerando capítulo ${index + 1} de ${selected.length}: ${chapter.title}`);
        const audioUrl = await onSpeak(key, chapter.title || `Capítulo ${number}`, cleanText, { autoplay: false });
        if (!audioUrl) failed += 1;
      }
      setSuccess(failed ? `${selected.length - failed} capítulo(s) gerado(s); ${failed} falhou(aram). Use “Tentar novamente” para retomar sem refazer os concluídos.` : `${selected.length} capítulo(s) de audiobook gerado(s).`);
    } finally {
      setBusy(false);
      setAudiobookProgress("");
    }
  }

  async function downloadSelectedAudiobook() {
    const selected = Object.entries(chapterSelection)
      .filter(([, checked]) => checked)
      .map(([number]) => Number(number))
      .sort((left, right) => left - right)
      .map((number) => ({ number, chapter: chapters[String(number)] }))
      .filter((entry): entry is { number: number; chapter: EditorialChapter } => Boolean(entry.chapter?.text.trim()));
    if (!selected.length) {
      setError("Selecione capítulos antes de baixar o audiobook.");
      return;
    }
    const entries: Record<string, Uint8Array> = {};
    const textParts: string[] = [];
    for (const { number, chapter } of selected) {
      const cleanText = applyPronunciationReplacements(chapterNarrationText(chapter), pronunciationNotes);
      const key = `review:workflow-chapter-${number}-${textFingerprint(cleanText)}`;
      const url = speechAudioUrls[key];
      if (!url) {
        setError(`O capítulo ${number} ainda não tem áudio gerado. Gere ou retome os capítulos selecionados primeiro.`);
        return;
      }
      const audio = await fetch(url).then((response) => response.arrayBuffer());
      entries[`capitulo-${String(number).padStart(2, "0")}-${textFingerprint(chapter.title)}.mp3`] = new Uint8Array(audio);
      textParts.push(`CAPÍTULO ${number}: ${chapter.title}\n\n${chapter.text}`);
    }
    const packageBlob = new Blob([zipSync({
      ...entries,
      "roteiro-editorial.txt": strToU8(`${projectTitle || subjectName || "Projeto editorial"}\n\n${textParts.join("\n\n========================\n\n")}`),
    })], { type: "application/zip" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(packageBlob);
    link.download = `${(projectTitle || subjectName || "audiobook-leste").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.zip`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function downloadCompleteAudiobook() {
    const selected = Object.entries(chapterSelection)
      .filter(([, checked]) => checked)
      .map(([number]) => Number(number))
      .sort((left, right) => left - right)
      .map((number) => ({ number, chapter: chapters[String(number)] }))
      .filter((entry): entry is { number: number; chapter: EditorialChapter } => Boolean(entry.chapter?.text.trim()));
    const urls: string[] = [];
    for (const { number, chapter } of selected) {
      const cleanText = applyPronunciationReplacements(chapterNarrationText(chapter), pronunciationNotes);
      const key = `review:workflow-chapter-${number}-${textFingerprint(cleanText)}`;
      if (!speechAudioUrls[key]) {
        setError(`Falta gerar o áudio do capítulo ${number}. Os demais já gerados permanecem disponíveis.`);
        return;
      }
      urls.push(speechAudioUrls[key]);
    }
    if (!urls.length) {
      setError("Selecione e gere capítulos antes de montar o áudio completo.");
      return;
    }
    const parts = await Promise.all(urls.map((url) => fetch(url).then((response) => response.arrayBuffer())));
    const blob = new Blob(parts, { type: "audio/mpeg" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(projectTitle || subjectName || "audiobook-leste").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.mp3`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  const selectedChapters = Object.entries(chapterSelection).filter(([, checked]) => checked).map(([number]) => chapters[number]).filter((chapter): chapter is EditorialChapter => Boolean(chapter?.text.trim()));
  const selectedWords = selectedChapters.reduce((total, chapter) => total + chapter.text.trim().split(/\s+/).filter(Boolean).length, 0);
  const estimatedMinutes = selectedWords ? Math.ceil(selectedWords / 150) : 0;
  const audiobookAudioRatePerMillion = audiobookTtsModel.includes("2.5-pro") ? 20 : audiobookTtsModel.includes("2.5-flash") ? 10 : audiobookTtsModel.includes("3.1") ? 20 : audiobookTtsModel.includes("lite") ? 6 : 9;
  const audiobookTextRatePerMillion = audiobookTtsModel.includes("2.5-pro") || audiobookTtsModel.includes("3.1") ? 1 : 0.5;
  const estimatedUsd = selectedWords ? ((selectedWords / 150 * 60) * 25 * audiobookAudioRatePerMillion / 1_000_000) + (selectedWords / 0.75 * audiobookTextRatePerMillion / 1_000_000) : 0;

  function saveProject() {
    const project: ProjectFile = {
      format: "leste-audio-ia-project",
      version: 1,
      savedAt: new Date().toISOString(),
      mode,
      title: projectTitle,
      subject: subjectName,
      chapterCount,
      narrator,
      editorialNotes,
      collectionGuide,
      womenMethod10,
      outlineApproved,
      outlineApprovedFingerprint,
      sourceSelection,
      sourceRoles,
      projectSuggestion,
      memory,
      continuityNotes,
      outline,
      chapters,
      meetingReport,
      followUpQuestions,
      meetingActions,
      qualityReport,
      sourceGuides,
      narrationMode,
      pronunciationNotes,
      chapterSelection,
      sources: allSources,
      outlineSourceFingerprint,
      chapterSourceFingerprints,
      meetingSourceFingerprint,
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(projectTitle || subjectName || "projeto-leste-audio-ia").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "projeto-leste-audio-ia"}.leste.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSuccess("Projeto salvo no seu computador. Ele inclui textos e rascunhos, sem os áudios originais.");
  }

  async function loadProject(file?: File) {
    if (!file) return;
    setError("");
    setSuccess("");
    if (file.size > 25 * 1024 * 1024) {
      setError("O arquivo de projeto excede 25 MB.");
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as Partial<ProjectFile>;
      if (parsed.format !== "leste-audio-ia-project" || parsed.version !== 1 || !isWorkflowMode(parsed.mode)) {
        throw new Error("Este arquivo não é um projeto compatível do Leste Audio IA.");
      }
      const restoredSources = normalizeProjectSources(parsed.sources);
      if (!restoredSources.length && !String(parsed.outline ?? "").trim() && !Object.keys(parsed.chapters ?? {}).length && !String(parsed.meetingReport ?? "").trim()) {
        throw new Error("O arquivo não contém fontes ou resultados que possam ser restaurados.");
      }
      setMode(parsed.mode);
      setProjectTitle(String(parsed.title ?? ""));
      setSubjectName(String(parsed.subject ?? ""));
      const chapterLimit = parsed.mode === "women-biography" ? 10 : 30;
      const chapterMinimum = parsed.mode === "women-biography" ? 5 : 1;
      setChapterCount(parsed.mode === "women-biography" && parsed.womenMethod10 ? 10 : Math.max(chapterMinimum, Math.min(chapterLimit, Number(parsed.chapterCount) || 8)));
      setNarrator(parsed.narrator === "ghostwriter-third-person" ? parsed.narrator : "subject-first-person");
      setEditorialNotes(String(parsed.editorialNotes ?? ""));
      setCollectionGuide(String(parsed.collectionGuide ?? ""));
      setWomenMethod10(Boolean(parsed.womenMethod10));
      setOutlineApproved(Boolean(parsed.outlineApproved));
      setOutlineApprovedFingerprint(String(parsed.outlineApprovedFingerprint ?? ""));
      setSourceSelection(parsed.sourceSelection ?? {});
      setSourceRoles(parsed.sourceRoles ?? {});
      setProjectSuggestion(parsed.projectSuggestion ?? null);
      setMemory({ ...EMPTY_MEMORY, ...(parsed.memory ?? {}) });
      setContinuityNotes(String(parsed.continuityNotes ?? ""));
      setOutline(String(parsed.outline ?? ""));
      const restoredChapters = normalizeChapterDrafts(parsed.chapters);
      setChapters(restoredChapters);
      setMeetingReport(String(parsed.meetingReport ?? ""));
      setFollowUpQuestions(String(parsed.followUpQuestions ?? ""));
      setMeetingActions(Array.isArray(parsed.meetingActions) ? parsed.meetingActions : []);
      setQualityReport(String(parsed.qualityReport ?? ""));
      setNarrationMode(parsed.narrationMode === "faithful" || parsed.narrationMode === "adapted" ? parsed.narrationMode : "natural");
      setPronunciationNotes(String(parsed.pronunciationNotes ?? ""));
      setChapterSelection(parsed.chapterSelection ?? {});
      setImportedSources(restoredSources);
      setSourceGuides(parsed.sourceGuides ?? {});
      setOutlineSourceFingerprint(typeof parsed.outlineSourceFingerprint === "string" ? parsed.outlineSourceFingerprint : String(parsed.outline ?? "").trim() ? fingerprintSources(restoredSources) : "");
      setChapterSourceFingerprints(normalizeFingerprintMap(parsed.chapterSourceFingerprints));
      setMeetingSourceFingerprint(typeof parsed.meetingSourceFingerprint === "string" ? parsed.meetingSourceFingerprint : String(parsed.meetingReport ?? "").trim() ? fingerprintSources(restoredSources) : "");
      setChapterNumber(1);
      setChapterTitle(restoredChapters["1"]?.title ?? "");
      onOutputStateChange(Boolean(String(parsed.outline ?? "").trim() || Object.keys(restoredChapters).length || String(parsed.meetingReport ?? "").trim()));
      setSuccess(`Projeto restaurado com ${restoredSources.length} fonte(s) de texto. Os áudios originais não fazem parte do arquivo.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível abrir o projeto.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const resultSections = mode === "meeting"
    ? [
        { title: "Relatório da reunião", content: meetingReport },
        { title: "Tarefas e encaminhamentos", content: meetingActions.map((action) => `${action.title}\nResponsável: ${action.owner}\nPrazo: ${action.deadline}\nClassificação: ${action.kind}\nSituação: ${action.status}\nEvidência: ${action.evidence}\nOrigem: ${action.sourceName}`).join("\n\n") },
        { title: "Perguntas de acompanhamento", content: followUpQuestions },
      ]
    : [
        { title: "Plano de capítulos", content: outline },
        ...Object.entries(chapters).sort(([left], [right]) => Number(left) - Number(right)).flatMap(([number, chapter]) => [
          { title: `Capítulo ${number}: ${chapter.title} — versão editorial (${chapterStatusLabels[chapter.status]})`, content: chapter.text },
          { title: `Capítulo ${number}: versão para narração`, content: chapterNarrationText(chapter) },
        ]),
        { title: "Memória editorial revisável", content: Object.entries(memory).filter(([, value]) => typeof value === "string" && value.trim()).map(([key, value]) => `${key}\n${value}`).join("\n\n") },
        { title: "Perguntas complementares", content: followUpQuestions },
        { title: "Conferência editorial final", content: qualityReport },
      ];
  const availableResultSections = resultSections.filter((section) => section.content.trim());
  const bookChapters = Array.from({ length: chapterCount }, (_, index) => ({ number: index + 1, chapter: chapters[String(index + 1)] }));
  const bookReady = mode !== "meeting" && Boolean(outline.trim()) && bookChapters.every(({ chapter }) => chapter?.status === "approved" && cleanBookText(chapter.text));
  const bookSections = bookChapters.flatMap(({ number, chapter }) => chapter ? [{ title: `Capítulo ${number} — ${chapter.title}`, content: cleanBookText(chapter.text) }] : []);
  const bookText = `${projectTitle.trim() || `Biografia de ${subjectName.trim() || "uma mulher"}`}\n\n${bookSections.map((section) => `${section.title}\n\n${section.content}`).join("\n\n")}`;

  return (
    <section className="scroll-mt-5 space-y-5 rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-white to-blue-50/70 p-4 shadow-editorial sm:p-6" id="workflow-writing">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-leste-blue">Etapa de produção editorial</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Transforme as fontes em um trabalho completo</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Use transcrições, documentos e textos já adicionados ao app. O roteiro especializado trabalha com todas as fontes selecionadas e mantém a origem identificada.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <input accept=".json,.leste.json,application/json" className="hidden" onChange={(event) => void loadProject(event.currentTarget.files?.[0])} ref={fileInputRef} type="file" />
          <ActionButton fullWidth={false} onClick={() => fileInputRef.current?.click()} type="button" variant="ghost"><FileUp className="h-4 w-4" /> Abrir projeto</ActionButton>
          <ActionButton fullWidth={false} onClick={saveProject} type="button" variant="ghost"><Download className="h-4 w-4" /> Salvar projeto</ActionButton>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {WORKFLOW_MODES.map(({ id, title, detail, icon: Icon }) => (
          <button aria-pressed={mode === id} className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leste-blue ${mode === id ? "border-leste-blue bg-blue-50 ring-1 ring-leste-blue/20" : "border-slate-200 bg-white hover:border-blue-300"}`} key={id} onClick={() => { setMode(id); setError(""); if (id !== "meeting") setChapterCount((current) => id === "women-biography" && womenMethod10 ? 10 : Math.max(id === "women-biography" ? 5 : 1, Math.min(id === "women-biography" ? 10 : 30, current))); }} type="button">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${mode === id ? "bg-leste-blue text-white" : "bg-slate-100 text-leste-blue"}`}><Icon aria-hidden="true" className="h-4 w-4" /></span>
            <span className="mt-3 block text-sm font-black text-slate-950">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">{detail}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <h3 className="text-base font-black text-slate-950">Materiais do projeto</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Áudios transcritos e documentos aparecem aqui. Cole também mensagens e relatos escritos para a análise considerar tudo junto.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="text-xs font-bold text-slate-700">Nome ou origem do texto
            <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" maxLength={300} onChange={(event) => setNewTextTitle(event.currentTarget.value)} placeholder="Ex.: Mensagem da entrevistada de 12/09" value={newTextTitle} />
          </label>
          <label className="text-xs font-bold text-slate-700">Papel deste texto
            <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal" onChange={(event) => setNewTextRole(event.currentTarget.value as "original" | "editor")} value={newTextRole}><option value="original">Relato da pessoa</option><option value="editor">Correção ou orientação editorial</option></select>
          </label>
        </div>
        <label className="block text-xs font-bold text-slate-700">Texto recebido
          <textarea className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal leading-6" onChange={(event) => setNewTextBody(event.currentTarget.value)} placeholder="Cole aqui a mensagem, entrevista escrita ou história recebida." value={newTextBody} />
        </label>
        <ActionButton disabled={!newTextBody.trim()} fullWidth={false} onClick={addTextSource} type="button" variant="secondary">Adicionar texto ao projeto</ActionButton>
        {allSources.length ? <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-slate-700">{activeSources.length} de {allSources.length} fonte(s) incluída(s) na análise</p><ActionButton disabled={!activeSources.length} fullWidth={false} onClick={() => onCopy("workflow-all-sources", activeSources.map((source) => `${source.name}\n\n${source.transcription}`).join("\n\n========================\n\n"))} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar todo o material original</ActionButton></div>
          <div className="max-h-80 space-y-2 overflow-auto">{allSources.map((source) => {
            const key = sourceKey(source);
            const role = sourceRoles[key] ?? defaultSourceRole(source);
            return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2.5" key={key}>
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-slate-800"><input checked={sourceSelection[key] !== false} className="h-4 w-4 accent-leste-blue" onChange={(event) => setSourceSelection((current) => ({ ...current, [key]: event.currentTarget.checked }))} type="checkbox" /><span className="break-all">{source.name}</span></label>
              <select aria-label={`Origem de ${source.name}`} className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs" onChange={(event) => setSourceRoles((current) => ({ ...current, [key]: event.currentTarget.value as "original" | "editor" | "derived" }))} value={role}><option value="original">Relato original</option><option value="editor">Correção do editor</option><option value="derived">Texto gerado pela IA</option></select>
              <ActionButton fullWidth={false} onClick={() => onCopy(`workflow-source-${key}`, source.transcription)} type="button" variant="ghost"><Copy className="h-3.5 w-3.5" /> Copiar</ActionButton>
              {source.id?.startsWith("manual-") ? <ActionButton fullWidth={false} onClick={() => setImportedSources((current) => current.filter((item) => item.id !== source.id))} type="button" variant="ghost">Remover</ActionButton> : null}
            </div>;
          })}</div>
        </div> : null}
        <div className="flex flex-wrap items-center gap-2"><ActionButton disabled={busy || !activeSources.length} fullWidth={false} loading={busy} onClick={() => void detectProjectType()} type="button" variant="ghost"><WandSparkles className="h-4 w-4" /> Identificar tipo do material</ActionButton><span className="text-xs text-slate-600">A sugestão pode ser corrigida por você.</span></div>
        {projectSuggestion?.sourceFingerprint === sourceFingerprint ? <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 p-3 text-sm text-slate-800"><span><strong>Tipo provável:</strong> {projectSuggestion.type === "other" ? "indefinido" : WORKFLOW_MODES.find((option) => option.id === projectSuggestion.type)?.title}. {projectSuggestion.reason}</span>{projectSuggestion.type !== "other" ? <ActionButton fullWidth={false} onClick={() => { setMode(projectSuggestion.type as WorkflowMode); if (projectSuggestion.type === "women-biography") { setWomenMethod10(true); setChapterCount(10); } }} type="button" variant="secondary">Usar este fluxo</ActionButton> : null}<ActionButton fullWidth={false} onClick={() => onCopy("workflow-project-type", `${projectSuggestion.type}\n${projectSuggestion.reason}`)} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar</ActionButton></div> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="font-black text-slate-900">Fontes disponíveis nesta sessão:</span>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-leste-blue">{activeSources.length} arquivo(s)/texto(s) selecionado(s)</span>
        <span className="text-xs text-slate-500">Textos longos são processados em blocos antes da consolidação.</span>
      </div>

      <div className="grid gap-3 rounded-xl border border-leste-blue/15 bg-blue-50/60 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-leste-blue">Próxima etapa recomendada</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{nextRecommendedAction}</p>
          <p className="mt-1 text-xs text-slate-600">{mode === "meeting" ? "Fluxo: transcrição → entendimento → decisões → tarefas → acompanhamento." : "Fluxo: áudios e textos → conferência dos fatos → sumário → capítulos → livro completo em DOCX."}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-full bg-white px-3 py-1.5">{activeSources.length} fonte(s)</span>
          {mode !== "meeting" ? <span className="rounded-full bg-white px-3 py-1.5">{Object.values(chapters).filter((chapter) => chapter.status === "approved").length}/{chapterCount} capítulo(s) aprovados</span> : <span className="rounded-full bg-white px-3 py-1.5">{meetingActions.filter((action) => action.status !== "done").length} pendência(s)</span>}
        </div>
      </div>

      {mode !== "meeting" && allSources.length ? (
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-800">Relacionar áudios às perguntas e aos capítulos (opcional)</summary>
          <div className="space-y-3 border-t border-slate-100 p-4">
            <p className="text-xs leading-5 text-slate-600">Use isso quando entrevistas forem respostas a perguntas diferentes. A associação ajuda a selecionar o material de cada capítulo; fontes sem capítulo continuam disponíveis para toda a biografia.</p>
            {allSources.map((source) => {
              const key = textFingerprint(`${source.name}\u0000${source.transcription}`);
              return (
                <div className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_1.2fr_0.7fr]" key={key}>
                  <p className="break-words text-sm font-semibold text-slate-800">{source.name}</p>
                  <label className="text-xs font-semibold text-slate-600">Pergunta respondida
                    <input className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setSourceGuides((current) => ({ ...current, [key]: { question: event.currentTarget.value, chapterNumber: current[key]?.chapterNumber ?? (source.chapterNumber ? String(source.chapterNumber) : "") } }))} placeholder="Ex.: Como começou sua trajetória?" value={sourceGuides[key]?.question ?? source.interviewQuestion ?? ""} />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Capítulo
                    <select className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setSourceGuides((current) => ({ ...current, [key]: { question: current[key]?.question ?? source.interviewQuestion ?? "", chapterNumber: event.currentTarget.value } }))} value={sourceGuides[key]?.chapterNumber ?? (source.chapterNumber ? String(source.chapterNumber) : "")}>
                      <option value="">Sem capítulo específico</option>
                      {Array.from({ length: chapterCount }, (_, index) => index + 1).map((number) => <option key={number} value={number}>Capítulo {number}</option>)}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      {mode !== "meeting" ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><BookOpen className="h-5 w-5 text-leste-blue" /> Planejamento da biografia</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">Primeiro proponha a estrutura; depois gere e revise um capítulo por vez. A IA aponta dúvidas e referências às fontes para você validar.</p>
          </div>
          {mode === "women-biography" ? <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-slate-800"><input checked={womenMethod10} className="mt-1 h-4 w-4 accent-leste-blue" onChange={(event) => { setWomenMethod10(event.currentTarget.checked); if (event.currentTarget.checked) setChapterCount(10); setOutlineApproved(false); }} type="checkbox" /><span>Usar o método biográfico padrão Mulheres do Leste: 10 capítulos, cronologia controlada, voz individual e fidelidade factual.</span></label> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">Título do projeto
              <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setProjectTitle(event.currentTarget.value)} placeholder="Ex.: Mulheres do Leste — história de Ana" value={projectTitle} />
            </label>
            <label className="text-xs font-bold text-slate-600">Nome da pessoa biografada
              <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setSubjectName(event.currentTarget.value)} placeholder="Nome como deve aparecer no livro" value={subjectName} />
            </label>
            <label className="text-xs font-bold text-slate-600">Quantidade desejada de capítulos ({minChapterCount}–{maxChapterCount})
              <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" disabled={mode === "women-biography" && womenMethod10} max={maxChapterCount} min={minChapterCount} onChange={(event) => setChapterCount(Math.max(minChapterCount, Math.min(maxChapterCount, Number(event.currentTarget.value) || minChapterCount)))} type="number" value={chapterCount} />
            </label>
            <label className="text-xs font-bold text-slate-600">Voz narrativa
              <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setNarrator(event.currentTarget.value as NarratorMode)} value={narrator}>
                <option value="subject-first-person">Primeira pessoa: como se a biografada contasse</option>
                <option value="ghostwriter-third-person">Terceira pessoa: ghostwriter narrando a história</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-bold text-slate-600">Orientação editorial e linha narrativa
            <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal leading-5 text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setEditorialNotes(event.currentTarget.value)} placeholder={mode === "women-biography" ? "Explique a linha editorial específica de Mulheres do Leste, os temas que devem conduzir a narrativa e o tom desejado." : "Informe tom, público, acontecimentos que precisam receber destaque e orientações do ghostwriter."} value={editorialNotes} />
          </label>
          {mode === "women-biography" ? (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <label className="block text-xs font-bold text-slate-700">Orientações adicionais e exemplos aprovados da coleção
                <textarea className="mt-1 min-h-24 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-normal leading-5 text-slate-900 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" maxLength={12_000} onChange={(event) => setCollectionGuide(event.currentTarget.value)} placeholder="O método padrão já está incorporado. Coloque aqui somente orientações particulares desta biografia ou exemplos aprovados." value={collectionGuide} />
              </label>
              <input accept=".txt,.md,.markdown,text/plain,text/markdown" className="hidden" onChange={(event) => void loadCollectionGuide(event.currentTarget.files?.[0])} ref={guideFileInputRef} type="file" />
              <ActionButton fullWidth={false} onClick={() => guideFileInputRef.current?.click()} type="button" variant="ghost"><FileUp className="h-4 w-4" /> Carregar guia TXT/Markdown</ActionButton>
            </div>
          ) : null}
          <details className="rounded-xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-800">Memória editorial revisável: pessoas, fatos, cronologia e voz</summary>
            <div className="space-y-3 border-t border-slate-200 p-4">
              <p className="text-xs leading-5 text-slate-600">A memória orienta novos capítulos, mas não substitui as fontes. Relatos, fatos confirmados, inferências e dúvidas ficam em campos separados para você revisar.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ["people", "Pessoas e identificações"], ["relationships", "Relações entre pessoas"], ["timeline", "Cronologia e datas"],
                  ["events", "Acontecimentos"], ["reportedFacts", "Relatos ainda não verificados"], ["confirmedFacts", "Fatos conferidos/aprovados"],
                   ["inferences", "Interpretações ou hipóteses da IA"], ["voiceAndTone", "Tom e modo de falar"], ["openQuestions", "Dúvidas abertas"],
                   ["characteristicQuotes", "Falas e expressões reais"], ["conflicts", "Conflitos e contradições"], ["milestones", "Marcos entre fases da vida"], ["factOwnership", "Fatos reservados por capítulo"],
                ] as Array<[keyof EditorialMemory, string]>).map(([field, label]) => (
                  <label className="text-xs font-bold text-slate-600" key={field}>{label}
                     <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-5 text-slate-900 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setMemory((current) => ({ ...current, [field]: event.currentTarget.value }))} value={memory[field] ?? ""} />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2"><ActionButton disabled={busy || !activeSources.length} fullWidth={false} loading={busy} onClick={() => void extractEditorialMemory()} type="button" variant="secondary"><WandSparkles className="h-4 w-4" /> Extrair/atualizar memória pelas fontes</ActionButton><ActionButton disabled={!Object.values(memory).some((value) => typeof value === "string" && value.trim())} fullWidth={false} onClick={() => onCopy("workflow-memory", Object.entries(memory).filter(([, value]) => typeof value === "string" && value.trim()).map(([key, value]) => `${key}\n${value}`).join("\n\n"))} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar memória</ActionButton></div>
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <ActionButton disabled={busy || !activeSources.length} fullWidth={false} loading={busy} onClick={() => void prepareBiography()} type="button" variant="primary"><WandSparkles className="h-4 w-4" /> Analisar todos os materiais e propor sumário</ActionButton>
            <ActionButton disabled={busy || !activeSources.length} fullWidth={false} loading={busy} onClick={() => void generateOutline()} type="button" variant="ghost">Atualizar somente o sumário</ActionButton>
            {outline ? <ActionButton fullWidth={false} onClick={() => onCopy("workflow-biography-outline", outline)} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar estrutura</ActionButton> : null}
          </div>
          {outlineIsStale ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">As fontes mudaram desde a criação desta estrutura. Ela foi preservada; gere uma nova proposta para considerar os materiais adicionados ou alterados.</p> : null}
          {outline ? <label className="block text-xs font-bold text-slate-600">Estrutura proposta — revise e edite antes de escrever
            <textarea className="mt-1 min-h-60 w-full rounded-xl border border-blue-200 bg-blue-50/30 p-4 text-sm font-normal leading-6 text-slate-800 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => { setOutline(event.currentTarget.value); setOutlineApproved(false); }} value={outline} />
          </label> : null}
          {mode === "women-biography" && womenMethod10 && outline ? <div className="flex flex-wrap items-center gap-3"><ActionButton disabled={outlineIsStale || outlineIsApproved} fullWidth={false} onClick={() => { setOutlineApproved(true); setOutlineApprovedFingerprint(textFingerprint(outline)); }} type="button" variant="secondary"><Check className="h-4 w-4" /> Aprovar sumário de 10 capítulos</ActionButton><span className="text-xs font-semibold text-slate-600">{outlineIsApproved ? "Sumário aprovado. Você pode escrever o capítulo 1." : "A escrita dos capítulos aguarda sua aprovação do sumário."}</span></div> : null}
          <details className="rounded-xl border border-slate-200 bg-white" open>
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-800">Mapa de capítulos e fontes</summary>
            <div className="space-y-2 border-t border-slate-100 p-3">
              {Array.from({ length: chapterCount }, (_, index) => index + 1).map((number) => {
                const chapter = chapters[String(number)];
                const linked = sourcesForChapter(number);
                return <div className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center" key={number}>
                  <input aria-label={`Selecionar capítulo ${number} para audiobook`} checked={Boolean(chapterSelection[String(number)])} className="h-4 w-4 accent-leste-blue" onChange={(event) => setChapterSelection((current) => ({ ...current, [number]: event.currentTarget.checked }))} type="checkbox" />
                   <button className="min-w-0 text-left" onClick={() => { setChapterNumber(number); setChapterTitle(chapter?.title || chapterTitleFromOutline(outline, number)); setPendingChapter(null); setChapterPreview(""); }} type="button">
                    <span className="block text-sm font-bold text-slate-900">Capítulo {number}: {chapter?.title || "A planejar"}</span>
                  <span className="mt-1 block break-words text-xs text-slate-600">{chapter ? `${linked.length} fonte(s) incluída(s) na geração: ${linked.map((source) => source.name).join(", ") || "nenhuma"}` : `${linked.length} fonte(s) disponível(is), ainda sem capítulo escrito`}</span>
                  </button>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${chapter?.status === "approved" ? "bg-emerald-100 text-emerald-800" : chapter?.status === "review" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>{chapterStatusLabels[chapter?.status ?? "planned"]}</span>
                </div>;
              })}
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">Fontes ainda não associadas à geração de um capítulo: {unusedSources.length ? unusedSources.map((source) => source.name).join(", ") : "todas as fontes estão associadas a algum capítulo"}. A associação indica material selecionado como contexto, não confirma que cada fato foi usado nem valida sua veracidade.</p>
            </div>
          </details>
          <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 md:grid-cols-[0.7fr_1.3fr]">
            <label className="text-xs font-bold text-slate-600">Número do capítulo
               <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" max={chapterCount} min={1} onChange={(event) => { const nextNumber = Math.max(1, Math.min(chapterCount, Number(event.currentTarget.value) || 1)); setChapterNumber(nextNumber); setChapterTitle(chapters[String(nextNumber)]?.title || chapterTitleFromOutline(outline, nextNumber)); setPendingChapter(null); setChapterPreview(""); }} type="number" value={chapterNumber} />
            </label>
            <label className="text-xs font-bold text-slate-600">Título ou assunto do capítulo
              <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => { const nextTitle = event.currentTarget.value; setChapterTitle(nextTitle); setChapters((current) => current[String(chapterNumber)] ? { ...current, [chapterNumber]: { ...current[String(chapterNumber)], title: nextTitle } } : current); }} placeholder="Use o título aprovado no plano" value={chapterTitle} />
            </label>
            <label className="text-xs font-bold text-slate-600 md:col-span-2">Continuidade e fatos já aprovados nos capítulos anteriores
              <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-5 text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setContinuityNotes(event.currentTarget.value)} placeholder="Cole ou registre aqui o contexto aprovado que deve permanecer consistente neste capítulo." value={continuityNotes} />
            </label>
            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
               <ActionButton disabled={busy || !activeSources.length || !canWriteCurrentChapter} fullWidth={false} loading={busy} onClick={() => void generateChapterPreview()} type="button" variant="ghost"><BookOpen className="h-4 w-4" /> Gerar prévia curta</ActionButton>
               <ActionButton disabled={busy || !activeSources.length || !canWriteCurrentChapter} fullWidth={false} loading={busy} onClick={() => void generateChapter()} type="button" variant="secondary"><PenLine className="h-4 w-4" /> Gerar rascunho deste capítulo</ActionButton>
              {currentChapter ? <span className="text-xs text-emerald-800">Rascunho do capítulo {chapterNumber} salvo no projeto atual.</span> : null}
            </div>
          </div>
          {chapterPreview ? <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-black text-slate-900">Prévia curta do capítulo {chapterNumber}</h4><ActionButton fullWidth={false} onClick={() => onCopy(`workflow-preview-${chapterNumber}`, chapterPreview)} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar prévia</ActionButton></div><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{chapterPreview}</p><p className="text-xs text-slate-500">A prévia é uma amostra editorial e não substitui o capítulo completo.</p></div> : null}
          {chapterIsStale ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">As fontes foram alteradas depois deste rascunho. O capítulo permanece salvo; revise as novas fontes antes de aprová-lo.</p> : null}
          {pendingChapter ? <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <h4 className="text-sm font-black text-amber-950">Compare a nova versão antes de substituir o capítulo</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              <div><p className="mb-1 text-xs font-bold text-slate-600">Versão atual</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">{currentChapter?.text}</pre></div>
              <div><p className="mb-1 text-xs font-bold text-slate-600">Nova versão candidata</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">{pendingChapter.text}</pre></div>
            </div>
            <div className="flex flex-wrap gap-2"><ActionButton fullWidth={false} onClick={acceptPendingChapter} type="button" variant="primary"><CheckCircle2 className="h-4 w-4" /> Aceitar nova versão</ActionButton><ActionButton fullWidth={false} onClick={() => setPendingChapter(null)} type="button" variant="ghost">Manter texto atual</ActionButton></div>
          </div> : null}
          {chapterIsStale ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">As fontes foram alteradas depois deste rascunho. O capítulo permanece salvo; revise as novas fontes antes de aprová-lo.</p> : null}
          {currentChapter ? <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-black text-slate-900">Capítulo {chapterNumber}: {currentChapter.title}</h4>
              <label className="text-xs font-bold text-slate-600">Estado
                <select className="ml-2 min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900" onChange={(event) => setChapters((current) => ({ ...current, [chapterNumber]: { ...currentChapter, status: event.currentTarget.value as ChapterWorkflowStatus } }))} value={currentChapter.status}>
                  {Object.entries(chapterStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2"><ActionButton fullWidth={false} onClick={() => onCopy(`workflow-chapter-${chapterNumber}`, currentChapter.text)} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar capítulo</ActionButton><ActionButton fullWidth={false} onClick={() => onCopy(`workflow-chapter-clean-${chapterNumber}`, cleanBookText(currentChapter.text))} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar versão de leitura</ActionButton></div>
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-slate-700">Rastreabilidade: citações [Fonte: …] remetem a fala original; [Transição editorial sugerida] é uma ligação narrativa proposta; interpretações ficam identificadas como hipótese. Edições feitas aqui são revisões do editor e ficam no histórico de versões.</p>
            <label className="block text-xs font-bold text-slate-600">Versão editorial com referências e observações
              <textarea className="mt-1 min-h-[360px] w-full rounded-xl border border-slate-300 bg-white p-4 text-sm font-normal leading-7 text-slate-800 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onBlur={() => { const baseline = chapterEditBaselineRef.current; if (baseline?.number === chapterNumber && baseline.text !== currentChapter.text) setChapters((current) => { const latest = current[String(chapterNumber)]; return latest ? { ...current, [chapterNumber]: { ...latest, revisions: [...latest.revisions, { text: baseline.text, savedAt: new Date().toISOString(), reason: "Antes da edição manual" }] } } : current; }); }} onChange={(event) => setChapters((current) => ({ ...current, [chapterNumber]: { ...current[String(chapterNumber)], title: chapterTitle || currentChapter.title, text: event.currentTarget.value, status: currentChapter.status === "approved" ? "review" : currentChapter.status } }))} onFocus={() => { chapterEditBaselineRef.current = { number: chapterNumber, text: currentChapter.text }; }} onSelect={(event) => { const field = event.currentTarget; setSelectedPassage(field.value.slice(field.selectionStart, field.selectionEnd)); }} ref={chapterTextAreaRef} value={currentChapter.text} />
            </label>
            <div className="flex flex-wrap gap-2"><ActionButton disabled={!selectedPassage.trim() || busy} fullWidth={false} loading={busy} onClick={() => void generatePassageRevision()} type="button" variant="ghost"><WandSparkles className="h-4 w-4" /> Melhorar apenas seleção</ActionButton>{currentChapter.revisions.length ? <span className="self-center text-xs text-slate-500">{currentChapter.revisions.length} versão(ões) anterior(es) preservada(s)</span> : null}</div>
            {passageCandidate ? <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-xs font-bold text-slate-700">Trecho original</p><p className="whitespace-pre-wrap text-sm text-slate-700">{passageCandidate.original}</p><p className="text-xs font-bold text-slate-700">Sugestão de revisão</p><textarea className="min-h-24 w-full rounded-lg border border-blue-200 bg-white p-3 text-sm leading-6" onChange={(event) => setPassageCandidate((current) => current ? { ...current, revised: event.currentTarget.value } : current)} value={passageCandidate.revised} /><div className="flex gap-2"><ActionButton fullWidth={false} onClick={acceptPassageRevision} type="button" variant="primary">Aplicar somente este trecho</ActionButton><ActionButton fullWidth={false} onClick={() => setPassageCandidate(null)} type="button" variant="ghost">Descartar</ActionButton></div></div> : null}
            <details className="rounded-lg border border-slate-200"><summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-700">Ver versões anteriores</summary><div className="space-y-3 p-3">{currentChapter.revisions.map((revision, index) => <div className="rounded-lg bg-slate-50 p-3" key={`${revision.savedAt}-${index}`}><p className="text-xs font-semibold text-slate-500">{revision.reason || "Versão anterior"} · {revision.savedAt ? new Date(revision.savedAt).toLocaleString("pt-BR") : "data não registrada"}</p><pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{revision.text}</pre><ActionButton fullWidth={false} onClick={() => { setChapters((current) => ({ ...current, [chapterNumber]: { ...currentChapter, text: revision.text, status: "review", revisions: [...currentChapter.revisions, { text: currentChapter.text, savedAt: new Date().toISOString(), reason: "Antes da restauração desta versão" }] } })); }} type="button" variant="ghost"><RotateCcw className="h-3.5 w-3.5" /> Restaurar esta versão</ActionButton></div>)}</div></details>
          </div> : null}
          <div className="space-y-3 rounded-xl border border-leste-blue/20 bg-blue-50/50 p-4">
            <div><h4 className="text-base font-black text-slate-950">Livro completo em DOCX</h4><p className="mt-1 text-xs leading-5 text-slate-700">O arquivo final reúne os {chapterCount} capítulos aprovados, em ordem, sem memória de trabalho, perguntas ou marcações de fonte. A narração é opcional.</p></div>
            <p className="text-xs font-semibold text-slate-700">{bookChapters.filter(({ chapter }) => chapter?.status === "approved").length} de {chapterCount} capítulos aprovados{outlineIsStale ? " · fontes alteradas após o sumário: confira antes da entrega" : ""}</p>
            <div className="flex flex-wrap gap-2"><ActionButton disabled={!bookReady} fullWidth={false} onClick={() => onCopy("workflow-complete-book", bookText)} type="button" variant="secondary"><Copy className="h-4 w-4" /> Copiar livro completo</ActionButton><ActionButton disabled={!bookReady} fullWidth={false} onClick={() => onDownloadDocx(projectTitle || `Biografia de ${subjectName || "uma mulher"}`, bookSections)} type="button" variant="primary"><FileDown className="h-4 w-4" /> Baixar livro completo em DOCX</ActionButton></div>
            {bookReady ? <details className="rounded-lg border border-blue-100 bg-white"><summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-700">Conferir texto que será copiado e exportado</summary><textarea className="min-h-56 w-full resize-y border-t border-blue-100 p-3 text-sm leading-6 text-slate-700" readOnly value={bookText} /></details> : <p className="text-xs text-amber-900">Revise e aprove todos os capítulos para liberar o manuscrito final.</p>}
          </div>
          {currentChapter ? <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div><h4 className="text-sm font-black text-slate-900">Texto aprovado para narração</h4><p className="mt-1 text-xs leading-5 text-slate-600">Separado da versão editorial: referências, transições marcadas e “Pontos para confirmar” não devem ser lidos pela Milena.</p></div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-bold text-slate-600">Versão
                <select className="mt-1 min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm" onChange={(event) => setNarrationMode(event.currentTarget.value as typeof narrationMode)} value={narrationMode}><option value="faithful">Fiel</option><option value="natural">Natural para leitura</option><option value="adapted">Adaptada para voz</option></select>
              </label>
              <ActionButton disabled={busy} fullWidth={false} loading={busy} onClick={() => void prepareNarrationDraft()} type="button" variant="secondary">Preparar versão de voz</ActionButton>
              {narrationIsStale ? <span className="text-xs font-semibold text-amber-800">O capítulo mudou depois da última revisão da narração.</span> : null}
            </div>
            <label className="block text-xs font-bold text-slate-600">Texto que será narrado (edite livremente)
              <textarea className="mt-1 min-h-44 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-800" onChange={(event) => setChapters((current) => ({ ...current, [chapterNumber]: { ...currentChapter, narrationText: event.currentTarget.value } }))} value={chapterNarrationText(currentChapter)} />
            </label>
            <label className="block text-xs font-bold text-slate-600">Pronúncias personalizadas (uma por linha: “Leste Valley → Leste Véli”)
              <textarea className="mt-1 min-h-16 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal" onChange={(event) => setPronunciationNotes(event.currentTarget.value)} placeholder="Original: Leste Valley → Pronúncia: Leste Véli" value={pronunciationNotes} />
            </label>
            <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs font-bold text-slate-600">Prévia da narração</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{currentSpeechText.slice(0, 900)}{currentSpeechText.length > 900 ? "…" : ""}</p></div>
            <div className="flex flex-wrap gap-2"><ActionButton disabled={busy || currentChapter.status !== "approved"} fullWidth={false} onClick={() => setChapterSelection((current) => ({ ...current, [chapterNumber]: !current[chapterNumber] }))} type="button" variant="ghost">{chapterSelection[String(chapterNumber)] ? "Remover do audiobook" : "Selecionar para audiobook"}</ActionButton><span className="self-center text-xs text-slate-500">Aprovar o capítulo antes de narrar é recomendado.</span></div>
          </div> : null}
          {Object.keys(chapters).length ? <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <h4 className="text-sm font-black text-slate-900">Produzir audiobook por capítulos</h4>
            <p className="text-xs leading-5 text-slate-700">{selectedWords.toLocaleString("pt-BR")} palavras · cerca de {estimatedMinutes} min · estimativa aproximada: US$ {estimatedUsd.toFixed(3)} com {audiobookTtsModel}. O valor real depende da contagem de tokens e das tarifas vigentes.</p>
            <div className="flex flex-wrap gap-2"><ActionButton disabled={busy || !selectedChapters.length} fullWidth={false} loading={busy} onClick={() => void generateSelectedAudiobook()} type="button" variant="primary"><Mic2 className="h-4 w-4" /> Gerar/retomar capítulos selecionados</ActionButton><ActionButton disabled={!selectedChapters.length} fullWidth={false} onClick={() => void downloadSelectedAudiobook()} type="button" variant="secondary"><FileDown className="h-4 w-4" /> Baixar pacote ZIP</ActionButton><ActionButton disabled={!selectedChapters.length} fullWidth={false} onClick={() => void downloadCompleteAudiobook()} type="button" variant="ghost"><Download className="h-4 w-4" /> Baixar áudio completo</ActionButton></div>
            {audiobookProgress ? <p aria-live="polite" className="text-xs font-bold text-blue-900">{audiobookProgress}</p> : null}
            <div className="space-y-2">{Object.entries(chapters).sort(([a], [b]) => Number(a) - Number(b)).map(([number, chapter]) => {
              const text = applyPronunciationReplacements(chapterNarrationText(chapter), pronunciationNotes);
              const key = `review:workflow-chapter-${number}-${textFingerprint(text)}`;
              const url = speechAudioUrls[key];
              const active = activeSpeechKey === key;
              return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3" key={number}><span className="text-xs font-bold text-slate-800">Capítulo {number}: {chapter.title} · {Math.max(1, Math.ceil(chapter.text.split(/\s+/).filter(Boolean).length / 150))} min</span><div className="flex gap-1">{url ? <><ActionButton fullWidth={false} onClick={() => onSpeak(key, chapter.title, text)} type="button" variant="ghost">{active ? "Ouvir" : "Ouvir"}</ActionButton><ActionButton fullWidth={false} onClick={() => onDownloadSpeech(key, chapter.title)} type="button" variant="ghost"><Download className="h-4 w-4" /> MP3</ActionButton></> : <span className="self-center text-xs text-slate-500">Ainda não gerado</span>}</div></div>;
            })}</div>
          </div> : null}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-black text-slate-900">Perguntas para preencher lacunas</h4><ActionButton disabled={busy || !allSources.length} fullWidth={false} loading={busy} onClick={() => void generateFollowUps()} type="button" variant="ghost"><CircleHelp className="h-4 w-4" /> Gerar perguntas</ActionButton></div>
            <textarea className="min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm leading-6" onChange={(event) => setFollowUpQuestions(event.currentTarget.value)} placeholder="Perguntas complementares para a entrevistada; revise antes de enviar." value={followUpQuestions} />
            {followUpQuestions ? <ActionButton fullWidth={false} onClick={() => onCopy("workflow-followups-whatsapp", `Olá! Para completar a sua história, poderia me ajudar com algumas informações?\n\n${followUpQuestions}`)} type="button" variant="secondary"><Copy className="h-4 w-4" /> Copiar mensagem para WhatsApp</ActionButton> : null}
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-black text-slate-900">Conferência editorial final</h4><ActionButton disabled={busy || !Object.keys(chapters).length} fullWidth={false} loading={busy} onClick={() => void runFinalQualityCheck()} type="button" variant="secondary"><CheckCircle2 className="h-4 w-4" /> Conferir entrega</ActionButton></div>{qualityReport ? <textarea className="min-h-40 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6" onChange={(event) => setQualityReport(event.currentTarget.value)} value={qualityReport} /> : <p className="text-xs text-slate-600">Verifica capítulos faltantes, dúvidas, fontes não aproveitadas, repetições e narrações geradas com versões antigas.</p>}</div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Users className="h-5 w-5 text-leste-blue" /> Relatório e encaminhamentos da reunião</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">O relatório identifica o contexto de trabalho e separa o que foi dito, decidido, combinado e sugerido. Responsáveis e prazos só são atribuídos quando aparecem nas fontes.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">Título ou equipe
              <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setProjectTitle(event.currentTarget.value)} placeholder="Ex.: Reunião de planejamento comercial" value={projectTitle} />
            </label>
            <label className="text-xs font-bold text-slate-600">Orientação adicional
              <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setEditorialNotes(event.currentTarget.value)} placeholder="Ex.: destacar riscos e prazos" value={editorialNotes} />
            </label>
          </div>
          <ActionButton disabled={busy || !allSources.length} fullWidth={false} loading={busy} onClick={() => void analyzeMeeting()} type="button" variant="primary"><WandSparkles className="h-4 w-4" /> Analisar a reunião completa</ActionButton>
          {meetingIsStale ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">As fontes mudaram desde a análise. O relatório anterior está preservado; analise novamente para incorporar os materiais novos.</p> : null}
          {meetingReport ? <label className="block text-xs font-bold text-slate-600">Relatório editável
            <textarea className="mt-1 min-h-[360px] w-full rounded-xl border border-blue-200 bg-blue-50/30 p-4 text-sm font-normal leading-6 text-slate-800 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setMeetingReport(event.currentTarget.value)} value={meetingReport} />
          </label> : null}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-black text-slate-900">Tarefas e encaminhamentos rastreáveis</h4><p className="text-xs text-slate-600">Classifique compromisso, proposta ou sugestão; ajuste responsável, prazo e situação.</p></div><ActionButton disabled={busy || !allSources.length} fullWidth={false} loading={busy} onClick={() => void extractMeetingActions()} type="button" variant="secondary"><WandSparkles className="h-4 w-4" /> Extrair ações</ActionButton></div>
            {meetingActions.map((action, index) => <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-2" key={action.id}>
              <label className="text-xs font-bold text-slate-600 md:col-span-2">Tarefa
                <input className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900" onChange={(event) => setMeetingActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.currentTarget.value } : item))} value={action.title} />
              </label>
              <label className="text-xs font-bold text-slate-600">Responsável
                <input className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900" onChange={(event) => setMeetingActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, owner: event.currentTarget.value } : item))} value={action.owner} />
              </label>
              <label className="text-xs font-bold text-slate-600">Prazo
                <input className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900" onChange={(event) => setMeetingActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, deadline: event.currentTarget.value } : item))} value={action.deadline} />
              </label>
              <label className="text-xs font-bold text-slate-600">Classificação
                <select className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" onChange={(event) => setMeetingActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, kind: event.currentTarget.value as MeetingAction["kind"] } : item))} value={action.kind}><option value="agreed">Compromisso assumido</option><option value="proposed">Proposta discutida</option><option value="suggested">Sugestão da IA</option></select>
              </label>
              <label className="text-xs font-bold text-slate-600">Situação
                <select className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" onChange={(event) => setMeetingActions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: event.currentTarget.value as MeetingAction["status"] } : item))} value={action.status}><option value="open">Pendente</option><option value="in-progress">Em andamento</option><option value="done">Concluída</option></select>
              </label>
              <div className="rounded-lg bg-blue-50 p-2 text-xs leading-5 text-slate-700 md:col-span-2"><strong>Evidência:</strong> “{action.evidence}” <span className="ml-1 text-slate-500">· {action.sourceName}</span></div>
            </div>)}
          </div>
          {meetingReport ? <div className="flex flex-wrap gap-2"><ActionButton disabled={busy || !allSources.length} fullWidth={false} loading={busy} onClick={() => void generateFollowUps()} type="button" variant="ghost"><CircleHelp className="h-4 w-4" /> Sugerir perguntas de acompanhamento</ActionButton></div> : null}
          {followUpQuestions ? <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><label className="block text-xs font-bold text-slate-700">Perguntas de acompanhamento revisáveis
            <textarea className="mt-1 min-h-24 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm leading-6" onChange={(event) => setFollowUpQuestions(event.currentTarget.value)} value={followUpQuestions} />
          </label><ActionButton fullWidth={false} onClick={() => onCopy("workflow-meeting-followups", followUpQuestions)} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar perguntas</ActionButton></div> : null}
        </div>
      )}

      {busy ? <div aria-live="polite" className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900"><LoaderCircle className="h-4 w-4 animate-spin" /> {progress || "Processando fontes..."}</div> : null}
      {error ? <ErrorBox message={error} /> : null}
      {success ? <p aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><Check className="mr-1 inline h-4 w-4" /> {success}</p> : null}

      {availableResultSections.length ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-base font-black text-slate-950">Revisar, ouvir e exportar o que foi produzido</h3>
          <div className="flex flex-wrap gap-2">
            <ActionButton fullWidth={false} onClick={() => onDownloadDocx(projectTitle || (mode === "meeting" ? "Relatório da reunião" : "Biografia"), availableResultSections)} type="button" variant="secondary"><FileDown className="h-4 w-4" /> {mode === "meeting" ? "Baixar DOCX" : "Baixar dossiê editorial DOCX"}</ActionButton>
            <ActionButton fullWidth={false} onClick={() => onCopy("workflow-editorial-all", availableResultSections.map((section) => `${section.title}\n\n${section.content}`).join("\n\n"))} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar conteúdo produzido</ActionButton>
            <ActionButton fullWidth={false} onClick={() => onUseInContext(availableResultSections.map((section) => `${section.title}\n\n${section.content}`).join("\n\n"))} type="button" variant="ghost">Usar na Central Inteligente</ActionButton>
            {currentSpeechText.trim() ? <ActionButton disabled={currentSpeechLoading} fullWidth={false} loading={currentSpeechLoading} onClick={() => onSpeak(currentSpeechKey, currentSpeechTitle, currentSpeechText)} type="button" variant="ghost"><Mic2 className="h-4 w-4" /> Ouvir com a Milena</ActionButton> : null}
            {currentSpeechUrl ? <ActionButton fullWidth={false} onClick={() => onDownloadSpeech(currentSpeechKey, currentSpeechTitle)} type="button" variant="ghost"><Download className="h-4 w-4" /> Baixar MP3</ActionButton> : null}
            {currentSpeechActive ? <ActionButton fullWidth={false} onClick={onStopSpeech} type="button" variant="danger"><Headphones className="h-4 w-4" /> Parar leitura</ActionButton> : null}
          </div>
          {currentSpeechUrl ? <audio className="w-full" controls src={currentSpeechUrl} /> : null}
          {currentSpeechError ? <ErrorBox message={currentSpeechError} /> : null}
        </div>
      ) : null}
    </section>
  );
}
