import "server-only";

import { execFile } from "node:child_process";

export function runCommand(
  binary: string,
  args: string[],
  options: { signal?: AbortSignal; timeout?: number; maxBuffer?: number; env?: NodeJS.ProcessEnv } = {},
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(binary, args, {
      signal: options.signal,
      timeout: options.timeout,
      maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
      env: options.env,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        Object.assign(error, { stdout, stderr });
        reject(error);
        return;
      }

      resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}
