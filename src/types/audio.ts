export type AudioStatus =
  | "idle"
  | "queued"
  | "uploading"
  | "converting"
  | "transcribing"
  | "done"
  | "error";

export type AutoDetectedIntent = {
  intencao_principal: string;
  intencoes_secundarias: string[];
  tipo_de_solicitacao: string;
  resumo_do_entendimento: string;
  objetivo_final: string;
  entidades_identificadas: {
    conteudos: string[];
    pessoas: string[];
    formatos: string[];
    datas: string[];
    restricoes: string[];
    preferencias: string[];
  };
  acoes_necessarias: string[];
  ordem_de_execucao: string[];
  informacoes_faltantes: string[];
  nivel_de_confianca: number;
  pode_executar_automaticamente: boolean;
  instrucao_convertida: string;
  resposta_para_o_usuario: string;
};

export type AudioContentKind =
  | "article"
  | "businessPlan"
  | "copy"
  | "marketingStrategy"
  | "post"
  | "script"
  | "storytelling"
  | "whatsapp"
  | "audiobookOutline";

export type AudioIntelligenceResult = {
  subject: string;
  context: string;
  language: string;
  primaryIntent: string;
  confidence: number;
  summary: string;
  topics: string[];
  keyPoints: string[];
  insights: string[];
  tasks: Array<{
    title: string;
    owner: string;
    dueDate: string;
    evidence: string;
  }>;
  decisions: Array<{
    text: string;
    evidence: string;
  }>;
  entities: {
    people: string[];
    companies: string[];
    dates: string[];
    values: string[];
    links: string[];
  };
  opportunities: string[];
  risks: string[];
  questions: string[];
  suggestedContents: Array<{
    type: string;
    title: string;
    purpose: string;
  }>;
  narrative: {
    title: string;
    premise: string;
    beginning: string;
    middle: string;
    ending: string;
    chapters: Array<{
      title: string;
      synopsis: string;
    }>;
  };
  diarization?: {
    speakers: AudioSpeaker[];
    segments: TranscriptSegment[];
  };
};

/** A source-faithful excerpt. Times are optional because not every provider returns them. */
export type TranscriptSegment = {
  id: string;
  text: string;
  startSeconds?: number;
  endSeconds?: number;
  speakerId?: string;
  speakerLabel?: string;
  confidence?: number;
  timingApproximate?: boolean;
};

export type AudioSpeaker = {
  id: string;
  label: string;
  confidence?: number;
  unverified?: boolean;
};

export type ContinuityGroup = {
  id: string;
  title: string;
  itemIds: string[];
  explanation?: string;
  confidence?: number;
};

export type ContinuityPlan = {
  groups: ContinuityGroup[];
  warnings: string[];
  generatedAt: string;
};

export type SourceReference = {
  sourceId: string;
  chunkId: string;
  sourceName: string;
  quote: string;
  speakerLabel?: string;
  startSeconds?: number;
  endSeconds?: number;
};

export type AskFilesAnswer = {
  answer: string;
  facts: string[];
  inferences: string[];
  notFound: string[];
  references: SourceReference[];
};

export type AudioItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  extension: string;
  status: AudioStatus;
  progress: number;
  transcription?: string;
  segments?: TranscriptSegment[];
  speakers?: AudioSpeaker[];
  segmentWarning?: string;
  summary?: string;
  organizedText?: string;
  autoDetectedIntent?: AutoDetectedIntent;
  audioIntelligence?: AudioIntelligenceResult;
  generatedContents?: Partial<Record<AudioContentKind, string>>;
  error?: string;
};

export type TranscriptionResponse = {
  ok: boolean;
  transcription?: string;
  error?: string;
  meta?: {
    originalFileName: string;
    converted: boolean;
    model: string;
  };
};

export type TextProcessResponse = {
  ok: boolean;
  result?: string;
  error?: string;
  model?: string;
};

export type AnalyzeAllItem = {
  name: string;
  transcription: string;
};

export type AnalyzeAllMode = "analysis" | "tasks" | "keyData" | "reply" | "intent";

export type PromptTransformFormat = "app" | "webApp" | "landingPage" | "existingProject";

export type ContentSourceType =
  | "audio"
  | "text"
  | "pdf"
  | "docx"
  | "image"
  | "youtube"
  | "url"
  | "generated";

