import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { getServerEnv } from "@/lib/env";
import { runCommand } from "@/lib/run-command";
import { ensureTempDir } from "@/lib/temp-files";

export function getYtDlpBinary() {
  const configuredPath = getServerEnv().ytDlpBin;
  if (configuredPath && configuredPath !== "yt-dlp") {
    return path.resolve(process.cwd(), configuredPath);
  }

  const bundledName = process.env.YOUTUBE_DL_FILENAME || (process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  return path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", path.basename(bundledName));
}

export async function runYtDlp(
  args: string[],
  options: { signal?: AbortSignal; timeout?: number; maxBuffer?: number } = {},
) {
  if (process.platform === "win32") {
    return runCommand(getYtDlpBinary(), args, options);
  }

  const tempRoot = await ensureTempDir();
  const extractionDir = await fs.mkdtemp(path.join(tempRoot, "yt-dlp-extract-"));
  try {
    return await runCommand(getYtDlpBinary(), args, {
      ...options,
      env: { ...process.env, TMPDIR: extractionDir },
    });
  } finally {
    await fs.rm(extractionDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
