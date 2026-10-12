import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { convertToWav } from "@/lib/audio-convert";
import { getFileExtension, getMimeTypeFromExtension, isAllowedAudio, shouldConvert } from "@/lib/audio";
import {
  getGeminiMissingKeyMessage,
  getServerEnv,
  MissingApiKeyError,
  requireGeminiApiKey,
} from "@/lib/env";
import { ensureTempDir } from "@/lib/temp-files";
import { runCommand } from "@/lib/run-command";
import { InvalidVideoSourceUrlError, validatePublicVideoUrl } from "@/lib/video/source-url";
import { runFfprobe } from "@/lib/video/tools";
import { getYtDlpBinary } from "@/lib/video/yt-dlp-binary";
import type { TranscriptionResponse } from "@/types/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ url: z.string().trim().min(1).max(2048) });
const deniedAvailability = new Set(["private", "needs_auth", "subscriber_only", "premium_only"]);

type DownloaderMetadata = {
  title?: string;
  duration?: number;
  availability?: string;
};

async function getMediaInfo(filePath: string) {
  const output = await runFfprobe([
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_type",
    "-of",
    "json",
    filePath,
  ]);
  const metadata = JSON.parse(output) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string }>;
  };
  const duration = Number(metadata.format?.duration);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Não foi possível confirmar a duração do áudio extraído. Verifique a instalação do FFprobe.");
  }

  return { duration, hasAudio: metadata.streams?.some((stream) => stream.codec_type === "audio") ?? false };
}

function errorResponse(error: string, status: number) {
  return NextResponse.json<TranscriptionResponse>({ ok: false, error }, { status });
}

