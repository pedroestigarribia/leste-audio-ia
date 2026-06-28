"use client";

import { FileAudio2 } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-blue-200 bg-white/80 px-6 py-10 text-center shadow-editorial">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-blue-50 text-leste-blue">
        <FileAudio2 className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">Nenhum áudio carregado</h2>
      <p className="mt-2 text-sm text-slate-600">
        Selecione ou arraste arquivos de áudio do WhatsApp para começar.
      </p>
    </div>
  );
}
