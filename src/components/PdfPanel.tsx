"use client";

import { Copy, FileText, Upload, Volume2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import { formatBytes } from "@/lib/format";

export type PdfResultKey =
  | "analysis"
  | "summary"
  | "interpretation"
  | "organized"
  | "grammar"
  | "clean";
export type PdfSpeechKey =
  | "pdf-original"
  | "pdf-analysis"
  | "pdf-summary"
  | "pdf-interpretation"
  | "pdf-organized"
  | "pdf-grammar"
  | "pdf-clean";

type PdfState = {
  fileName: string;
  fileSize: number;
  text: string;
  results: Record<PdfResultKey, string>;
};

type PdfPanelProps = {
  copiedKey: string | null;
  error?: string;
  loadingMap: Record<string, boolean>;
  onClearPdf: () => void;
  onCopy: (key: string, text: string) => void;
  onDownloadSpeech: (key: string, label: string) => void;
  onPdfSelected: (file: File) => void;
  onProcessPdf: (mode: PdfResultKey) => void;
  onSpeak: (key: PdfSpeechKey, title: string, text: string) => void;
  onStopSpeech: () => void;
  pdf: PdfState | null;
  speechAudioTypes: Record<string, string | undefined>;
  speechAudioUrls: Record<string, string | undefined>;
  speechErrors: Record<string, string | undefined>;
  speechLoadingMap: Record<string, boolean>;
  activeSpeechKey: string | null;
};

const pdfActions: Array<{
  key: PdfResultKey;
  label: string;
  loadingKey: string;
}> = [
  { key: "analysis", label: "Analisar e identificar", loadingKey: "pdf:analysis" },
  { key: "summary", label: "Resumir documento", loadingKey: "pdf:summary" },
  { key: "interpretation", label: "Interpretar documento", loadingKey: "pdf:interpretation" },
  { key: "organized", label: "Organizar documento", loadingKey: "pdf:organized" },
  { key: "grammar", label: "Ajustar gramática", loadingKey: "pdf:grammar" },
  { key: "clean", label: "Deixar pronto para copiar", loadingKey: "pdf:clean" },
];

const resultLabels: Record<PdfResultKey, string> = {
  analysis: "Análise e identificação do documento",
  summary: "Resumo e conclusão do documento",
  interpretation: "Interpretação e conclusão do documento",
  organized: "Documento organizado",
  grammar: "Texto com ajuste gramatical",
  clean: "Texto limpo e pronto para copiar",
};

const speechKeys: Record<PdfResultKey, PdfSpeechKey> = {
  analysis: "pdf-analysis",
  summary: "pdf-summary",
  interpretation: "pdf-interpretation",
  organized: "pdf-organized",
  grammar: "pdf-grammar",
  clean: "pdf-clean",
};

function SpeechPlayer({
  activeSpeechKey,
  label,
  onDownloadSpeech,
  onStopSpeech,
  speechAudioTypes,
  speechAudioUrls,
  speechKey,
}: {
  activeSpeechKey: string | null;
  label: string;
  onDownloadSpeech: (key: string, label: string) => void;
  onStopSpeech: () => void;
  speechAudioTypes: Record<string, string | undefined>;
  speechAudioUrls: Record<string, string | undefined>;
  speechKey: string;
}) {
  const url = speechAudioUrls[speechKey];

  if (!url || activeSpeechKey !== speechKey) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-700">Milena lendo: {label}</p>
        <div className="grid gap-2 sm:flex">
          <ActionButton className="sm:w-auto" fullWidth onClick={onStopSpeech} type="button" variant="ghost">
            Parar
          </ActionButton>
          <ActionButton
            className="sm:w-auto"
            fullWidth
            onClick={() => onDownloadSpeech(speechKey, label)}
            type="button"
            variant="secondary"
          >
            Baixar MP3
          </ActionButton>
        </div>
      </div>
      <audio autoPlay={activeSpeechKey === speechKey} className="w-full" controls src={url}>
        Seu navegador não suporta reprodução de áudio.
      </audio>
    </div>
  );
}

