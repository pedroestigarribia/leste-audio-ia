const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadModule(relativePath, mocks = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  const localRequire = (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  new Function("exports", "require", "module", outputText)(loaded.exports, localRequire, loaded);
  return loaded.exports;
}

const sessionBatches = loadModule("src/lib/session-batches.ts");
const { organizeContinuityBatches } = loadModule("src/lib/continuity-batches.ts", {
  "@/lib/session-batches": sessionBatches,
});

const plan = (groups, warnings = []) => ({ groups, warnings, generatedAt: "2026-01-01T00:00:00.000Z" });
const group = (itemIds) => ({ id: "grupo", title: "Possivel continuidade", itemIds, explanation: "Sugestao", confidence: 70 });
const independent = (items) => items.map((item) => group([item.id]));

async function testCrossBatchContinuity() {
  const inputs = Array.from({ length: 150 }, (_, index) => ({
    id: index === 1 ? "audio-1-parte-1" : index === 2 ? "fonte-0-parte-1" : `audio-${index + 1}`,
    name: `Arquivo ${index + 1}`,
    transcription: `INICIO-${index + 1}|${({ 0: "REL-A", 4: "REL-B", 14: "REL-C" })[index] ?? "SOLTO"}|${"x".repeat(index === 0 ? 21000 : 6200)}|FIM-${index + 1}`,
  }));
  const analyzed = [];
  const markerBatch = new Map();
  const progress = [];
  let comparisons = 0;

  const result = await organizeContinuityBatches(inputs, async ({ items, includeDescriptions }) => {
    assert(items.length <= (includeDescriptions ? 8 : 16));
    assert(items.reduce((sum, item) => sum + item.name.length + item.transcription.length, 0) <= 27000);
    assert(items.every((item) => item.transcription.length <= 50000));
    if (includeDescriptions) {
      const batchIndex = analyzed.length;
      analyzed.push(items);
      for (const item of items) {
        const marker = item.transcription.match(/REL-[ABC]/)?.[0];
        if (marker) markerBatch.set(marker, batchIndex);
      }
      return {
        result: plan(independent(items)),
        descriptions: items.map((item) => ({
          itemId: item.id,
          description: item.transcription.match(/REL-[ABC]/)?.[0] ?? `SEM-RELACAO ${item.id}`,
        })),
      };
    }
    comparisons += 1;
    const related = items.filter((item) => /REL-[ABC]/.test(item.transcription))
      .sort((a, b) => a.transcription.localeCompare(b.transcription));
    const relatedIds = new Set(related.map((item) => item.id));
    return { result: plan([
      ...(related.length > 1 ? [group(related.map((item) => item.id))] : independent(related)),
      ...independent(items.filter((item) => !relatedIds.has(item.id))),
    ]) };
  }, (value) => progress.push(value));

  assert.equal(new Set(markerBatch.values()).size, 3, "1, 5 e 15 devem vir de tres blocos iniciais diferentes");
  assert(comparisons > 0, "os blocos devem ser comparados entre si");
  const relatedGroup = result.groups.find((entry) => entry.itemIds.includes(inputs[0].id));
  assert.deepEqual(relatedGroup.itemIds, [inputs[0].id, inputs[4].id, inputs[14].id]);
  const resultIds = result.groups.flatMap((entry) => entry.itemIds);
  assert.equal(resultIds.length, inputs.length);
  assert.deepEqual(new Set(resultIds), new Set(inputs.map((item) => item.id)));
  assert(result.groups.some((entry) => entry.itemIds.length === 1 && entry.itemIds[0] === inputs[99].id));
  assert(result.warnings.length > 0, "a incerteza deve ser informada");
  assert(progress.some((entry) => entry.stage === "analysis" && entry.completed === entry.total));
  assert(progress.some((entry) => entry.stage === "comparison" && entry.completed === entry.total));

  for (const input of inputs) {
    const parts = analyzed.flat().filter((item) => item.name === input.name || item.name.startsWith(`${input.name} (parte `));
    assert.equal(parts.map((item) => item.transcription).join(""), input.transcription, `texto integral de ${input.name}`);
  }
  console.log(`150 arquivos: ${analyzed.length} analises, ${comparisons} comparacoes; relacao 1/5/15 preservada.`);
}

async function testMissingDuplicateAndFailures() {
  const inputs = ["a", "b", "c"].map((id) => ({ id, name: id, transcription: `TEXTO ORIGINAL ${id}` }));
  const compared = [];
  const result = await organizeContinuityBatches(inputs, async ({ items, includeDescriptions }) => {
    if (includeDescriptions) {
      return {
        result: plan([group([items[0].id, items[0].id, "id-inexistente"])]),
        descriptions: [
          { itemId: items[0].id, description: "descricao A" },
          { itemId: items[0].id, description: "descricao conflitante" },
          { itemId: "id-inexistente", description: "desconhecida" },
        ],
      };
    }
    compared.push(...items.map((item) => item.transcription));
    return { result: plan(independent(items)) };
  });
  assert.deepEqual(new Set(result.groups.flatMap((entry) => entry.itemIds)), new Set(["a", "b", "c"]));
  assert(result.groups.every((entry) => entry.itemIds.length === 1), "nao inventar relacoes");
  assert(inputs.every((input) => compared.includes(input.transcription)), "descricoes ausentes ou duplicadas usam texto original");
  assert(result.warnings.some((warning) => /duplicad/i.test(warning)));
  assert(result.warnings.some((warning) => /ausent|falt|omit/i.test(warning)));
  assert(result.warnings.some((warning) => /desconhec|inexist/i.test(warning)));

  let called = false;
  await assert.rejects(() => organizeContinuityBatches([inputs[0], inputs[0]], async () => {
    called = true;
    throw new Error("nao deveria chamar");
  }), /duplicad/i);
  assert.equal(called, false);
  await assert.rejects(() => organizeContinuityBatches([{ ...inputs[0], name: "n".repeat(27000) }], async () => {
    called = true;
    throw new Error("nao deveria chamar");
  }), /limite/i);
  assert.equal(called, false);
  await assert.rejects(() => organizeContinuityBatches(inputs, async () => ({ result: { groups: null, warnings: [] } })), /plano inválido/i);
  await assert.rejects(() => organizeContinuityBatches(inputs, async () => {
    throw new Error("falha simulada");
  }), /falha simulada/i);
  let comparisonCalls = 0;
  await assert.rejects(() => organizeContinuityBatches(inputs, async ({ items, includeDescriptions }) => {
    comparisonCalls += 1;
    if (!includeDescriptions) throw new Error("falha na comparacao");
    return { result: plan(independent(items)), descriptions: items.map((item) => ({ itemId: item.id, description: item.transcription })) };
  }), /falha na comparacao/i);
  assert.equal(comparisonCalls, 2, "nenhuma chamada adicional após falha ou cancelamento da comparação");
  console.log("IDs ausentes, duplicados e desconhecidos; falhas de analise e comparacao verificadas.");
}

async function testLongDescriptions() {
  const description = `INICIO-${"z".repeat(22000)}-FIM`;
  const inputs = ["a", "b"].map((id) => ({ id, name: id, transcription: `Original ${id}` }));
  const seen = new Map();
  await organizeContinuityBatches(inputs, async ({ items, includeDescriptions }) => {
    if (includeDescriptions) {
      return { result: plan(independent(items)), descriptions: items.map((item, index) => ({ itemId: item.id, description: index ? "OUTRA-DESCRICAO" : description })) };
    }
    for (const item of items) seen.set(item.id, item);
    return { result: plan(independent(items)) };
  });
  const parts = [...seen.values()].filter((item) => item.transcription !== "OUTRA-DESCRICAO")
    .sort((a, b) => Number(a.name.match(/parte (\d+)/)?.[1] ?? 1) - Number(b.name.match(/parte (\d+)/)?.[1] ?? 1));
  assert.equal(parts.map((item) => item.transcription).join(""), description);
  console.log("Descricao longa reenviada integralmente, sem corte silencioso.");
}

async function testConflictingOrderAndUnicode() {
  const original = `${"a".repeat(8999)}😀${"b".repeat(10000)}`;
  const inputs = [
    { id: "first", name: "first", transcription: original },
    { id: "second", name: "second", transcription: "Segundo arquivo" },
  ];
  const analyzed = [];
  let comparisons = 0;
  const result = await organizeContinuityBatches(inputs, async ({ items, includeDescriptions }) => {
    if (includeDescriptions) {
      analyzed.push(...items.filter((item) => item.name.startsWith("first")));
      return { result: plan(independent(items)), descriptions: items.map((item) => ({ itemId: item.id, description: `${item.name} ${"x".repeat(8000)}` })) };
    }
    comparisons += 1;
    const reversed = comparisons % 2 === 0;
    const sorted = [...items].sort((a, b) => {
      const left = a.transcription.startsWith("first") ? 0 : 1;
      const right = b.transcription.startsWith("first") ? 0 : 1;
      return reversed ? right - left : left - right;
    });
    return { result: plan([group(sorted.map((item) => item.id))]) };
  });
  assert.equal(analyzed.map((part) => part.transcription).join(""), original);
  for (const part of analyzed) {
    assert(!/[\uD800-\uDBFF]$/.test(part.transcription), "nao separar pares UTF-16 no fim de um trecho");
    assert(!/^[\uDC00-\uDFFF]/.test(part.transcription), "nao separar pares UTF-16 no inicio de um trecho");
  }
  assert.deepEqual(result.groups[0].itemIds, ["first", "second"]);
  assert(result.warnings.some((warning) => /conflit/i.test(warning)));
  const empty = await organizeContinuityBatches([], async () => { throw new Error("chamada inesperada"); });
  assert.deepEqual(empty.groups, []);
  console.log("Ordem conflitante, entrada vazia e divisao Unicode verificadas.");
}

async function testInterleavedSource() {
  const inputs = [
    { id: "first", name: "first", transcription: "a".repeat(10000) },
    { id: "second", name: "second", transcription: "segundo" },
  ];
  const result = await organizeContinuityBatches(inputs, async ({ items, includeDescriptions }) => {
    if (includeDescriptions) {
      return {
        result: plan([group([items[0].id, items[2].id, items[1].id])]),
        descriptions: items.map((item) => ({ itemId: item.id, description: item.name })),
      };
    }
    return { result: plan(independent(items)) };
  });
  assert.deepEqual(result.groups[0].itemIds, ["first", "second"]);
  assert(result.warnings.some((warning) => /conflit/i.test(warning)), "intercalacao nao cabe em uma ordem de IDs unicos");
  console.log("Intercalacao de trechos de uma fonte sinalizada como conflito.");
}

async function testRouteCompatibility() {
  const promptModule = loadModule("src/prompts/organizeSequence.ts", {
    "@/lib/plain-text": loadModule("src/lib/plain-text.ts"),
  });
  let prompt = "";
  let system = "";
  let calls = 0;
  let integrated = false;
  const modelResult = {
    groups: [group(["estranho"]), group(["one", "one"])],
    warnings: [],
    descriptions: [{ itemId: "one", description: "primeira" }, { itemId: "one", description: "duplicada" }],
  };
  const { POST } = loadModule("src/app/api/organize-sequence/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/lib/env": { MissingApiKeyError: class MissingApiKeyError extends Error {}, getTextAIMissingKeyMessage: () => "sem chave" },
    "@/lib/plain-text": loadModule("src/lib/plain-text.ts"),
    "@/lib/text-ai": { runTextTask: async (params) => {
      calls += 1;
      prompt = params.prompt;
      system = params.system;
      if (!integrated) return JSON.stringify(modelResult);
      const sent = JSON.parse(prompt.split("ARQUIVOS (dados JSON):\n")[1]);
      const describe = prompt.includes('"descriptions": [');
      return JSON.stringify({
        groups: describe ? independent(sent) : [group(sent.map((item) => item.id))],
        warnings: [],
        ...(describe ? { descriptions: sent.map((item) => ({ itemId: item.id, description: item.transcription })) } : {}),
      });
    } },
    "@/prompts/organizeSequence": promptModule,
  });
  const items = [
    { id: "one", name: "um", transcription: "texto *integral*\n[link](https://exemplo.invalid)" },
    { id: "two", name: "dois", transcription: "segundo" },
  ];
  const request = (body) => ({ json: async () => body });
  const response = await POST(request({ items, includeDescriptions: true }));
  assert.equal(response.status, 200);
  assert.deepEqual(new Set(response.body.result.groups.flatMap((entry) => entry.itemIds)), new Set(["one", "two"]));
  assert.equal(new Set(response.body.result.groups.map((entry) => entry.id)).size, response.body.result.groups.length);
  assert(response.body.result.warnings.some((warning) => /duplicad/i.test(warning)));
  assert(response.body.result.warnings.some((warning) => /ausent|falt|omit/i.test(warning)));
  assert(response.body.result.warnings.some((warning) => /desconhec|inexist/i.test(warning)));
  assert.equal(response.body.descriptions.length, 2, "duplicatas devem permanecer detectaveis pelo cliente");
  assert(prompt.includes(JSON.stringify(items[0].transcription)), "o prompt deve preservar o texto de origem");
  assert.match(system, /hipóteses/i);
  assert.match(prompt, /indícios/i);

  modelResult.descriptions = { unexpected: true };
  modelResult.groups = [{ ...group(["one"]), title: null, explanation: null }];
  modelResult.warnings = null;
  const legacy = await POST(request({ items }));
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.ok, true);
  assert.equal(legacy.body.descriptions, undefined);
  const malformedDescriptions = await POST(request({ items, includeDescriptions: true }));
  assert.deepEqual(malformedDescriptions.body.descriptions, { unexpected: true });
  const callsBeforeDuplicate = calls;
  const duplicate = await POST(request({ items: [items[0], items[0]], includeDescriptions: true }));
  assert.equal(duplicate.status, 400);
  assert.equal(calls, callsBeforeDuplicate);
  integrated = true;
  const integratedPlan = await organizeContinuityBatches(items, async (body) => {
    const reply = await POST(request(body));
    if (reply.status !== 200 || !reply.body.ok) throw new Error(reply.body.error);
    return reply.body;
  });
  assert.deepEqual(integratedPlan.groups.map((entry) => entry.itemIds), [["one", "two"]]);
  console.log("Contrato antigo e extensao da rota verificados com provedor simulado.");
}

async function main() {
  await testCrossBatchContinuity();
  await testMissingDuplicateAndFailures();
  await testLongDescriptions();
  await testConflictingOrderAndUnicode();
  await testInterleavedSource();
  await testRouteCompatibility();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
