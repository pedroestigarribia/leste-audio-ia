"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Copy, Headphones, Layers3, Merge, RefreshCw, Split, Volume2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import NarrationReviewPanel from "@/components/NarrationReviewPanel";
import { copyToClipboard } from "@/lib/clipboard";
import type { AudioItem, ContinuityPlan } from "@/types/audio";

type ContinuityPanelProps = {
  items: AudioItem[];
  plan: ContinuityPlan | null;
  isLoading: boolean;
  error?: string;
  onAnalyze: () => void;
  onChange: (plan: ContinuityPlan) => void;
  onSpeak: (key: `review:${string}`, title: string, text: string) => void;
  isSpeechLoading?: boolean;
};

export default function ContinuityPanel({ items, plan, isLoading, error, onAnalyze, onChange, onSpeak, isSpeechLoading }: ContinuityPanelProps) {
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const unifiedText = useMemo(() => plan?.groups.flatMap((group) => group.itemIds.map((id) => itemById.get(id))).filter((item): item is AudioItem => Boolean(item?.transcription)).map((item) => `ÁUDIO: ${item.name}\n${item.transcription}`).join("\n\n========================\n\n") ?? "", [itemById, plan]);

  function updateGroup(groupId: string, update: (group: NonNullable<ContinuityPlan>["groups"][number]) => NonNullable<ContinuityPlan>["groups"][number]) {
    if (!plan) return;
    onChange({ ...plan, groups: plan.groups.map((group) => group.id === groupId ? update(group) : group), generatedAt: new Date().toISOString() });
  }

  function moveItem(groupId: string, itemId: string, direction: -1 | 1) {
    updateGroup(groupId, (group) => {
      const index = group.itemIds.indexOf(itemId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= group.itemIds.length) return group;
      const itemIds = [...group.itemIds];
      [itemIds[index], itemIds[target]] = [itemIds[target], itemIds[index]];
      return { ...group, itemIds };
    });
  }

  function splitItem(groupId: string, itemId: string) {
    if (!plan) return;
    const item = itemById.get(itemId);
    const current = plan.groups.find((group) => group.id === groupId);
    if (!current || current.itemIds.length < 2) return;
    onChange({ ...plan, groups: [...plan.groups.map((group) => group.id === groupId ? { ...group, itemIds: group.itemIds.filter((id) => id !== itemId) } : group), { id: `manual-${Date.now()}`, title: item?.name ?? "Novo grupo", itemIds: [itemId], explanation: "Separado manualmente." }].filter((group) => group.itemIds.length), generatedAt: new Date().toISOString() });
  }

  function mergeWithPrevious(groupId: string) {
    if (!plan) return;
    const index = plan.groups.findIndex((group) => group.id === groupId);
    if (index < 1) return;
    const previous = plan.groups[index - 1];
    const current = plan.groups[index];
    onChange({ ...plan, groups: plan.groups.flatMap((group, groupIndex) => groupIndex === index ? [] : groupIndex === index - 1 ? [{ ...group, itemIds: [...previous.itemIds, ...current.itemIds] }] : [group]), generatedAt: new Date().toISOString() });
  }

  return (
    <section className="space-y-5 rounded-xl border border-blue-100 bg-white p-4 shadow-editorial sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Layers3 className="h-5 w-5 text-leste-blue" /> Continuidade e narrativa</h2><p className="mt-1 text-sm leading-6 text-slate-600">Agrupa áudios misturados, propõe a ordem da narrativa e permite ajuste manual nesta sessão.</p></div>
        <ActionButton className="lg:w-auto" fullWidth loading={isLoading} onClick={onAnalyze} type="button" variant="secondary"><RefreshCw className="h-4 w-4" /> {plan ? "Atualizar proposta" : "Organizar sequência"}</ActionButton>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {!plan ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Transcreva dois ou mais áudios e clique em “Organizar sequência”. Nenhuma ordem é alterada automaticamente.</p> : null}
      {plan?.warnings.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{plan.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
      {plan?.groups.map((group, index) => <div className="space-y-3 rounded-xl border border-slate-200 p-4" key={group.id}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><input aria-label="Nome do grupo" className="min-h-10 rounded-md border border-slate-200 px-3 font-bold text-slate-900" onChange={(event) => updateGroup(group.id, (current) => ({ ...current, title: event.target.value }))} value={group.title} /><div className="flex gap-2"><ActionButton disabled={index === 0} fullWidth={false} onClick={() => mergeWithPrevious(group.id)} type="button" variant="ghost"><Merge className="h-4 w-4" /> Unir</ActionButton></div></div>
        {group.explanation ? <p className="text-xs leading-5 text-slate-600">{group.explanation}{typeof group.confidence === "number" ? ` Confiança: ${group.confidence}%.` : ""}</p> : null}
        <ol className="space-y-2">{group.itemIds.map((itemId, itemIndex) => { const item = itemById.get(itemId); if (!item) return null; return <li className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between" key={itemId}><span className="text-sm font-semibold text-slate-800">{itemIndex + 1}. {item.name}</span><span className="flex flex-wrap gap-1"><ActionButton disabled={itemIndex === 0} fullWidth={false} onClick={() => moveItem(group.id, itemId, -1)} type="button" variant="ghost"><ArrowUp className="h-3.5 w-3.5" /></ActionButton><ActionButton disabled={itemIndex === group.itemIds.length - 1} fullWidth={false} onClick={() => moveItem(group.id, itemId, 1)} type="button" variant="ghost"><ArrowDown className="h-3.5 w-3.5" /></ActionButton><ActionButton disabled={group.itemIds.length < 2} fullWidth={false} onClick={() => splitItem(group.id, itemId)} type="button" variant="ghost"><Split className="h-3.5 w-3.5" /> Separar</ActionButton></span></li>; })}</ol>
      </div>)}
      {unifiedText ? <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="font-bold text-slate-950">Narração unificada na ordem atual</h3><div className="flex gap-2"><ActionButton fullWidth={false} onClick={() => void copyToClipboard(unifiedText)} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar</ActionButton><ActionButton fullWidth={false} onClick={() => onSpeak("review:continuidade", "Narração unificada", unifiedText)} type="button" variant="secondary"><Volume2 className="h-4 w-4" /> Ouvir</ActionButton></div></div><textarea className="min-h-48 w-full rounded-lg border border-blue-100 bg-white p-3 text-sm leading-6" readOnly value={unifiedText} /><NarrationReviewPanel isSpeechLoading={isSpeechLoading} onSpeak={onSpeak} sourceKey="continuidade" text={unifiedText} title="Narração unificada" /></div> : null}
    </section>
  );
}
