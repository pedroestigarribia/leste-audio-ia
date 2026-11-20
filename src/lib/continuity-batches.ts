import { groupSessionItems, prepareSessionBatches } from "@/lib/session-batches";
import type { ContinuityPlan } from "@/types/audio";

export type ContinuityItem = { id: string; name: string; transcription: string };
export type ContinuityDescription = { itemId: string; description: string };
export type ContinuityBatchProgress = {
  stage: "analysis" | "comparison";
  completed: number;
  total: number;
};
export type ContinuityBatchPlanner = (request: {
  items: ContinuityItem[];
  includeDescriptions: boolean;
}) => Promise<{ result: ContinuityPlan; descriptions?: ContinuityDescription[] }>;

type Part = ContinuityItem & { source: number };

function prepareParts(items: ContinuityItem[]): ContinuityItem[] {
  const parts = prepareSessionBatches(items).flat().map((part) => {
    if (!part.id) throw new Error("Trecho sem ID interno.");
    return { ...part, id: part.id };
  });
  for (let index = 1; index < parts.length; index += 1) {
    const previous = parts[index - 1];
    const current = parts[index];
    const sameSource = previous.id.replace(/-parte-\d+$/, "") === current.id.replace(/-parte-\d+$/, "");
    const last = previous.transcription.charCodeAt(previous.transcription.length - 1);
    const first = current.transcription.charCodeAt(0);
    if (sameSource && last >= 0xd800 && last <= 0xdbff && first >= 0xdc00 && first <= 0xdfff) {
      current.transcription = previous.transcription.slice(-1) + current.transcription;
      previous.transcription = previous.transcription.slice(0, -1);
    }
  }
  return parts;
}

