"use client";

import { useEffect, useRef } from "react";

import {
  BookOpen,
  Brain,
  Copy,
  Download,
  FileText,
  Headphones,
  Sparkles,
  Volume2,
} from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import type { AudioContentKind, AudioIntelligenceResult } from "@/types/audio";

type AudioIntelligencePanelProps = {
  activeSpeechKey: string | null;
  analysis?: AudioIntelligenceResult;
  copiedKey: string | null;
  contentError?: string;
  generatedContents?: Partial<Record<AudioContentKind, string>>;
  itemId: string;
  isAnalyzing: boolean;
  loadingContentKind?: AudioContentKind;
  onAnalyze: () => void;
  onCopy: (key: string, text: string) => void;
  onDownloadDocx: () => void;
  onDownloadSpeech: (key: string, label: string) => void;
  onGenerateContent: (kind: AudioContentKind) => void;
  onSpeak: (key: string, title: string, text: string) => void;
  onStopSpeech: () => void;
  speechAudioUrls: Record<string, string | undefined>;
  speechErrors: Record<string, string | undefined>;
  taskError?: string;
};

const contentActions: Array<{
  kind: AudioContentKind;
  label: string;
}> = [
  { kind: "article", label: "Criar artigo" },
  { kind: "businessPlan", label: "Criar plano de negócios" },
  { kind: "copy", label: "Criar copy" },
  { kind: "marketingStrategy", label: "Criar estratégia de marketing" },
  { kind: "post", label: "Criar post" },
  { kind: "script", label: "Criar roteiro" },
  { kind: "storytelling", label: "Criar storytelling" },
  { kind: "whatsapp", label: "Resposta WhatsApp" },
  { kind: "audiobookOutline", label: "Plano de audiolivro" },
];

const contentTitles: Record<AudioContentKind, string> = {
  article: "Artigo gerado a partir do áudio",
  businessPlan: "Plano de negócios gerado a partir do áudio",
  copy: "Copy gerada a partir do áudio",
  marketingStrategy: "Estratégia de marketing gerada a partir do áudio",
  post: "Post gerado a partir do áudio",
  script: "Roteiro gerado a partir do áudio",
  storytelling: "Storytelling gerado a partir do áudio",
  whatsapp: "Resposta para WhatsApp",
  audiobookOutline: "Plano de audiolivro",
};

function joinLines(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "Nenhum item identificado.";
}

