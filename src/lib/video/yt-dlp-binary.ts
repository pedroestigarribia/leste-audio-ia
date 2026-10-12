import "server-only";

import path from "node:path";

import { getServerEnv } from "@/lib/env";

export function getYtDlpBinary() {
  const configuredPath = getServerEnv().ytDlpBin;
  if (configuredPath && configuredPath !== "yt-dlp") {
    return path.resolve(process.cwd(), configuredPath);
  }

  const bundledName = process.env.YOUTUBE_DL_FILENAME || (process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  return path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", path.basename(bundledName));
}
