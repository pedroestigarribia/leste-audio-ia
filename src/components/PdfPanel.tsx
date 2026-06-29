"use client";

import { Copy, FileText, Upload, Volume2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import { formatBytes } from "@/lib/format";

export type PdfResultKey = "summary" | "organized" | "grammar" | "clean";
export type PdfSpeechKey =
  | "pdf-original"
  | "pdf-summary"
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
  { key: "summary", label: "Resumir PDF", loadingKey: "pdf:summary" },
  { key: "organized", label: "Organizar PDF", loadingKey: "pdf:organized" },
  { key: "grammar", label: "Ajustar gramática", loadingKey: "pdf:grammar" },
  { key: "clean", label: "Deixar pronto para copiar", loadingKey: "pdf:clean" },
];

const resultLabels: Record<PdfResultKey, string> = {
  summary: "Resumo do PDF",
  organized: "PDF organizado",
  grammar: "Texto com ajuste gramatical",
  clean: "Texto limpo e pronto para copiar",
};

const speechKeys: Record<PdfResultKey, PdfSpeechKey> = {
  summary: "pdf-summary",
  organized: "pdf-organized",
  grammar: "pdf-grammar",
  clean: "pdf-clean",
};

function getSpeechExtension(contentType?: string) {
  return contentType?.includes("mpeg") || contentType?.includes("mp3") ? "mp3" : "wav";
}

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

  const extension = getSpeechExtension(speechAudioTypes[speechKey]);

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
            Baixar {extension.toUpperCase()}
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
          <h2 className="text-xl font-black text-slate-950">PDF para texto e IA</h2>
          <p className="mt-2 text-sm text-slate-600">
            Envie um PDF para extrair o texto, resumir, organizar, ajustar gramaticalmente,
            copiar e ouvir com a Milena.
          </p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-leste-blue px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:bg-blue-950">
          <Upload className="h-4 w-4" />
          Enviar PDF
          <input
            accept="application/pdf,.pdf"
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
                Limpar PDF
              </ActionButton>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase text-leste-blue">
                  Leitura com voz da Milena
                </h3>
                <p className="mt-1 text-sm text-slate-700">
                  A Milena lê o texto do PDF e os conteúdos tratados pela IA. Use o player para
                  pausar e o botão Parar para encerrar.
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
                onClick={() => onSpeak(originalSpeechKey, "Texto original do PDF", pdf.text)}
                type="button"
                variant="secondary"
              >
                <Volume2 className="h-4 w-4" />
                Ouvir texto do PDF
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
              label="Texto original do PDF"
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
              <h3 className="text-sm font-semibold uppercase text-slate-500">Texto extraído do PDF</h3>
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
                      Milena lê este texto
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
          Nenhum PDF enviado ainda. Envie um arquivo para extrair o texto e usar as ferramentas de IA.
        </div>
      )}
    </section>
  );
}
