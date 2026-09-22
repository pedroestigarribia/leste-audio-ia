"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Check, Clipboard, Copy, Eraser, FileText, Loader2, Sparkles } from "lucide-react";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";

const MAX_CHARS = 30000;

const MODES = [
  { value: "corrigir", label: "Corrigir" },
  { value: "reescrever", label: "Reescrever" },
  { value: "encurtar", label: "Encurtar" },
  { value: "expandir", label: "Expandir" },
  { value: "profissional", label: "Profissional" },
  { value: "informal", label: "Informal" },
  { value: "clareza", label: "Clareza" },
  { value: "remover_repeticoes", label: "Remover repetições" },
  { value: "pontuacao", label: "Pontuação" },
  { value: "humanizar", label: "Humanizar" },
] as const;

type ModeValue = (typeof MODES)[number]["value"];

function countWords(str: string): number {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function TextCorrectorPanel() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [mode, setMode] = useState<ModeValue>("corrigir");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("corretoria_draft");
      if (saved) setInputText(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("corretoria_draft", inputText);
    } catch {}
  }, [inputText]);

  const inputChars = inputText.length;
  const inputWords = countWords(inputText);
  const outputChars = outputText.length;
  const outputWords = countWords(outputText);

  const handleCopy = useCallback(async (key: string, text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1800);
    } catch {}
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputText(text);
      inputRef.current?.focus();
    } catch {}
  }, []);

  const handleUseResult = useCallback(() => {
    if (!outputText.trim()) return;
    setInputText(outputText);
    inputRef.current?.focus();
  }, [outputText]);

  const handleClear = useCallback(() => {
    if (!inputText && !outputText) {
      inputRef.current?.focus();
      return;
    }
    setInputText("");
    setOutputText("");
    setError(null);
    inputRef.current?.focus();
  }, [inputText, outputText]);

  const handleProcess = useCallback(async () => {
    if (isProcessing) return;
    if (!inputText.trim()) {
      setError("Digite ou cole um texto antes de processar.");
      return;
    }
    if (inputChars > MAX_CHARS) {
      setError(`O texto ultrapassou o limite de ${MAX_CHARS.toLocaleString("pt-BR")} caracteres.`);
      return;
    }

    setIsProcessing(true);
    setError(null);
    setOutputText("");

    try {
      const response = await fetch("/api/text-correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, mode }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        result?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(payload.error || "Falha ao processar o texto.");
      }

      setOutputText(payload.result);
      outputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar.");
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, inputChars, mode, isProcessing]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleProcess();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleProcess]);

  const charCountColor =
    inputChars > MAX_CHARS
      ? "text-red-600 font-semibold"
      : inputChars >= MAX_CHARS - 500
        ? "text-amber-600 font-semibold"
        : "text-slate-500";

  return (
    <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-editorial sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">Corretor IA</h2>
          <p className="mt-1 text-sm text-slate-500">
            Corrija, reescreva, ajuste e transforme textos com IA.
          </p>
        </div>
        <span className="hidden rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-400 sm:inline-block">
          Ctrl + Enter
        </span>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Original</span>
            <div className="flex gap-1">
              <button className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={handlePaste} type="button">
                <Clipboard className="inline h-3 w-3" /> Colar
              </button>
              <button className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={() => void handleCopy("input", inputText)} type="button">
                {copiedKey === "input" ? <Check className="inline h-3 w-3" /> : <Copy className="inline h-3 w-3" />} Copiar
              </button>
              <button className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={() => { inputRef.current?.focus(); inputRef.current?.select(); }} type="button">
                <FileText className="inline h-3 w-3" /> Selecionar
              </button>
            </div>
          </div>
          <textarea
            ref={inputRef}
            className="min-h-[180px] w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-leste-blue focus:ring-2 focus:ring-leste-blue/20"
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Cole ou escreva seu texto aqui..."
            spellCheck
            value={inputText}
          />
          <div className="flex gap-4 text-xs text-slate-500">
            <span className={charCountColor}>{inputChars.toLocaleString("pt-BR")} / {MAX_CHARS.toLocaleString("pt-BR")} caracteres</span>
            <span>{inputWords.toLocaleString("pt-BR")} {inputWords === 1 ? "palavra" : "palavras"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Processado</span>
            <div className="flex gap-1">
              <button className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={() => void handleCopy("output", outputText)} type="button">
                {copiedKey === "output" ? <Check className="inline h-3 w-3" /> : <Copy className="inline h-3 w-3" />} Copiar
              </button>
              <button className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={() => { outputRef.current?.focus(); outputRef.current?.select(); }} type="button">
                <FileText className="inline h-3 w-3" /> Selecionar
              </button>
            </div>
          </div>
          <textarea
            ref={outputRef}
            className="min-h-[180px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
            placeholder="O texto processado aparecerá aqui..."
            readOnly
            value={outputText}
          />
          <div className="flex gap-4 text-xs text-slate-500">
            <span>{outputChars.toLocaleString("pt-BR")} caracteres</span>
            <span>{outputWords.toLocaleString("pt-BR")} {outputWords === 1 ? "palavra" : "palavras"}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <select
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-leste-blue focus:ring-2 focus:ring-leste-blue/20"
          onChange={(e) => setMode(e.target.value as ModeValue)}
          value={mode}
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <ActionButton fullWidth={false} loading={isProcessing} onClick={handleProcess} type="button" variant="primary">
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Processar
        </ActionButton>

        <ActionButton fullWidth={false} onClick={handleUseResult} type="button" variant="secondary">
          <ArrowRightLeft className="h-4 w-4" />
          Usar resultado
        </ActionButton>

        <ActionButton fullWidth={false} onClick={handleClear} type="button" variant="danger">
          <Eraser className="h-4 w-4" />
          Limpar
        </ActionButton>
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        Ferramenta auxiliar. Revise sempre o resultado. O texto é enviado ao serviço de IA somente quando você solicita.
      </p>
    </section>
  );
}
