import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { getServerEnv } from "@/lib/env";
import { getJobDir } from "@/lib/video/paths";
import { runYtDlp } from "@/lib/video/yt-dlp-binary";

type YoutubeInfo = {
  title?: string;
  channel?: string;
  uploader?: string;
  thumbnail?: string;
  duration?: number;
  availability?: string;
};

function isRateLimited(error: unknown) {
  const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
  return /429|too many requests|confirm you.re not a bot|unusual traffic/i.test(`${stderr} ${error instanceof Error ? error.message : ""}`);
}

function acquisitionError(error: unknown) {
  const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
  const message = `${stderr} ${error instanceof Error ? error.message : ""}`;
  if (isRateLimited(error)) {
    return new Error("O YouTube limitou o acesso deste servidor (429 ou verificação de robô). Tente mais tarde ou envie o MP4 autorizado.");
  }
  if (/private|sign in|login|cookies|members.only|age.restricted/i.test(message)) {
    return new Error("Este vídeo exige login ou tem acesso restrito. Envie um MP4 que você possa usar.");
  }
  if (/max.filesize|larger than max|exceeds maximum/i.test(message)) {
    return new Error("O vídeo excede o limite configurado para cortes.");
  }
  if (/\bENOENT\b/i.test(message)) {
    return new Error("O yt-dlp não está disponível no servidor. Verifique a instalação do aplicativo.");
  }
  return new Error("Não foi possível obter o vídeo pelo link do YouTube. Tente outro link público ou envie o MP4 autorizado.");
}

export async function acquireYoutubeVideo(jobId: string, url: string, signal: AbortSignal) {
  if (Number(process.versions.node.split(".")[0]) < 22) {
    throw new Error("O download por link requer Node.js 22 ou superior no servidor.");
  }

  const env = getServerEnv();
  const jobDir = getJobDir(jobId);
  const proxy = env.ytDlpProxyUrl;
  if (proxy) {
    try {
      if (!["http:", "https:", "socks5:"].includes(new URL(proxy).protocol)) throw new Error();
    } catch {
      throw new Error("YTDLP_PROXY_URL inválida. Configure uma URL HTTP, HTTPS ou SOCKS5 válida no servidor.");
    }
  }
  const common = [
    "--no-playlist", "--no-warnings", "--ignore-config", "--js-runtimes", "node",
    "--extractor-retries", "1", "--retries", "1", "--socket-timeout", "20",
    ...(proxy ? [`--proxy=${proxy}`] : []),
    "--extractor-args", "youtube:player_client=web_embedded;player_skip=webpage",
  ];
  let completed = false;
  let forceIpv6 = false;

  async function runSource(args: string[], timeout: number) {
    const options = { signal, timeout };
    try {
      return await runYtDlp([...common, ...(forceIpv6 ? ["--force-ipv6"] : []), ...args], options);
    } catch (error) {
      if (proxy || forceIpv6 || signal.aborted || !isRateLimited(error)) throw error;
      try {
        const result = await runYtDlp([...common, "--force-ipv6", ...args], options);
        forceIpv6 = true;
        return result;
      } catch {
        throw error;
      }
    }
  }

  try {
    const { stdout } = await runSource(["--dump-single-json", "--skip-download", "--quiet", url], Math.min(env.processTimeoutMs, 90_000));
    const info = JSON.parse(stdout) as YoutubeInfo;
    if (["private", "needs_auth", "subscriber_only", "premium_only"].includes(info.availability ?? "")) {
      throw new Error("Este vídeo exige login ou tem acesso restrito. Envie um MP4 que você possa usar.");
    }
    if (!Number.isFinite(info.duration) || !info.duration || info.duration <= 0) {
      throw new Error("O YouTube não informou a duração do vídeo; não é seguro baixá-lo sem esse limite.");
    }
    if (info.duration > env.maxVideoDurationSec) {
      throw new Error(`O vídeo excede o limite de ${Math.floor(env.maxVideoDurationSec / 60)} minutos.`);
    }

    await runSource([
      "--format", "best[ext=mp4][height<=720]/best[height<=720]",
      "--max-filesize", `${env.maxVideoUploadMb}M`,
      "--match-filters", `duration <=? ${env.maxVideoDurationSec}`,
      "--no-progress", "--no-part", "--no-continue",
      "--output", path.join(jobDir, "source.%(ext)s"),
      url,
    ], env.processTimeoutMs);

    const name = (await fs.readdir(jobDir)).find((entry) => /^source\.(?:mp4|webm|mkv|mov|m4v)$/i.test(entry));
    if (!name) throw new Error("O YouTube não retornou um arquivo de vídeo utilizável.");
    const sourcePath = path.join(jobDir, name);
    if ((await fs.stat(sourcePath)).size > env.maxVideoUploadMb * 1024 * 1024) {
      throw new Error(`O vídeo excede o limite de ${env.maxVideoUploadMb} MB.`);
    }
    if (signal.aborted) throw new DOMException("Processamento cancelado.", "AbortError");
    completed = true;

    return {
      sourcePath,
      title: info.title?.slice(0, 160) || "Vídeo do YouTube",
      channel: info.channel || info.uploader,
      thumbnail: info.thumbnail,
    };
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof Error && /^(Este vídeo|O vídeo|O YouTube não informou|O YouTube não retornou)/.test(error.message)) throw error;
    throw acquisitionError(error);
  } finally {
    if (!completed) {
      const entries = await fs.readdir(jobDir).catch(() => []);
      await Promise.all(entries.filter((entry) => entry.startsWith("source.")).map((entry) =>
        fs.rm(path.join(jobDir, entry), { force: true }).catch(() => undefined)));
    }
  }
}