export default function PdfPanel({
  activeSpeechKey,
  copiedKey,
  error,
  loadingMap,
  onClearPdf,
  onCopy,
  onDownloadSpeech,
  onPdfSelected,
  onProcessPdf,
  onSpeak,
  onStopSpeech,
  pdf,
  speechAudioTypes,
  speechAudioUrls,
  speechErrors,
  speechLoadingMap,
}: PdfPanelProps) {
  const originalSpeechKey: PdfSpeechKey = "pdf-original";

  return (
    <section className="space-y-5 rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <h2 className="text-xl font-black text-slate-950">Contratos, PDF e DOCX: análise e audiolivro</h2>
            <p className="mt-2 text-sm text-slate-600">
            Envie contratos e documentos para identificar o tipo, analisar, resumir, interpretar,
            organizar e preparar uma narração natural com a Milena.
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            A análise é informativa e não substitui revisão jurídica, contábil ou profissional especializada.
          </p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-leste-blue px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:bg-blue-950">
          <Upload className="h-4 w-4" />
          Enviar PDF ou DOCX
          <input
            accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              if (file) {
                onPdfSelected(file);
              }

              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      {pdf ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-leste-blue">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{pdf.fileName}</h3>
                  <p className="text-sm text-slate-500">
                    {formatBytes(pdf.fileSize)} | {pdf.text.length.toLocaleString("pt-BR")} caracteres extraídos
                  </p>
                </div>
              </div>
              <ActionButton className="sm:w-auto" fullWidth onClick={onClearPdf} type="button" variant="danger">
                Limpar documento
              </ActionButton>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black uppercase text-leste-blue">
                  <Volume2 className="h-4 w-4 text-rose-500" />
                  Milena Voz
                </h3>
                <p className="mt-1 text-sm text-slate-700">
                  A identificação, o resumo e a interpretação são gerados após a extração. Você decide
                  se quer gerar MP3s, ouvir no painel ou baixar cada resultado.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold uppercase text-slate-500">
                <Volume2 className="h-4 w-4 text-leste-blue" />
                Milena
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <ActionButton
                fullWidth
                loading={speechLoadingMap[originalSpeechKey]}
                onClick={() => onSpeak(originalSpeechKey, "Texto original do documento", pdf.text)}
                type="button"
                variant="secondary"
              >
                <Volume2 className="h-4 w-4" />
                Ouvir texto original
              </ActionButton>
              {pdfActions.map((action) => {
                const text = pdf.results[action.key];
                const speechKey = speechKeys[action.key];

                return (
                  <ActionButton
                    disabled={!text.trim()}
                    fullWidth
                    key={speechKey}
                    loading={speechLoadingMap[speechKey]}
                    onClick={() => onSpeak(speechKey, resultLabels[action.key], text)}
                    type="button"
                    variant={text.trim() ? "secondary" : "ghost"}
                  >
                    <Volume2 className="h-4 w-4" />
                    Ouvir {resultLabels[action.key].toLowerCase()}
                  </ActionButton>
                );
              })}
            </div>

            <SpeechPlayer
              activeSpeechKey={activeSpeechKey}
              label="Texto original do documento"
              onDownloadSpeech={onDownloadSpeech}
              onStopSpeech={onStopSpeech}
              speechAudioTypes={speechAudioTypes}
              speechAudioUrls={speechAudioUrls}
              speechKey={originalSpeechKey}
            />

            {speechErrors[originalSpeechKey] ? <ErrorBox message={speechErrors[originalSpeechKey] ?? ""} /> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {pdfActions.map((action) => (
              <ActionButton
                fullWidth
                key={action.key}
                loading={loadingMap[action.loadingKey]}
                onClick={() => onProcessPdf(action.key)}
                type="button"
                variant={action.key === "summary" ? "secondary" : "ghost"}
              >
                {action.label}
              </ActionButton>
            ))}
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold uppercase text-slate-500">Texto extraído do documento</h3>
              <ActionButton
                className="sm:w-auto"
                fullWidth
                onClick={() => onCopy("pdf-original", pdf.text)}
                type="button"
                variant="ghost"
              >
                <Copy className="h-4 w-4" />
                {copiedKey === "pdf-original" ? "Copiado" : "Copiar texto"}
              </ActionButton>
            </div>
            <textarea
              className="min-h-[260px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
              readOnly
              value={pdf.text}
            />
          </div>

          {pdfActions.map((action) => {
            const result = pdf.results[action.key];
            const speechKey = speechKeys[action.key];

            if (!result.trim()) {
              return null;
            }

            return (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4" key={action.key}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold uppercase text-slate-500">
                    {resultLabels[action.key]}
                  </h3>
                  <div className="grid gap-2 sm:flex">
                    <ActionButton
                      className="sm:w-auto"
                      fullWidth
                      loading={speechLoadingMap[speechKey]}
                      onClick={() => onSpeak(speechKey, resultLabels[action.key], result)}
                      type="button"
                      variant="secondary"
                    >
                      <Volume2 className="h-4 w-4" />
                      Ouvir com Milena
                    </ActionButton>
                    <ActionButton
                      className="sm:w-auto"
                      fullWidth
                      onClick={() => onCopy(`pdf-${action.key}`, result)}
                      type="button"
                      variant="ghost"
                    >
                      <Copy className="h-4 w-4" />
                      {copiedKey === `pdf-${action.key}` ? "Copiado" : "Copiar"}
                    </ActionButton>
                  </div>
                </div>
                <textarea
                  className="min-h-[220px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
                  readOnly
                  value={result}
                />
                {speechErrors[speechKey] ? <ErrorBox message={speechErrors[speechKey] ?? ""} /> : null}
                <SpeechPlayer
                  activeSpeechKey={activeSpeechKey}
                  label={resultLabels[action.key]}
                  onDownloadSpeech={onDownloadSpeech}
                  onStopSpeech={onStopSpeech}
                  speechAudioTypes={speechAudioTypes}
                  speechAudioUrls={speechAudioUrls}
                  speechKey={speechKey}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 px-5 py-6 text-sm text-slate-600">
          Nenhum documento enviado ainda. Envie um PDF ou DOCX para extrair o texto, preparar a narração e usar as ferramentas de IA.
        </div>
      )}
    </section>
  );
}
