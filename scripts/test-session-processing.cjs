const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadTypeScriptModule(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("exports", "require", "module", outputText)(module.exports, require, module);
  return module.exports;
}

const { prepareSessionBatches } = loadTypeScriptModule("src/lib/session-batches.ts");
const { runDynamicQueue } = loadTypeScriptModule("src/lib/queue.ts");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function testSessionBatchIntegrity() {
  for (const count of [60, 100]) {
    const items = Array.from({ length: count }, (_, index) => ({
      id: `audio-${index}`,
      name: `WhatsApp ${index}.ogg`,
      transcription: (`Texto integral do áudio ${index}. `).repeat(index % 9 === 0 ? 500 : 40),
    }));
    const batches = prepareSessionBatches(items);
    const parts = batches.flat();

    assert.equal(parts.length, items.reduce((total, item) => total + Math.ceil(item.transcription.length / 9_000), 0));
    for (const batch of batches) {
      assert(batch.length <= 8);
      assert(batch.reduce((total, item) => total + item.name.length + item.transcription.length, 0) <= 27_000);
    }

    for (const item of items) {
      const matchingParts = parts
        .filter((part) => part.id === item.id || part.id.startsWith(`${item.id}-parte-`))
        .sort((left, right) => {
          const partNumber = (entry) => Number(entry.id.match(/parte-(\d+)$/)?.[1] ?? 1);
          return partNumber(left) - partNumber(right);
        });
      assert.equal(matchingParts.map((part) => part.transcription).join(""), item.transcription);
    }

    console.log(`${count} áudios: ${batches.length} blocos e ${parts.length} trechos; conteúdo integral preservado.`);
  }
}

async function testDynamicQueue() {
  const queue = {
    status: "running",
    pendingIds: Array.from({ length: 60 }, (_, index) => String(index)),
    lastEnqueuedAt: Date.now(),
    wake: new Set(),
  };
  const processed = [];
  let active = 0;
  let maxActive = 0;

  await runDynamicQueue(queue, 3, async (id) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (id === "0") {
      queue.pendingIds.push(...Array.from({ length: 40 }, (_, index) => String(index + 60)));
      queue.lastEnqueuedAt = Date.now();
    }
    await delay(2);
    processed.push(id);
    active -= 1;
  });
  assert.equal(processed.length, 100);
  assert.equal(new Set(processed).size, 100);
  assert(maxActive <= 3);

  const pausedQueue = {
    status: "running",
    pendingIds: ["a", "b", "c"],
    lastEnqueuedAt: Date.now(),
    wake: new Set(),
  };
  const pausedProcessed = [];
  const running = runDynamicQueue(pausedQueue, 1, async (id) => {
    pausedProcessed.push(id);
    if (id === "a") pausedQueue.status = "paused";
  });
  await delay(30);
  assert.deepEqual(pausedProcessed, ["a"]);
  pausedQueue.status = "running";
  pausedQueue.wake.forEach((resume) => resume());
  pausedQueue.wake.clear();
  await running;
  assert.deepEqual(pausedProcessed, ["a", "b", "c"]);

  const cancelledQueue = {
    status: "running",
    pendingIds: ["a", "b", "c"],
    lastEnqueuedAt: Date.now(),
    wake: new Set(),
  };
  const cancelledProcessed = [];
  await runDynamicQueue(cancelledQueue, 1, async (id) => {
    cancelledProcessed.push(id);
    cancelledQueue.status = "cancelling";
    cancelledQueue.pendingIds = [];
  });
  assert.deepEqual(cancelledProcessed, ["a"]);
  console.log(`Fila: 100 processados; concorrência máxima ${maxActive}; pausa, retomada e cancelamento validados.`);
}

async function main() {
  testSessionBatchIntegrity();
  await testDynamicQueue();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
