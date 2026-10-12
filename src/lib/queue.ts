export type DynamicQueueStatus = "idle" | "running" | "paused" | "cancelling";

export type DynamicQueueState = {
  status: DynamicQueueStatus;
  pendingIds: string[];
  lastEnqueuedAt: number;
  wake: Set<() => void>;
};

export async function runDynamicQueue(
  queue: DynamicQueueState,
  concurrency: number,
  processItem: (itemId: string) => Promise<void>,
  options: { pollMs?: number; quietPeriodMs?: number } = {},
): Promise<void> {
  const pollMs = options.pollMs ?? 180;
  const quietPeriodMs = options.quietPeriodMs ?? 900;
  const worker = async () => {
    while (true) {
      if (queue.status === "cancelling" || queue.status === "idle") return;
      if (queue.status === "paused") {
        await new Promise<void>((resolve) => queue.wake.add(resolve));
        continue;
      }

      const itemId = queue.pendingIds.shift();
      if (itemId) {
        try {
          await processItem(itemId);
        } catch {
          // One failed item must never stop the remaining queue.
        }
        continue;
      }

      if (Date.now() - queue.lastEnqueuedAt >= quietPeriodMs) return;
      await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
    }
  };

  const workerCount = Math.max(1, Math.min(Math.floor(concurrency) || 1, queue.pendingIds.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

export async function processInQueue<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<PromiseSettledResult<R>[]> {
  if (!items.length) {
    return [];
  }

  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      try {
        const value = await worker(items[currentIndex], currentIndex);
        results[currentIndex] = {
          status: "fulfilled",
          value,
        };
      } catch (reason) {
        results[currentIndex] = {
          status: "rejected",
          reason,
        };
      }
    }
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: safeConcurrency }, () => runWorker()));

  return results;
}