export function formatAudioIntelligenceResult(analysis: AudioIntelligenceResult) {
  const tasks = analysis.tasks.length
    ? analysis.tasks
        .map((task) =>
          [task.title, task.owner && `Responsável: ${task.owner}`, task.dueDate && `Prazo: ${task.dueDate}`]
            .filter(Boolean)
            .join(" | "),
        )
        .map((task) => `- ${task}`)
        .join("\n")
    : "Nenhuma tarefa identificada.";
  const decisions = analysis.decisions.length
    ? analysis.decisions.map((decision) => `- ${decision.text}`).join("\n")
    : "Nenhuma decisão identificada.";

  return [
    `Assunto: ${analysis.subject}`,
    `Contexto: ${analysis.context}`,
    `Intenção: ${analysis.primaryIntent}`,
    `Confiança da classificação: ${analysis.confidence}%`,
    "",
    "Resumo:",
    analysis.summary,
    "",
    "Temas:",
    joinLines(analysis.topics),
    "",
    "Pontos principais:",
    joinLines(analysis.keyPoints),
    "",
    "Insights:",
    joinLines(analysis.insights),
    "",
    "Tarefas:",
    tasks,
    "",
    "Decisões:",
    decisions,
    "",
    "Oportunidades:",
    joinLines(analysis.opportunities),
    "",
    "Riscos e dúvidas:",
    joinLines([...analysis.risks, ...analysis.questions]),
  ].join("\n");
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h5 className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</h5>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function MilenaAudioPlayer({ isActive, url }: { isActive: boolean; url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (isActive) {
      void audio.play().catch(() => {
        // The browser can block autoplay; the visible controls remain available.
      });
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }, [isActive, url]);

  return (
    <audio className="w-full" controls preload="metadata" ref={audioRef} src={url}>
      Seu navegador não suporta áudio.
    </audio>
  );
}

function GeneratedContent({
  activeSpeechKey,
  copiedKey,
  kind,
  itemId,
  onCopy,
  onDownloadSpeech,
  onSpeak,
  onStopSpeech,
  speechAudioUrls,
  speechErrors,
  text,
}: {
  activeSpeechKey: string | null;
  copiedKey: string | null;
  kind: AudioContentKind;
  itemId: string;
  onCopy: (key: string, text: string) => void;
  onDownloadSpeech: (key: string, label: string) => void;
  onSpeak: (key: string, title: string, text: string) => void;
  onStopSpeech: () => void;
  speechAudioUrls: Record<string, string | undefined>;
  speechErrors: Record<string, string | undefined>;
  text: string;
}) {
  const speechKey = `advanced:${itemId}:content:${kind}`;
  const audioUrl = speechAudioUrls[speechKey];
  const isActive = activeSpeechKey === speechKey;

  return (
    <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-black uppercase text-slate-800">{contentTitles[kind]}</h4>
        <div className="grid gap-2 sm:flex">
          <ActionButton
            className="sm:w-auto"
            fullWidth
            onClick={() => onSpeak(speechKey, contentTitles[kind], text)}
            type="button"
            variant="secondary"
          >
            <Volume2 className="h-4 w-4" />
            Ouvir com Milena
          </ActionButton>
          <ActionButton
            className="sm:w-auto"
            fullWidth
            onClick={() => onCopy(`advanced:${itemId}:content:${kind}`, text)}
            type="button"
            variant="ghost"
          >
            <Copy className="h-4 w-4" />
            {copiedKey === `advanced:${itemId}:content:${kind}` ? "Copiado" : "Copiar"}
          </ActionButton>
        </div>
      </div>
      <textarea
        className="min-h-[190px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
        readOnly
        value={text}
      />
      {speechErrors[speechKey] ? <ErrorBox message={speechErrors[speechKey]!} /> : null}
      {audioUrl ? (
        <div className="rounded-lg border border-indigo-100 bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Headphones className="h-4 w-4 text-leste-blue" />
              Leitura com voz da Milena
            </span>
            <div className="flex gap-2">
              {isActive ? (
                <ActionButton fullWidth={false} onClick={onStopSpeech} type="button" variant="ghost">
                  Pausar / parar
                </ActionButton>
              ) : null}
              <ActionButton
                fullWidth={false}
                onClick={() => onDownloadSpeech(speechKey, contentTitles[kind])}
                type="button"
                variant="ghost"
              >
                <Download className="h-4 w-4" />
                Baixar MP3
              </ActionButton>
            </div>
          </div>
          <MilenaAudioPlayer isActive={isActive} url={audioUrl} />
        </div>
      ) : null}
    </div>
  );
}

export default function AudioIntelligencePanel({
  activeSpeechKey,
  analysis,
  copiedKey,
  contentError,
  generatedContents,
  itemId,
  isAnalyzing,
  loadingContentKind,
  onAnalyze,
  onCopy,
  onDownloadDocx,
  onDownloadSpeech,
  onGenerateContent,
  onSpeak,
  onStopSpeech,
  speechAudioUrls,
  speechErrors,
  taskError,
}: AudioIntelligencePanelProps) {
  const analysisText = analysis ? formatAudioIntelligenceResult(analysis) : "";
  const analysisSpeechKey = `advanced:${itemId}:analysis`;
  const analysisAudioUrl = speechAudioUrls[analysisSpeechKey];
  const isAnalysisActive = activeSpeechKey === analysisSpeechKey;

  return (
    <section className="space-y-4 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-leste-blue text-white">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-950">Entendimento avançado do áudio</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Identifica assunto, contexto, intenção, tarefas, decisões, dados-chave e caminhos para novos conteúdos.
            </p>
          </div>
        </div>
        <ActionButton
          className="lg:w-auto"
          fullWidth
          loading={isAnalyzing}
          onClick={onAnalyze}
          type="button"
          variant="primary"
        >
          <Sparkles className="h-4 w-4" />
          {analysis ? "Atualizar análise" : "Analisar áudio"}
        </ActionButton>
      </div>

      {taskError ? <ErrorBox message={taskError} /> : null}

      {!analysis ? (
        <p className="rounded-lg border border-dashed border-indigo-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
          A análise usa o arquivo original, não apenas a transcrição. O áudio é enviado de forma temporária, sem histórico da sessão.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Assunto</span>
              <p className="mt-1 text-sm font-bold text-slate-800">{analysis.subject}</p>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Intenção</span>
              <p className="mt-1 text-sm font-bold text-slate-800">{analysis.primaryIntent}</p>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Contexto</span>
              <p className="mt-1 text-sm font-bold text-slate-800">{analysis.context}</p>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Confiança</span>
              <p className="mt-1 text-sm font-bold text-slate-800">{analysis.confidence}%</p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-sm font-black uppercase text-slate-800">Leitura da análise</h4>
              <div className="grid gap-2 sm:flex">
                <ActionButton
                  className="sm:w-auto"
                  fullWidth
                  onClick={onDownloadDocx}
                  type="button"
                  variant="primary"
                >
                  <Download className="h-4 w-4" />
                  Baixar entendimento completo DOCX
                </ActionButton>
                <ActionButton
                  className="sm:w-auto"
                  fullWidth
                  onClick={() => onSpeak(analysisSpeechKey, "Análise avançada do áudio", analysisText)}
                  type="button"
                  variant="secondary"
                >
                  <Volume2 className="h-4 w-4" />
                  Ouvir com Milena
                </ActionButton>
                <ActionButton
                  className="sm:w-auto"
                  fullWidth
                  onClick={() => onCopy(`advanced:${itemId}:analysis`, analysisText)}
                  type="button"
                  variant="ghost"
                >
                  <Copy className="h-4 w-4" />
                  {copiedKey === `advanced:${itemId}:analysis` ? "Copiado" : "Copiar análise"}
                </ActionButton>
              </div>
            </div>
            <textarea
              className="min-h-[180px] w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
              readOnly
              value={analysisText}
            />
            {speechErrors[analysisSpeechKey] ? <ErrorBox message={speechErrors[analysisSpeechKey]!} /> : null}
            {analysisAudioUrl ? (
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <Headphones className="h-4 w-4 text-leste-blue" />
                    Leitura com voz da Milena
                  </span>
                  <div className="flex gap-2">
                    {isAnalysisActive ? (
                      <ActionButton fullWidth={false} onClick={onStopSpeech} type="button" variant="ghost">
                        Pausar / parar
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      fullWidth={false}
                      onClick={() => onDownloadSpeech(analysisSpeechKey, "analise-avancada-audio")}
                      type="button"
                      variant="ghost"
                    >
                      <Download className="h-4 w-4" />
                      Baixar MP3
                    </ActionButton>
                  </div>
                </div>
                <MilenaAudioPlayer isActive={isAnalysisActive} url={analysisAudioUrl} />
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <DetailList title="Temas" items={analysis.topics} />
            <DetailList title="Pontos principais" items={analysis.keyPoints} />
            <DetailList title="Insights" items={analysis.insights} />
            <DetailList title="Oportunidades" items={analysis.opportunities} />
            <DetailList title="Riscos" items={analysis.risks} />
            <DetailList title="Dúvidas" items={analysis.questions} />
          </div>

          <DetailList
            title="Conteúdos sugeridos"
            items={analysis.suggestedContents.map(
              (content) => `${content.type}: ${content.title} - ${content.purpose}`,
            )}
          />

          {(analysis.tasks.length || analysis.decisions.length) ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <h5 className="text-xs font-black uppercase tracking-wide text-slate-500">Tarefas e próximos passos</h5>
                <div className="mt-2 space-y-2 text-sm leading-5 text-slate-700">
                  {analysis.tasks.length ? analysis.tasks.map((task, index) => (
                    <p key={`${task.title}-${index}`}>
                      <strong>{task.title}</strong>
                      {task.owner ? ` | Responsável: ${task.owner}` : ""}
                      {task.dueDate ? ` | Prazo: ${task.dueDate}` : ""}
                    </p>
                  )) : <p>Nenhuma tarefa identificada.</p>}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <h5 className="text-xs font-black uppercase tracking-wide text-slate-500">Decisões citadas</h5>
                <div className="mt-2 space-y-2 text-sm leading-5 text-slate-700">
                  {analysis.decisions.length ? analysis.decisions.map((decision, index) => (
                    <p key={`${decision.text}-${index}`}>{decision.text}</p>
                  )) : <p>Nenhuma decisão identificada.</p>}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h5 className="text-xs font-black uppercase tracking-wide text-slate-500">Dados identificados</h5>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <DetailList title="Pessoas" items={analysis.entities.people} />
              <DetailList title="Empresas" items={analysis.entities.companies} />
              <DetailList title="Datas" items={analysis.entities.dates} />
              <DetailList title="Valores" items={analysis.entities.values} />
              <DetailList title="Links" items={analysis.entities.links} />
            </div>
          </div>

          {analysis.narrative.title || analysis.narrative.chapters.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <h4 className="flex items-center gap-2 text-sm font-black uppercase text-slate-800">
                <BookOpen className="h-4 w-4 text-leste-blue" />
                Estrutura narrativa identificada
              </h4>
              <p className="mt-2 text-sm font-bold text-slate-700">{analysis.narrative.title}</p>
              <p className="mt-1 text-sm text-slate-600">{analysis.narrative.premise}</p>
              {analysis.narrative.chapters.length ? (
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {analysis.narrative.chapters.map((chapter, index) => (
                    <li key={`${chapter.title}-${index}`}>- {chapter.title}: {chapter.synopsis}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-indigo-100 bg-white p-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-leste-blue" />
              <div>
                <h4 className="text-sm font-black uppercase text-slate-800">Criar a partir do entendimento</h4>
                <p className="mt-1 text-sm text-slate-600">
                  Use a análise e a transcrição como contexto. Os materiais permanecem fiéis ao áudio e prontos para copiar ou narrar.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {contentActions.map((action) => (
                <ActionButton
                  disabled={Boolean(loadingContentKind && loadingContentKind !== action.kind)}
                  fullWidth
                  key={action.kind}
                  loading={loadingContentKind === action.kind}
                  onClick={() => onGenerateContent(action.kind)}
                  type="button"
                  variant={action.kind === "audiobookOutline" ? "secondary" : "ghost"}
                >
                  <Sparkles className="h-4 w-4" />
                  {action.label}
                </ActionButton>
              ))}
            </div>
            {contentError ? <ErrorBox className="mt-3" message={contentError} /> : null}
          </div>

          {generatedContents
            ? (Object.entries(generatedContents) as Array<[AudioContentKind, string | undefined]>).map(
                ([kind, text]) =>
                  text ? (
                    <GeneratedContent
                      activeSpeechKey={activeSpeechKey}
                      copiedKey={copiedKey}
                      key={kind}
                      kind={kind}
                      itemId={itemId}
                      onCopy={onCopy}
                      onDownloadSpeech={onDownloadSpeech}
                      onSpeak={onSpeak}
                      onStopSpeech={onStopSpeech}
                      speechAudioUrls={speechAudioUrls}
                      speechErrors={speechErrors}
                      text={text}
                    />
                  ) : null,
              )
            : null}
        </div>
      )}
    </section>
  );
}
