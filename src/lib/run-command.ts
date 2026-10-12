import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function runCommand(
  binary: string,
  args: string[],
  options: { signal?: AbortSignal; timeout?: number; maxBuffer?: number } = {},
) {
  return execFileAsync(binary, args, {
    signal: options.signal,
    timeout: options.timeout,
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    windowsHide: true,
  });
}
