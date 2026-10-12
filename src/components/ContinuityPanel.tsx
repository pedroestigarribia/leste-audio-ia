"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Copy, Headphones, Layers3, Merge, RefreshCw, Split, Volume2 } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import NarrationReviewPanel from "@/components/NarrationReviewPanel";
import { copyToClipboard } from "@/lib/clipboard";
import type { AudioItem, ContinuityPlan, SessionNarrativeFormat } from "@/types/audio";

type ContinuityPanelProps = {
  items: AudioItem[];
  plan: ContinuityPlan | null;
  isLoading: boolean;
  error?: string;
  onAnalyze: () => void;
  onChange: (plan: ContinuityPlan) => void;
  onSpeak: (key: `review:${string}`, title: string, text: string) => void;
  isSpeechLoading?: boolean;
  narrative: string;
  narrativeFormat: SessionNarrativeFormat;
  narrativeLoading: boolean;
  narrativeError?: string;
  onNarrativeChange: (text: string) => void;
  onNarrativeFormatChange: (format: SessionNarrativeFormat) => void;
  onGenerateNarrative: () => void;
  onToggleAnalysis: (itemId: string, include: boolean) => void;
  onToggleDuplicate: (itemId: string, duplicate: boolean) => void;
  narrativeStale: boolean;
  narrativeSpeechUrl?: string;
  narrativeSpeechLoading: boolean;
  narrativeSpeechError?: string;
  isNarrativeSpeechActive: boolean;
  onDownloadNarrative: () => void;
  onStopSpeech: () => void;
  transcriptOrder: "original" | "context";
  onTranscriptOrderChange: (order: "original" | "context") => void;
};

const narrativeFormats: Array<{ value: SessionNarrativeFormat; label: string }> = [
  { value: "faithful", label: "Relato fiel" },
  { value: "chronological", label: "Texto cronológico" },
  { value: "biography", label: "Biografia" },
  { value: "storytelling", label: "Storytelling natural" },
  { value: "script", label: "Roteiro" },
  { value: "professionalProfile", label: "Perfil profissional" },
  { value: "report", label: "Reportagem ou relatório" },
  { value: "whatsapp", label: "Conteúdo para WhatsApp" },
];

