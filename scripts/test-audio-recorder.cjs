const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const jsx = (type, props) => ({ type, props: props || {} });
const jsxRuntime = { jsx, jsxs: jsx };
let hooks;
let hookIndex;
let pendingEffects;
let dirty;

const react = {
  useState(initial) {
    const index = hookIndex++;
    if (!hooks[index]) hooks[index] = { value: initial };
    return [hooks[index].value, (value) => {
      const next = typeof value === "function" ? value(hooks[index].value) : value;
      if (!Object.is(next, hooks[index].value)) dirty = true;
      hooks[index].value = next;
    }];
  },
  useRef(initial) {
    const index = hookIndex++;
    if (!hooks[index]) hooks[index] = { current: initial };
    return hooks[index];
  },
  useEffect(effect, dependencies) {
    const index = hookIndex++;
    const previous = hooks[index];
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
      pendingEffects.push(() => {
        previous?.cleanup?.();
        hooks[index] = { dependencies, cleanup: effect() };
      });
    }
  },
};

function loadComponent(relativePath, extraModules = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const loadedModule = { exports: {} };
  function localRequire(name) {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
    if (name in extraModules) return extraModules[name];
    return require(name);
  }
  new Function("exports", "require", "module", outputText)(loadedModule.exports, localRequire, loadedModule);
  return loadedModule.exports;
}

const actionButton = loadComponent("src/components/ActionButton.tsx");
const AudioRecorder = loadComponent("src/components/AudioRecorder.tsx", {
  "@/components/ActionButton": actionButton,
}).default;

function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (!node || typeof node !== "object") return node;
  if (typeof node.type === "function") return expand(node.type(node.props));
  return { ...node, props: { ...node.props, children: expand(node.props.children) } };
}

function findAll(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, predicate));
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []), ...findAll(node.props.children, predicate)];
}

function textOf(node) {
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object") return textOf(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function settle() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function mount(props) {
  hooks = [];
  let tree;
  return {
    render(nextProps) {
      if (nextProps) props = { ...props, ...nextProps };
      do {
        dirty = false;
        hookIndex = 0;
        pendingEffects = [];
        tree = AudioRecorder(props);
        pendingEffects.forEach((effect) => effect());
      } while (dirty);
      return expand(tree);
    },
    unmount() {
      hooks.forEach((hook) => hook?.cleanup?.());
    },
  };
}

function button(tree, label) {
  const match = findAll(tree, (node) => node.type === "button" && textOf(node).includes(label));
  assert.equal(match.length, 1, `Botão não encontrado: ${label}`);
  return match[0];
}

function click(node) {
  assert.equal(Boolean(node.props.disabled), false, "O botão deve estar habilitado");
  node.props.onClick();
}

let nextAudio = "first-audio";
let tracksStopped = 0;
let microphoneRequests = 0;
let microphone = () => Promise.resolve({ getTracks: () => [{ stop: () => { tracksStopped += 1; } }] });
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { mediaDevices: { getUserMedia: () => { microphoneRequests += 1; return microphone(); } } },
});
globalThis.window = { setInterval: () => 1, clearInterval: () => {} };
globalThis.MediaRecorder = class {
  static isTypeSupported(type) { return type === "audio/webm;codecs=opus"; }
  constructor(stream, options) {
    this.mimeType = options?.mimeType || "audio/webm";
    this.state = "inactive";
    this.listeners = {};
  }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.listeners.dataavailable({ data: new Blob([nextAudio], { type: this.mimeType }) });
    this.listeners.stop();
  }
};

const nativeCreateUrl = URL.createObjectURL.bind(URL);
const nativeRevokeUrl = URL.revokeObjectURL.bind(URL);
const createdUrls = [];
const revokedUrls = [];
URL.createObjectURL = (file) => {
  const url = nativeCreateUrl(file);
  createdUrls.push({ file, url });
  return url;
};
URL.revokeObjectURL = (url) => { revokedUrls.push(url); nativeRevokeUrl(url); };

async function startAndStop(app) {
  click(button(app.render(), "Gravar áudio"));
  await settle();
  click(button(app.render(), "Parar e transcrever"));
  await settle();
  return app.render();
}

