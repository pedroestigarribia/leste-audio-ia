"use client";

import { Copy, FileImage, Headphones, ImageUp, Trash2, Volume2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import { formatBytes } from "@/lib/format";

export type TextVoiceSpeechKey = "text-voice";
export type ImageSpeechKey = "image-text";

export type ImageTextState = {
  fileName: string;
  fileSize: number;
  text: string;
  previewUrl: string;
};

type TextImageVoicePanelProps = {
  activeSpeechKey: string | null;
  copiedKey: string | null;
  imageError?: string;
  imageState: ImageTextState | null;
  isImageExtractLoading: boolean;
  isTextVoiceLoading: boolean;
  isImageVoiceLoading: boolean;
  maxFileSizeMb: number;
  onClearImage: () => void;
  onClearText: () => void;
  onCopy: (key: string, text: string) => void;
  onDownloadSpeech: (key: string, label: string) => void;
  onImageSelected: (file: File) => void;
  onSpeak: (key: TextVoiceSpeechKey | ImageSpeechKey, title: string, text: string) => void;
  onStopSpeech: () => void;
  onTextChange: (value: string) => void;
  speechAudioTypes: Record<string, string | undefined>;
  speechAudioUrls: Record<string, string | undefined>;
  speechErrors: Record<string, string | undefined>;
  textValue: string;
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

export default function TextImageVoicePanel({
  activeSpeechKey,
  copiedKey,
  imageError,
  imageState,
  isImageExtractLoading,
  isTextVoiceLoading,
  isImageVoiceLoading,
  maxFileSizeMb,
  onClearImage,
  onClearText,
  onCopy,
  onDownloadSpeech,
  onImageSelected,
  onSpeak,
  onStopSpeech,
  onTextChange,
  speechAudioTypes,
  speechAudioUrls,
  speechErrors,
  textValue,
}: TextImageVoicePanelProps) {
  const textSpeechKey: TextVoiceSpeechKey = "text-voice";
  const imageSpeechKey: ImageSpeechKey = "image-text";
  const hasText = Boolean(textValue.trim());

  return (
    <section className="space-y-5 rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-leste-blue">
          Voz, texto e imagem
        </p>
        <h2 className="text-xl font-black text-slate-950">
          Texto livre e imagem para voz da Milena
        </h2>
        <p className="text-sm text-slate-600">
          Cole um texto para ouvir e baixar a voz. Envie uma imagem para gerar o texto dela,
          copiar, ouvir com a Milena e baixar o áudio.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-leste-blue">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-950">Texto para voz</h3>
              <p className="mt-1 text-sm text-slate-600">
                Digite ou cole o conteúdo que a Milena deve ler.
              </p>
            </div>
          </div>

          <textarea
            className="min-h-[230px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
            onChange={(event) => onTextChange(event.currentTarget.value)}
            placeholder="Cole aqui o texto que será convertido em voz..."
            value={textValue}
          />

          <div className="grid gap-2 sm:grid-cols-3">
            <ActionButton
              disabled={!hasText}
              fullWidth
              loading={isTextVoiceLoading}
              onClick={() => onSpeak(textSpeechKey, "Texto livre", textValue)}
              type="button"
              variant="secondary"
            >
              <Volume2 className="h-4 w-4" />
              Gerar voz
            </ActionButton>
            <ActionButton
              disabled={!hasText}
              fullWidth
              onClick={() => onCopy("text-voice-source", textValue)}
              type="button"
              variant="ghost"
            >
              <Copy className="h-4 w-4" />
              {copiedKey === "text-voice-source" ? "Copiado" : "Copiar texto"}
            </ActionButton>
            <ActionButton fullWidth onClick={onClearText} type="button" variant="danger">
              <Trash2 className="h-4 w-4" />
              Limpar texto
            </ActionButton>
          </div>

          {speechErrors[textSpeechKey] ? <ErrorBox message={speechErrors[textSpeechKey] ?? ""} /> : null}

          <SpeechPlayer
            activeSpeechKey={activeSpeechKey}
            label="Texto livre"
            onDownloadSpeech={onDownloadSpeech}
            onStopSpeech={onStopSpeech}
            speechAudioTypes={speechAudioTypes}
            speechAudioUrls={speechAudioUrls}
            speechKey={textSpeechKey}
          />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-leste-blue">
                <FileImage className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-950">Imagem para texto</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Aceita PNG, JPG, JPEG e WEBP até {maxFileSizeMb} MB.
                </p>
              </div>
            </div>

            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-leste-blue px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:bg-blue-950">
              <ImageUp className="h-4 w-4" />
              Enviar imagem
              <input
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];

                  if (file) {
                    onImageSelected(file);
                  }

                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>
          </div>

          {imageError ? <ErrorBox message={imageError} /> : null}

          {isImageExtractLoading ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm font-semibold text-leste-blue">
              Gerando texto da imagem...
            </div>
          ) : null}

          {imageState ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
                {/* Preview local via blob URL; next/image nao otimiza esse tipo de fonte. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`Imagem enviada: ${imageState.fileName}`}
                  className="h-44 w-full rounded-lg border border-slate-200 object-cover"
                  src={imageState.previewUrl}
                />
                <div className="rounded-lg border border-white bg-white p-4">
                  <h4 className="font-bold text-slate-900">{imageState.fileName}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatBytes(imageState.fileSize)} |{" "}
                    {imageState.text.length.toLocaleString("pt-BR")} caracteres gerados
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <ActionButton
                      fullWidth
                      loading={isImageVoiceLoading}
                      onClick={() => onSpeak(imageSpeechKey, "Texto da imagem", imageState.text)}
                      type="button"
                      variant="secondary"
                    >
                      <Volume2 className="h-4 w-4" />
                      Gerar voz
                    </ActionButton>
                    <ActionButton fullWidth onClick={onClearImage} type="button" variant="danger">
                      <Trash2 className="h-4 w-4" />
                      Limpar imagem
                    </ActionButton>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-sm font-semibold uppercase text-slate-500">
                    Texto gerado da imagem
                  </h4>
                  <ActionButton
                    className="sm:w-auto"
                    fullWidth
                    onClick={() => onCopy("image-text", imageState.text)}
                    type="button"
                    variant="ghost"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedKey === "image-text" ? "Copiado" : "Copiar texto"}
                  </ActionButton>
                </div>
                <textarea
                  className="min-h-[220px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue"
                  readOnly
                  value={imageState.text}
                />
              </div>

              {speechErrors[imageSpeechKey] ? <ErrorBox message={speechErrors[imageSpeechKey] ?? ""} /> : null}

              <SpeechPlayer
                activeSpeechKey={activeSpeechKey}
                label="Texto da imagem"
                onDownloadSpeech={onDownloadSpeech}
                onStopSpeech={onStopSpeech}
                speechAudioTypes={speechAudioTypes}
                speechAudioUrls={speechAudioUrls}
                speechKey={imageSpeechKey}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 px-5 py-6 text-sm text-slate-600">
              Nenhuma imagem enviada ainda. Envie uma imagem para gerar texto com IA.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
