"use client";

import { ArrowDown, Check, FileAudio2, Lightbulb, PackageCheck, PenLine, Scissors } from "lucide-react";

export type ProductionStageKey = "intake" | "process" | "understand" | "create" | "video" | "delivery";

export type ProductionStage = {
  key: ProductionStageKey;
  title: string;
  detail: string;
  targetId: string;
  state: "ready" | "active" | "complete";
};

const icons = {
  intake: FileAudio2,
  process: ArrowDown,
  understand: Lightbulb,
  create: PenLine,
  video: Scissors,
  delivery: PackageCheck,
} as const;

export default function ProductionFlowNav({ stages }: { stages: ProductionStage[] }) {
  return (
    <section aria-label="Etapas de produção" className="rounded-2xl border border-blue-100 bg-white p-3 shadow-editorial sm:p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-leste-blue">Fluxo de produção</p>
          <h2 className="mt-0.5 text-base font-black text-slate-950">Etapas do trabalho</h2>
        </div>
        <p className="text-xs text-slate-500">Clique em uma etapa para ir direto a ela.</p>
      </div>

      <ol className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-6">
        {stages.map((stage, index) => {
          const Icon = icons[stage.key];
          const isComplete = stage.state === "complete";
          return (
            <li className="min-w-[154px] flex-1 lg:min-w-0" key={stage.key}>
              <button
                aria-label={`Etapa ${index + 1}: ${stage.title}. ${stage.detail}`}
                className={`group flex min-h-[52px] w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leste-blue focus-visible:ring-offset-2 ${
                  isComplete
                    ? "border-emerald-200 bg-emerald-50/70 hover:border-emerald-400"
                    : stage.state === "active"
                      ? "border-leste-blue/50 bg-blue-50 hover:border-leste-blue"
                      : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-white"
                }`}
                onClick={() => document.getElementById(stage.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                type="button"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isComplete ? "bg-emerald-100 text-emerald-800" : stage.state === "active" ? "bg-leste-blue text-white" : "bg-white text-leste-blue shadow-sm"}`}>
                  {isComplete ? <Check aria-hidden="true" className="h-4 w-4" /> : <Icon aria-hidden="true" className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Etapa {String(index + 1).padStart(2, "0")}</span>
                  <span className="block truncate text-xs font-extrabold text-slate-900">{stage.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