async function runDownloader(args: string[], signal: AbortSignal, timeout: number) {
  const { stdout } = await runCommand(getYtDlpBinary(), args, {
    signal,
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

function getSafeTitle(title: string | undefined, sourceId: string) {
  const cleanTitle = (title ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim();
  return cleanTitle.slice(0, 100) || `Video-${sourceId}`;
}

function getDownloaderMessage(error: unknown) {
  const stderr = error && typeof error === "object" && "stderr" in error ? error.stderr : null;
  const raw = typeof stderr === "string" && stderr.trim()
    ? stderr
    : error instanceof Error ? error.message : "Erro ao acessar a plataforma.";
  if (/login|sign in|cookies|private|authentication|not available for registered/i.test(raw)) {
    return "O Instagram ou YouTube exigiu login ou restringiu este vídeo. Envie o arquivo MP4 para transcrever.";
  }
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const detail = lines.find((line) => /^(ERROR|FATAL|Traceback|\[PYI-)/i.test(line))
    ?? lines.filter((line) => !line.startsWith("Command failed:")).at(-1)
    ?? "O yt-dlp não conseguiu processar este link.";
  return `Não foi possível obter este vídeo. O link pode ter restrições ou a plataforma pode ter alterado a extração. Detalhe: ${detail.slice(0, 220)}`;
}

export async function POST(request: Request) {
  let workDir = "";

  try {
    const body = requestSchema.parse(await request.json());
    const source = validatePublicVideoUrl(body.url);
    const env = getServerEnv();

    requireGeminiApiKey();

    const tempRoot = await ensureTempDir();
    workDir = await fs.mkdtemp(path.join(tempRoot, "public-video-"));
    const outputTemplate = path.join(workDir, "source.%(ext)s");

    let metadata: DownloaderMetadata;
    try {
      const result = await runDownloader([
        "--dump-single-json",
        "--skip-download",
        "--no-playlist",
        "--no-warnings",
        "--quiet",
        "--ignore-config",
        source.url,
      ], request.signal, env.processTimeoutMs);
      metadata = JSON.parse(result) as DownloaderMetadata;
    } catch (error) {
      throw new Error(getDownloaderMessage(error));
    }

    if (metadata.availability && deniedAvailability.has(metadata.availability.toLowerCase())) {
      return errorResponse("Este vídeo não está disponível publicamente sem login.", 403);
    }

    const metadataDuration = Number(metadata.duration);
    if (Number.isFinite(metadataDuration) && metadataDuration > env.maxVideoDurationSec) {
      return errorResponse(
        `O vídeo excede o limite de ${Math.floor(env.maxVideoDurationSec / 60)} minutos configurado para links.`,
        413,
      );
    }

    try {
      await runDownloader([
        "--format", "bestaudio[ext=m4a]/bestaudio/best",
        "--max-filesize", `${env.maxVideoUploadMb}M`,
        // Instagram may omit duration from metadata; FFprobe enforces the limit after download.
        "--match-filters", `duration <=? ${env.maxVideoDurationSec}`,
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--no-part",
        "--no-continue",
        "--ignore-config",
        "--output", outputTemplate,
        source.url,
      ], request.signal, env.processTimeoutMs);
    } catch (error) {
      throw new Error(getDownloaderMessage(error));
    }

    const downloadedFiles = await fs.readdir(workDir);
    const downloadedName = downloadedFiles.find((name) => name.startsWith("source."));
    if (!downloadedName) {
      throw new Error("A plataforma não retornou uma faixa de áudio para este vídeo.");
    }

    const filePath = path.join(workDir, downloadedName);
    const fileStats = await fs.stat(filePath);
    if (fileStats.size > env.maxVideoUploadMb * 1024 * 1024) {
      return errorResponse(`O áudio extraído excede o limite de ${env.maxVideoUploadMb} MB.`, 413);
    }
    const { duration, hasAudio } = await getMediaInfo(filePath);
    if (duration > env.maxVideoDurationSec) {
      return errorResponse(
        `O vídeo excede o limite de ${Math.floor(env.maxVideoDurationSec / 60)} minutos configurado para links.`,
        413,
      );
    }
    if (!hasAudio) {
      return errorResponse("Este vídeo não contém uma faixa de áudio para transcrever.", 422);
    }

    const extension = getFileExtension(downloadedName);
    if (!isAllowedAudio(extension)) {
      throw new Error(`Formato de áudio extraído não suportado: .${extension || "desconhecido"}.`);
    }

    const originalName = `${getSafeTitle(metadata.title, source.id)}.${extension}`;
    const originalMime = getMimeTypeFromExtension(extension);
    const { transcribeAudioWithGemini } = await import("@/lib/gemini");
    let transcription = "";
    let converted = false;

    try {
      transcription = await transcribeAudioWithGemini({
        filePath,
        mimeType: originalMime,
        originalName,
      });
    } catch (error) {
      if (!shouldConvert(extension) || error instanceof MissingApiKeyError) {
        throw error;
      }

      const wavPath = await convertToWav(filePath);
      converted = true;
      transcription = await transcribeAudioWithGemini({
        filePath: wavPath,
        mimeType: "audio/wav",
        originalName: `${getSafeTitle(metadata.title, source.id)}.wav`,
      });
    }

    return NextResponse.json<TranscriptionResponse>({
      ok: true,
      transcription,
      meta: {
        originalFileName: `${getSafeTitle(metadata.title, source.id)}.mp4`,
        converted,
        model: env.geminiTranscribeModel,
        sourceUrl: source.url,
        sourcePlatform: source.platform,
        sourceSizeBytes: fileStats.size,
        durationSeconds: duration,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("Informe um link do Instagram ou YouTube.", 400);
    }
    if (error instanceof InvalidVideoSourceUrlError) {
      return errorResponse(error.message, 400);
    }
    if (error instanceof MissingApiKeyError) {
      return errorResponse(getGeminiMissingKeyMessage(), 500);
    }

    return errorResponse(
      error instanceof Error ? error.message : "Não foi possível transcrever este link.",
      502,
    );
  } finally {
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
