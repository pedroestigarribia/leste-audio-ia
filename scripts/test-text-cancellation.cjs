const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(path, modules) {
  const source = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", js)(module, module.exports, (name) => {
    if (Object.hasOwn(modules, name)) return modules[name];
    return require(name);
  });
  return module.exports;
}

(async () => {
  const signal = new AbortController().signal;
  const calls = [];
  class OpenAI {
    constructor(options) {
      calls.push({ options });
      this.responses = { create: async (_body, request) => { calls.push({ request }); return { output_text: "ok" }; } };
      this.chat = { completions: { create: async (_body, request) => {
        calls.push({ request });
        return { choices: [{ message: { content: "ok" } }] };
      } } };
    }
  }
  class GoogleGenAI {
    constructor() {
      this.models = { generateContent: async (request) => { calls.push({ request }); return { text: "ok" }; } };
    }
  }
  const env = {
    getServerEnv: () => ({ openAiTextModel: "test", deepSeekBaseUrl: "https://example.invalid", deepSeekModel: "test", geminiTextModel: "test" }),
    requireOpenAIApiKey: () => "test-key",
    requireDeepSeekApiKey: () => "test-key",
    requireGeminiApiKey: () => "test-key",
    MissingApiKeyError: class MissingApiKeyError extends Error {},
  };
  const modules = { "server-only": {}, openai: OpenAI, "@google/genai": { GoogleGenAI }, "@/lib/env": env };
  const openai = load("src/lib/openai-text.ts", modules);
  const deepseek = load("src/lib/deepseek.ts", modules);
  const gemini = load("src/lib/gemini-text.ts", modules);
  assert.equal(await openai.runOpenAITextTask({ prompt: "teste", signal }), "ok");
  assert.equal(calls[0].options.maxRetries, 0);
  assert.equal(calls[1].request.signal, signal);
  assert.equal(await deepseek.runDeepSeekTextTask({ prompt: "teste", signal }), "ok");
  assert.equal(calls[2].options.maxRetries, 0);
  assert.equal(calls[3].request.signal, signal);
  assert.equal(await gemini.runGeminiTextTask({ prompt: "teste", signal }), "ok");
  assert.equal(calls[4].request.config.abortSignal, signal);
  console.log("Cancelamento: sinal propagado aos três provedores e repetição automática desativada na comparação.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
