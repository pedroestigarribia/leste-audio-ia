"use client";

import { useRef, useState } from "react";
import { CloudUpload, Plus } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import AudioRecorder from "@/components/AudioRecorder";

type UploadAreaProps = {
  acceptedExtensions: string[];
  disabled?: boolean;
  maxFileSizeMb: number;
  onFilesSelected: (files: File[]) => void;
  onRecordingReady: (file: File) => Promise<void>;
};

export default function UploadArea({
  acceptedExtensions,
  disabled = false,
  maxFileSizeMb,
  onFilesSelected,
  onRecordingReady,
}: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const acceptValue = acceptedExtensions.map((extension) => `.${extension}`).join(",");

  function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    onFilesSelected(Array.from(fileList));
  }

  return (
    <section
      className={[
        "rounded-lg border-2 border-dashed bg-white/90 p-5 shadow-editorial transition sm:p-6",
        isDragging ? "border-leste-blue bg-blue-50" : "border-blue-200",
      ].join(" ")}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setIsDragging(false);
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (disabled) {
          return;
        }

        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        accept={acceptValue}
        className="hidden"
        disabled={disabled}
        multiple
        onChange={(event) => {
          handleFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        type="file"
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-leste-blue text-white">
            <CloudUpload className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-950">Adicione áudios ou vídeos</h2>
            <p className="text-sm text-slate-600">
              Aceita {acceptedExtensions.map((extension) => `.${extension}`).join(", ")}.
            </p>
            <p className="text-sm text-slate-500">
              Limite por arquivo: {maxFileSizeMb} MB. O navegador só envia quando você clicar em
              &quot;Transcrever mídias&quot;.
            </p>
            <p className="text-sm text-slate-500">
              Adicione quantos arquivos precisar, inclusive em vários envios. Os arquivos e
              resultados concluídos permanecem nesta sessão.
            </p>
          </div>
        </div>

        <div className="sm:w-auto">
          <ActionButton
            fullWidth
            onClick={() => inputRef.current?.click()}
            type="button"
            variant="secondary"
          >
            <Plus className="h-4 w-4" />
            Selecionar arquivos
          </ActionButton>
        </div>
      </div>

      <AudioRecorder
        disabled={disabled}
        maxFileSizeMb={maxFileSizeMb}
        onRecordingReady={onRecordingReady}
      />
    </section>
  );
}
