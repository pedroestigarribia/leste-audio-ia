import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { getServerEnv } from "@/lib/env";
import { generateClipCandidates, buildSemanticSegments } from "@/lib/video/curator";
import { getJobDir, fileExists } from "@/lib/video/paths";
import { extractAudioForVideo, probeVideo } from "@/lib/video/probe";
import { detectSceneChanges } from "@/lib/video/scenes";
import { withVideoLimit } from "@/lib/video/limits";
import { getStoredJob, isJobCancelled, setJobProgress, updateVideoJob, YOUTUBE_CUT_UPLOAD_REQUIRED } from "@/lib/video/job-store";
import { transcribeVideoStructured } from "@/lib/video/transcript";

async function checkCancelled(jobId: string, signal: AbortSignal) {
  if (await isJobCancelled(jobId, signal)) {
    throw new DOMException("Processamento cancelado.", "AbortError");
  }
}

export async function processVideoJob(jobId: string, signal: AbortSignal) {
  const initialJob = await getStoredJob(jobId);
  if (!initialJob) throw new Error("Job de vídeo não encontrado.");

  await fs.rm(path.join(getJobDir(jobId), "cancel.flag"), { force: true }).catch(() => undefined);
  const sourcePath = initialJob.sourcePath;
  let audioPath: string | undefined;

  try {
    await checkCancelled(jobId, signal);
    await setJobProgress(jobId, "validating", 3, "Validando a origem do vídeo...");

    if (!sourcePath || !(await fileExists(sourcePath))) {
      throw new Error(initialJob.sourceType === "youtube" ? YOUTUBE_CUT_UPLOAD_REQUIRED : "O arquivo de vídeo não está disponível para processamento.");
    }

    await checkCancelled(jobId, signal);
    await setJobProgress(jobId, "probing", 16, "Lendo duração, resolução e faixas do vídeo...");
    const latest = await getStoredJob(jobId);
    const probed = await probeVideo(sourcePath, initialJob.sourceType, {
      title: latest?.metadata?.title || initialJob.sourceName,
      channel: latest?.metadata?.channel,
      thumbnail: latest?.metadata?.thumbnail,
    });
    const env = getServerEnv();
    if (probed.durationSec > env.maxVideoDurationSec) {
      throw new Error(`O vídeo excede o limite de ${Math.round(env.maxVideoDurationSec / 60)} minutos.`);
    }
    if (probed.fileSize && probed.fileSize > env.maxVideoUploadMb * 1024 * 1024) {
      throw new Error(`O vídeo excede o limite de ${env.maxVideoUploadMb} MB.`);
    }
    await updateVideoJob(jobId, { metadata: probed, sourcePath });

    await checkCancelled(jobId, signal);
    await setJobProgress(jobId, "extracting_audio", 25, "Extraindo áudio mono em 16 kHz...");
    audioPath = path.join(getJobDir(jobId), "analysis-audio.wav");
    await extractAudioForVideo(sourcePath, audioPath, signal);

    await checkCancelled(jobId, signal);
    await setJobProgress(jobId, "transcribing", 38, "Transcrevendo com marcação temporal...");
    const transcript = await withVideoLimit("analysis", signal, () => transcribeVideoStructured({
      audioPath: audioPath as string,
      title: probed.title,
      durationSec: probed.durationSec,
    }));
    await setJobProgress(jobId, "analyzing_scenes", 53, "Detectando mudanças de cena...");
    const sceneMarkers = await detectSceneChanges(sourcePath, probed.durationSec, signal);
    const semanticSegments = buildSemanticSegments(transcript, sceneMarkers);
    await updateVideoJob(jobId, {
      transcript: {
        language: transcript.language,
        segments: transcript.segments,
        participants: transcript.participants,
      },
      semanticSegments,
      sceneMarkers,
    });

    await checkCancelled(jobId, signal);
    await setJobProgress(jobId, "analyzing_scenes", 57, "Relacionando fala, temas e cenas...");
    await setJobProgress(jobId, "analyzing_semantics", 63, "Identificando assuntos, ganchos e unidades de sentido...");
    const preferences = (await getStoredJob(jobId))?.preferences ?? {
      mode: "discover" as const,
      genre: "Auto",
      durationPreset: "30-60" as const,
      desiredCount: 8,
    };

    await setJobProgress(jobId, "generating_candidates", 72, "Gerando candidatos de cortes...");
    const candidates = await withVideoLimit("analysis", signal, () => generateClipCandidates({ metadata: probed, segments: semanticSegments, preferences }));
    await setJobProgress(jobId, "ranking_candidates", 88, "Pontuando retenção e removendo duplicidades...");
    await updateVideoJob(jobId, {
      sourcePath,
      candidates,
      preferences,
      stage: "ready_for_review",
      progress: 100,
      message: `${candidates.length} corte(s) sugerido(s) para revisão.`,
      error: undefined,
      pendingAction: undefined,
      pendingRender: undefined,
    });
  } finally {
    if (audioPath) await fs.rm(audioPath, { force: true }).catch(() => undefined);
  }
}
