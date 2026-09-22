import "server-only";

import { getServerEnv } from "@/lib/env";

type LimitKind = "analysis" | "render";
type Gate = { active: number; waiters: Array<() => void> };

declare global {
  // eslint-disable-next-line no-var
  var lesteVideoGates: Record<LimitKind, Gate> | undefined;
}

function getGates() {
  globalThis.lesteVideoGates ??= {
    analysis: { active: 0, waiters: [] },
    render: { active: 0, waiters: [] },
  };
  return globalThis.lesteVideoGates;
}

async function acquire(kind: LimitKind, signal: AbortSignal) {
  const gate = getGates()[kind];
  const limit = kind === "analysis" ? getServerEnv().maxAnalysisConcurrency : getServerEnv().maxRenderConcurrency;
  while (gate.active >= limit) {
    if (signal.aborted) throw new DOMException("Processamento cancelado.", "AbortError");
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        reject(new DOMException("Processamento cancelado.", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      gate.waiters.push(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      });
    });
  }
  gate.active += 1;
}

function release(kind: LimitKind) {
  const gate = getGates()[kind];
  gate.active = Math.max(0, gate.active - 1);
  gate.waiters.shift()?.();
}

export async function withVideoLimit<T>(kind: LimitKind, signal: AbortSignal, task: () => Promise<T>) {
  await acquire(kind, signal);
  try {
    return await task();
  } finally {
    release(kind);
  }
}