export async function organizeContinuityBatches(
  items: ContinuityItem[],
  planBatch: ContinuityBatchPlanner,
  onProgress?: (progress: ContinuityBatchProgress) => void,
): Promise<ContinuityPlan> {
  const originalIds = new Set<string>();
  for (const item of items) {
    if (typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim()
      || typeof item.transcription !== "string" || !item.transcription.trim()) {
      throw new Error("Cada arquivo precisa de ID, nome e transcrição não vazios.");
    }
    if (originalIds.has(item.id)) throw new Error(`ID de arquivo duplicado: ${item.id}`);
    originalIds.add(item.id);
  }
  if (!items.length) return { groups: [], warnings: [], generatedAt: new Date().toISOString() };

  const inputParts = prepareParts(items.map((item, index) => ({ ...item, id: `fonte-${index}` })));
  const sourceByPart = new Map(inputParts.map((part) => {
    const match = /^fonte-(\d+)(?:-parte-\d+)?$/.exec(part.id);
    if (!match) throw new Error("ID interno de trecho inválido.");
    return [part.id, Number(match[1])] as const;
  }));
  const batches = groupSessionItems(inputParts).map((batch) => batch as ContinuityItem[]);
  if (batches.some((batch) => batch.reduce((size, item) => size + item.name.length + item.transcription.length, 0) > 27000)) {
    throw new Error("Um nome de arquivo excede o limite seguro de tamanho do bloco.");
  }

  const warnings = new Set<string>();
  if (inputParts.length > items.length) {
    warnings.add("Transcrições longas foram divididas para análise; a ordem entre trechos e outros arquivos precisa de revisão.");
  }
  const parent = items.map((_, index) => index);
  const after = items.map(() => new Set<number>());
  function root(index: number): number {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  }

  function collectPlan(result: ContinuityPlan, sources: Map<string, number>, label: string) {
    if (!result || !Array.isArray(result.groups) || !Array.isArray(result.warnings)) {
      throw new Error(`Plano inválido em ${label}.`);
    }
    for (const warning of result.warnings) {
      if (typeof warning === "string" && warning.trim()) warnings.add(warning);
    }
    const seen = new Set<string>();
    let duplicate = false;
    let unknown = false;
    let invalid = false;
    for (const group of result.groups) {
      if (!group || !Array.isArray(group.itemIds)) {
        invalid = true;
        continue;
      }
      const sequence: number[] = [];
      for (const id of group.itemIds) {
        if (typeof id !== "string" || !sources.has(id)) {
          unknown = true;
          continue;
        }
        if (seen.has(id)) {
          duplicate = true;
          continue;
        }
        seen.add(id);
        const source = sources.get(id)!;
        if (sequence[sequence.length - 1] !== source) sequence.push(source);
      }
      for (let index = 1; index < sequence.length; index += 1) {
        const previous = sequence[index - 1];
        const current = sequence[index];
        parent[root(current)] = root(previous);
        after[previous].add(current);
      }
    }
    if (duplicate) warnings.add(`IDs duplicados na resposta de ${label}; repetições ignoradas.`);
    if (unknown) warnings.add(`IDs desconhecidos na resposta de ${label}; valores ignorados.`);
    if (invalid) warnings.add(`Grupo inválido na resposta de ${label}; revise os arquivos envolvidos.`);
    if (seen.size < sources.size) warnings.add(`IDs ausentes na resposta de ${label}; arquivos preservados sem conexão presumida.`);
  }

  async function requestPlan(request: Parameters<ContinuityBatchPlanner>[0], label: string) {
    try {
      return await planBatch(request);
    } catch (error) {
      throw new Error(`Falha em ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const descriptions: Array<{ source: number; text: string }> = [];
  onProgress?.({ stage: "analysis", completed: 0, total: batches.length });
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const label = `análise do bloco ${index + 1}`;
    const sources = new Map(batch.map((part) => [part.id, sourceByPart.get(part.id)!]));
    const response = await requestPlan({ items: batch, includeDescriptions: true }, label);
    collectPlan(response?.result, sources, label);
    const byId = new Map<string, string[]>();
    if (response.descriptions !== undefined && !Array.isArray(response.descriptions)) {
      warnings.add(`Descrições inválidas em ${label}; texto original usado na comparação.`);
    }
    for (const entry of Array.isArray(response.descriptions) ? response.descriptions : []) {
      if (!entry || typeof entry.itemId !== "string" || !sources.has(entry.itemId)) {
        warnings.add(`ID desconhecido em descrições de ${label}; valor ignorado.`);
        continue;
      }
      const values = byId.get(entry.itemId) ?? [];
      values.push(typeof entry.description === "string" ? entry.description : "");
      byId.set(entry.itemId, values);
    }
    for (const part of batch) {
      const values = byId.get(part.id) ?? [];
      if (values.length > 1) warnings.add(`Descrições duplicadas em ${label}; texto original usado na comparação.`);
      if (values.length === 0 || (values.length === 1 && !values[0].trim())) {
        warnings.add(`Descrições ausentes em ${label}; texto original usado na comparação.`);
      }
      descriptions.push({ source: sources.get(part.id)!, text: values.length === 1 && values[0].trim() ? values[0] : part.transcription });
    }
    onProgress?.({ stage: "analysis", completed: index + 1, total: batches.length });
  }

  const descriptionParts: Part[] = [];
  descriptions.forEach((description, index) => {
    const parts = prepareParts([{ id: `descricao-${index}`, name: `Descricao trecho ${index + 1}`, transcription: description.text }]);
    descriptionParts.push(...parts.map((part) => ({ ...part, source: description.source })));
  });
  const pages: Part[][] = [];
  for (const part of descriptionParts) {
    let page = pages[pages.length - 1];
    const size = part.name.length + part.transcription.length;
    if (size > 13500) throw new Error("Descrição excede o limite seguro de comparação.");
    if (!page || page.length >= 8 || page.reduce((total, entry) => total + entry.name.length + entry.transcription.length, 0) + size > 13500) {
      page = [];
      pages.push(page);
    }
    page.push(part);
  }
  const shouldCompare = (left: Part[], right: Part[]) => [...left, ...right].some((part) => part.source !== left[0].source);
  let total = 0;
  for (let left = 0; left < pages.length; left += 1) {
    for (let right = left; right < pages.length; right += 1) {
      if (shouldCompare(pages[left], pages[right])) total += 1;
    }
  }
  if (total) warnings.add("Comparações podem usar descrições geradas por IA; conexões e ordem sugeridas exigem revisão humana.");
  onProgress?.({ stage: "comparison", completed: 0, total });
  let completed = 0;
  for (let left = 0; left < pages.length; left += 1) {
    for (let right = left; right < pages.length; right += 1) {
      if (!shouldCompare(pages[left], pages[right])) continue;
      const parts = left === right ? pages[left] : [...pages[left], ...pages[right]];
      const sources = new Map(parts.map((part) => [part.id, part.source]));
      const requestItems = parts.map(({ id, name, transcription }) => ({ id, name, transcription }));
      const label = `comparação dos blocos ${left + 1} e ${right + 1}`;
      const response = await requestPlan({ items: requestItems, includeDescriptions: false }, label);
      collectPlan(response?.result, sources, label);
      completed += 1;
      onProgress?.({ stage: "comparison", completed, total });
    }
  }

  const components = new Map<number, number[]>();
  items.forEach((_, index) => {
    const key = root(index);
    const component = components.get(key) ?? [];
    component.push(index);
    components.set(key, component);
  });
  const groups = [...components.values()].map((component, index) => {
    const indegree = new Map(component.map((source) => [source, 0]));
    for (const source of component) {
      for (const next of after[source]) indegree.set(next, indegree.get(next)! + 1);
    }
    const available = component.filter((source) => indegree.get(source) === 0);
    const ordered: number[] = [];
    while (available.length) {
      available.sort((a, b) => a - b);
      const source = available.shift()!;
      ordered.push(source);
      for (const next of after[source]) {
        indegree.set(next, indegree.get(next)! - 1);
        if (indegree.get(next) === 0) available.push(next);
      }
    }
    if (ordered.length !== component.length) {
      warnings.add("Ordens sugeridas conflitantes; um grupo foi mantido na ordem original para revisão.");
    }
    const order = ordered.length === component.length ? ordered : component;
    return {
      id: `grupo-${index + 1}`,
      title: component.length > 1 ? "Possível continuidade" : "Sem conexão identificada",
      itemIds: order.map((source) => items[source].id),
      explanation: component.length > 1
        ? "Agrupamento por conexões sugeridas, inclusive indiretas; revise a relação e a ordem."
        : "Arquivo sem conexão confirmada com os demais.",
    };
  });
  return { groups, warnings: [...warnings], generatedAt: new Date().toISOString() };
}