async function main() {
  const calls = [];
  const app = mount({
    maxFileSizeMb: 1,
    onRecordingReady(file) {
      const result = deferred();
      calls.push({ file, ...result });
      return result.promise;
    },
  });

  let tree = await startAndStop(app);
  assert.equal(calls.length, 1, "A gravação deve ser enviada automaticamente uma vez");
  assert.equal(await calls[0].file.text(), "first-audio");
  const audio = findAll(tree, (node) => node.type === "audio");
  const downloads = findAll(tree, (node) => node.type === "a" && node.props.download);
  assert.equal(audio.length, 1, "O áudio deve estar disponível durante o envio");
  assert.equal(audio[0].props.controls, true);
  assert.equal(downloads.length, 1, "O original deve poder ser baixado");
  assert.equal(downloads[0].props.download, calls[0].file.name);
  assert.equal(downloads[0].props.href, audio[0].props.src);
  assert.equal(createdUrls[0].file, calls[0].file);
  const firstUrl = audio[0].props.src;

  calls[0].reject(new Error("Falha simulada"));
  await settle();
  tree = app.render();
  assert.match(textOf(tree), /Falha simulada/);
  assert.equal(findAll(tree, (node) => node.type === "audio")[0].props.src, firstUrl);
  tree = app.render({ disabled: true });
  assert.equal(button(tree, "Tentar novamente").props.disabled, true);
  assert.equal(findAll(tree, (node) => node.type === "audio").length, 1);
  assert.equal(findAll(tree, (node) => node.type === "a" && node.props.download).length, 1);
  tree = app.render({ disabled: false });
  const retry = button(tree, "Tentar novamente");
  click(retry);
  click(retry);
  await settle();
  tree = app.render();
  assert.equal(calls.length, 2, "Cliques repetidos não devem iniciar envios simultâneos");
  assert.equal(calls[1].file, calls[0].file, "A nova tentativa deve usar o mesmo File");
  assert.equal(findAll(tree, (node) => node.type === "audio")[0].props.src, firstUrl);
  calls[1].resolve();
  await settle();
  tree = app.render();
  assert.equal(findAll(tree, (node) => node.type === "button" && textOf(node).includes("Tentar novamente")).length, 0);

  nextAudio = "second-audio";
  tree = await startAndStop(app);
  assert.equal(calls.length, 3);
  assert.equal(await calls[2].file.text(), "second-audio");
  assert.notEqual(findAll(tree, (node) => node.type === "audio")[0].props.src, firstUrl);
  assert.ok(revokedUrls.includes(firstUrl), "A URL anterior deve ser revogada ao substituir a gravação");
  const secondUrl = findAll(tree, (node) => node.type === "audio")[0].props.src;
  calls[2].resolve();
  await settle();
  app.render();
  nextAudio = "";
  tree = await startAndStop(app);
  assert.equal(calls.length, 3, "Uma gravação vazia não deve ser enviada");
  assert.match(textOf(tree), /não gerou áudio/i);
  assert.equal(findAll(tree, (node) => node.type === "audio")[0].props.src, secondUrl);
  app.unmount();
  assert.ok(revokedUrls.includes(secondUrl), "A URL atual deve ser revogada ao desmontar");

  nextAudio = "second-audio";
  let oversizedCalls = 0;
  const oversized = mount({ maxFileSizeMb: 0.000001, onRecordingReady: async () => { oversizedCalls += 1; } });
  tree = await startAndStop(oversized);
  assert.equal(oversizedCalls, 0, "Um arquivo acima do limite não deve ser enviado");
  assert.match(textOf(tree), /limite/i);
  assert.equal(findAll(tree, (node) => node.type === "audio").length, 1, "O original acima do limite deve ser recuperável");
  assert.equal(findAll(tree, (node) => node.type === "a" && node.props.download).length, 1);
  assert.equal(findAll(tree, (node) => node.type === "button" && textOf(node).includes("Tentar novamente")).length, 0);
  oversized.unmount();

  const permission = deferred();
  microphone = () => permission.promise;
  const pending = mount({ maxFileSizeMb: 1, onRecordingReady: async () => { throw new Error("Envio inesperado"); } });
  const start = button(pending.render(), "Gravar áudio");
  const before = microphoneRequests;
  click(start);
  click(start);
  assert.equal(microphoneRequests, before + 1, "A permissão pendente não deve iniciar gravações duplicadas");
  pending.unmount();
  const stoppedBefore = tracksStopped;
  permission.resolve({ getTracks: () => [{ stop: () => { tracksStopped += 1; } }] });
  await settle();
  assert.equal(tracksStopped, stoppedBefore + 1, "O microfone deve ser liberado se a permissão chegar após desmontar");

  console.log("Gravação: recuperação, tentativas, limites, concorrência e limpeza validados sem rede.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
