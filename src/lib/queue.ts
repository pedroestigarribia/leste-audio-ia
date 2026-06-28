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