export type ContentSource = {
  id: string;
  type: ContentSourceType;
  name: string;
  originalContent?: string;
  extractedContent: string;
  projectId?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  enabledInContext: boolean;
};

export type UnifiedAction =
  | "analisar_tudo"
  | "analisar_e_criar"
  | "entender_intencao"
  | "corrigir_texto"
  | "reescrever"
  | "resumir"
  | "organizar"
  | "expandir"
  | "encurtar"
  | "humanizar"
  | "profissionalizar"
  | "melhorar_clareza"
  | "remover_repeticoes"
  | "extrair_tarefas"
  | "extrair_decisoes"
  | "extrair_dados"
  | "criar_resposta"
  | "criar_plano_acao"
  | "criar_cronograma"
  | "detectar_problemas"
  | "detectar_oportunidades"
  | "apontar_contradicoes"
  | "compreensao_global"
  | "interpretacao"
  | "extracao"
  | "mapeamentos"
  | "diagnostico"
  | "recomendacoes"
  | "criacao"
  | "processo_criativo"
  | "comparacao"
  | "identificar_faltantes"
  | "continuar_raciocinio"
  | "transformar_em_projeto"
  | "transformar_em_prompt"
  | "criar_conteudo"
  | "criar_documentacao"
  | "criar_especificacao"
  | "criar_mvp"
  | "criar_modelo_negocio";

/* ─────────── MILENA VOZ — NOVO MÓDULO ─────────── */

export type NarrationPrepMode = "fiel" | "natural" | "adaptada";

export type NarrationStyle =
  | "natural"
  | "formal"
  | "emocional"
  | "didatica"
  | "institucional"
  | "audiolivro"
  | "noticia"
  | "apresentacao"
  | "treinamento"
  | "podcast"
  | "roteiro";

export type NarrationOptions = {
  speed: number;          // 0.5 – 2.0
  pitch: number;          // -10 – 10
  volume: number;         // 0 – 100
  pauseEntreParagrafos: number;  // ms
  pauseEntreCapitulos: number;    // ms
  estilo: NarrationStyle;
};

export type PronunciationEntry = {
  id?: string;
  original: string;
  pronuncia: string;
};

export type SpeechChunk = {
  index: number;
  text: string;
  chapter?: string;
  status: "pending" | "processing" | "done" | "error";
  retries: number;
  audioUrl?: string;
  durationMs?: number;
  error?: string;
};

export type SpeechQueueStatus = "idle" | "running" | "paused" | "cancelled" | "done" | "error";

export type SpeechQueue = {
  id: string;
  title: string;
  totalChunks: number;
  processedChunks: number;
  status: SpeechQueueStatus;
  chunks: SpeechChunk[];
  currentChapter?: string;
  startedAt?: string;
  completedAt?: string;
  documentoOrigem?: string;
  narracaoOptions: NarrationOptions;
  prepMode: NarrationPrepMode;
};

export type AudiobookChapter = {
  id: string;
  title: string;
  text: string;
  order: number;
  status: "pending" | "processing" | "done" | "error";
  audioUrl?: string;
  durationMs?: number;
};

export type AudiobookProject = {
  id: string;
  titulo: string;
  autor?: string;
  introducao?: string;
  encerramento?: string;
  chapters: AudiobookChapter[];
  progresso: number;   // 0-100
  status: "draft" | "processing" | "done";
  narracaoOptions: NarrationOptions;
  prepMode: NarrationPrepMode;
  vozPadrao: string;
  createdAt: string;
  updatedAt: string;
};

export type AudioHistoryItem = {
  id: string;
  title: string;
  sourceText: string;
  sourceLabel: string;
  date: string;
  durationMs?: number;
  format: "mp3" | "wav" | "m4a";
  voice: string;
  speed: number;
  estilo: NarrationStyle;
  chapters?: { title: string; durationMs: number }[];
  audioUrl?: string;
  blobSize?: number;
  documentoOrigem?: string;
  projectPath?: string;
};

export type PreparedText = {
  original: string;
  prepared: string;
  mode: NarrationPrepMode;
  metadata: {
    titulos: string[];
    capitulos: string[];
    totalCaracteres: number;
    totalPalavras: number;
    totalParagrafos: number;
    chunkCount: number;
    estimatedDurationMinutes: number;
  };
};