export default function ContinuityPanel({
  items, plan, isLoading, error, onAnalyze, onChange, onSpeak, isSpeechLoading,
  narrative, narrativeFormat, narrativeLoading, narrativeError, onNarrativeChange,
  onNarrativeFormatChange, onGenerateNarrative, onToggleAnalysis, onToggleDuplicate,
  narrativeStale, narrativeSpeechUrl, narrativeSpeechLoading, narrativeSpeechError, isNarrativeSpeechActive, onDownloadNarrative, onStopSpeech,
  transcriptOrder, onTranscriptOrderChange,
}: ContinuityPanelProps) {
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const contextualItems = useMemo(() => {
    const groupedIds = new Set(plan?.groups.flatMap((group) => group.itemIds) ?? []);
    const grouped = plan?.groups.flatMap((group) => group.itemIds.map((id) => itemById.get(id))) ?? [];
    return [...grouped.filter((item): item is AudioItem => Boolean(item)), ...items.filter((item) => !groupedIds.has(item.id))];
  }, [itemById, items, plan]);
  const transcriptItems = transcriptOrder === "original" ? items : contextualItems;
  const unifiedText = useMemo(() => transcriptItems
    .filter((item) => item.transcription)
    .map((item) => `ÁUDIO: ${item.name}\n${item.transcription}`)
    .join("\n\n========================\n\n"), [transcriptItems]);

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

  function moveGroup(groupId: string, direction: -1 | 1) {
    if (!plan) return;
    const index = plan.groups.findIndex((group) => group.id === groupId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= plan.groups.length) return;
    const groups = [...plan.groups];
    [groups[index], groups[target]] = [groups[target], groups[index]];
    onChange({ ...plan, groups, generatedAt: new Date().toISOString() });
  }

  return (
    <section className="space-y-5 rounded-xl border border-blue-100 bg-white p-4 shadow-editorial sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Layers3 className="h-5 w-5 text-leste-blue" /> Continuidade e narrativa</h2><p className="mt-1 text-sm leading-6 text-slate-600">Agrupa áudios misturados, propõe a ordem da narrativa e permite ajuste manual nesta sessão.</p></div>
        <div className="grid gap-2 sm:flex">
          <ActionButton className="lg:w-auto" fullWidth loading={isLoading} onClick={onAnalyze} type="button" variant="secondary"><RefreshCw className="h-4 w-4" /> {plan ? "Atualizar proposta" : "Organizar sequência"}</ActionButton>
          <ActionButton className="lg:w-auto" fullWidth disabled={!items.length} onClick={() => onTranscriptOrderChange(transcriptOrder === "original" ? "context" : "original")} type="button" variant="ghost">{transcriptOrder === "original" ? "Ver ordem contextual" : "Restaurar ordem original"}</ActionButton>
        </div>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {!plan ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Transcreva dois ou mais áudios e clique em “Organizar sequência”. Nenhuma ordem é alterada automaticamente.</p> : null}
      {plan?.warnings.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{plan.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
      {plan?.groups.map((group, index) => <div className="space-y-3 rounded-xl border border-slate-200 p-4" key={group.id}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><input aria-label="Nome do grupo" className="min-h-10 rounded-md border border-slate-200 px-3 font-bold text-slate-900" onChange={(event) => updateGroup(group.id, (current) => ({ ...current, title: event.target.value }))} value={group.title} /><div className="flex flex-wrap gap-2"><ActionButton disabled={index === 0} fullWidth={false} onClick={() => moveGroup(group.id, -1)} type="button" variant="ghost"><ArrowUp className="h-3.5 w-3.5" /> Grupo acima</ActionButton><ActionButton disabled={index === plan.groups.length - 1} fullWidth={false} onClick={() => moveGroup(group.id, 1)} type="button" variant="ghost"><ArrowDown className="h-3.5 w-3.5" /> Grupo abaixo</ActionButton><ActionButton disabled={index === 0} fullWidth={false} onClick={() => mergeWithPrevious(group.id)} type="button" variant="ghost"><Merge className="h-4 w-4" /> Unir</ActionButton></div></div>
        {group.explanation ? <p className="text-xs leading-5 text-slate-600">{group.explanation}{typeof group.confidence === "number" ? ` Confiança: ${group.confidence}%.` : ""}</p> : null}
        <ol className="space-y-2">{group.itemIds.map((itemId, itemIndex) => { const item = itemById.get(itemId); if (!item) return null; return <li className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3" key={itemId}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-semibold text-slate-800">{itemIndex + 1}. {item.name}</span><span className="flex flex-wrap gap-1"><ActionButton disabled={itemIndex === 0} fullWidth={false} onClick={() => moveItem(group.id, itemId, -1)} type="button" variant="ghost"><ArrowUp className="h-3.5 w-3.5" /></ActionButton><ActionButton disabled={itemIndex === group.itemIds.length - 1} fullWidth={false} onClick={() => moveItem(group.id, itemId, 1)} type="button" variant="ghost"><ArrowDown className="h-3.5 w-3.5" /></ActionButton><ActionButton disabled={group.itemIds.length < 2} fullWidth={false} onClick={() => splitItem(group.id, itemId)} type="button" variant="ghost"><Split className="h-3.5 w-3.5" /> Separar</ActionButton></span></div><div className="flex flex-wrap items-center gap-4 text-xs text-slate-600"><label className="flex items-center gap-2"><input checked={item.includeInAnalysis !== false} onChange={(event) => onToggleAnalysis(itemId, event.currentTarget.checked)} type="checkbox" /> Incluir na análise</label><label className="flex items-center gap-2"><input checked={Boolean(item.isDuplicate)} onChange={(event) => onToggleDuplicate(itemId, event.currentTarget.checked)} type="checkbox" /> Marcar duplicado</label></div></li>; })}</ol>
      </div>)}
      {contextualItems.some((item) => !plan?.groups.some((group) => group.itemIds.includes(item.id))) ? <div className="rounded-xl border border-dashed border-slate-300 p-4"><h3 className="font-bold text-slate-900">Áudios ainda sem grupo</h3><ul className="mt-3 space-y-2">{contextualItems.filter((item) => !plan?.groups.some((group) => group.itemIds.includes(item.id))).map((item) => <li className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between" key={item.id}><span className="text-sm font-semibold">{item.name}</span><div className="flex flex-wrap gap-3 text-xs text-slate-600"><label className="flex items-center gap-2"><input checked={item.includeInAnalysis !== false} onChange={(event) => onToggleAnalysis(item.id, event.currentTarget.checked)} type="checkbox" /> Incluir na análise</label><label className="flex items-center gap-2"><input checked={Boolean(item.isDuplicate)} onChange={(event) => onToggleDuplicate(item.id, event.currentTarget.checked)} type="checkbox" /> Marcar duplicado</label></div></li>)}</ul></div> : null}
      {unifiedText ? <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-950">Texto integral unificado</h3><p className="text-xs text-slate-600">Texto original completo, com a fonte de cada áudio. Não é resumido nem editado.</p></div><div className="flex gap-2"><ActionButton fullWidth={false} onClick={() => void copyToClipboard(unifiedText)} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar</ActionButton><ActionButton fullWidth={false} onClick={() => onSpeak("review:continuidade", "Texto integral unificado", unifiedText)} type="button" variant="secondary"><Volume2 className="h-4 w-4" /> Ouvir</ActionButton></div></div><textarea aria-label="Texto integral unificado" className="min-h-48 w-full rounded-lg border border-blue-100 bg-white p-3 text-sm leading-6" readOnly value={unifiedText} /></div> : null}
      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4"><div><h3 className="font-bold text-slate-950">Narrativa final revisável</h3><p className="text-sm text-slate-600">Gere a partir dos áudios incluídos na análise. A voz da Milena só será criada quando você clicar em Ouvir.</p>{narrative && narrativeStale ? <p className="mt-2 text-sm font-semibold text-amber-900">Esta narrativa foi gerada antes da última alteração na sessão. Atualize-a antes de exportar ou narrar.</p> : null}</div><div className="flex flex-col gap-2 sm:flex-row"><select aria-label="Formato da narrativa" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3" onChange={(event) => onNarrativeFormatChange(event.currentTarget.value as SessionNarrativeFormat)} value={narrativeFormat}>{narrativeFormats.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</select><ActionButton className="sm:w-auto" fullWidth loading={narrativeLoading} onClick={onGenerateNarrative} type="button" variant="primary">Gerar narrativa final</ActionButton></div>{narrativeError ? <ErrorBox message={narrativeError} /> : null}{narrativeSpeechError ? <ErrorBox message={narrativeSpeechError} /> : null}{narrative ? <><div className="flex flex-wrap gap-2"><ActionButton fullWidth={false} loading={narrativeSpeechLoading} onClick={() => onSpeak("review:narrativa-final", "Narrativa final", narrative)} type="button" variant="secondary"><Volume2 className="h-4 w-4" /> {narrativeSpeechUrl ? "Ouvir com Milena" : "Gerar voz da Milena"}</ActionButton><ActionButton fullWidth={false} onClick={() => void copyToClipboard(narrative)} type="button" variant="ghost"><Copy className="h-4 w-4" /> Copiar narrativa</ActionButton></div><textarea aria-label="Narrativa final editável" className="min-h-64 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm leading-6" onChange={(event) => onNarrativeChange(event.currentTarget.value)} value={narrative} />{narrativeSpeechUrl && isNarrativeSpeechActive ? <div className="space-y-2 rounded-lg border border-blue-100 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-700">Leitura com voz da Milena</p><div className="flex gap-2"><ActionButton fullWidth={false} onClick={onStopSpeech} type="button" variant="ghost">Parar</ActionButton><ActionButton fullWidth={false} onClick={onDownloadNarrative} type="button" variant="secondary">Baixar MP3</ActionButton></div></div><audio autoPlay className="w-full" controls src={narrativeSpeechUrl}>Seu navegador não suporta reprodução de áudio.</audio></div> : null}</> : null}</div>
      {unifiedText ? <NarrationReviewPanel isSpeechLoading={isSpeechLoading} onSpeak={onSpeak} sourceKey="continuidade" text={unifiedText} title="Narração unificada" /> : null}
    </section>
  );
}
