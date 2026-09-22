import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { nanoid } from "nanoid";

import { getJobDir } from "@/lib/video/paths";
import { getJobOutputTtlDate, getStoredJob, setJobProgress, updateVideoJob } from "@/lib/video/job-store";
import { renderVideoClip, writeSrt } from "@/lib/video/render";
import { withVideoLimit } from "@/lib/video/limits";
import { sanitizeFileName } from "@/lib/temp-files";
import type { ClipCandidate, RenderOptions } from "@/types/video";

export type ClipSelection = {
  candidateId: string;
  startTime?: number;
  endTime?: number;
};

function clampTime(value: number | undefined, fallback: number, durationSec: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(durationSec, value));
}

function getEditedCandidate(candidate: ClipCandidate, selection: ClipSelection, durationSec: number) {
  const startTime = clampTime(selection.startTime, candidate.startTime, durationSec);
  const endTime = clampTime(selection.endTime, candidate.endTime, durationSec);
  if (endTime <= startTime || endTime - startTime < 1) {
    throw new Error(`O intervalo escolhido para "${candidate.title}" é inválido.`);
  }
  return { ...candidate, startTime, endTime, duration: endTime - startTime };
}

export async function renderSelectedVideoClips(
  jobId: string,
  selections: ClipSelection[],
  options: RenderOptions,
  signal: AbortSignal,
) {
  const job = await getStoredJob(jobId);
  if (!job) throw new Error("Job de vídeo não encontrado.");
  if (!job.sourcePath || !job.metadata || !job.transcript) {
    throw new Error("A análise do vídeo ainda não foi concluída.");
  }
  if (!selections.length) throw new Error("Selecione pelo menos um corte para gerar.");

  const outputDir = path.join(getJobDir(jobId), "output");
  await fs.mkdir(outputDir, { recursive: true });
  const outputs = [...job.outputs];
  const expiresAt = getJobOutputTtlDate().toISOString();

  await setJobProgress(jobId, "rendering", 4, `Gerando ${selections.length} corte(s)...`);

  for (let index = 0; index < selections.length; index += 1) {
    if (signal.aborted) throw new DOMException("Processamento cancelado.", "AbortError");
    const selection = selections[index];
    const candidate = job.candidates.find((item) => item.id === selection.candidateId);
    if (!candidate) throw new Error("Um dos cortes selecionados não foi encontrado.");

    const edited = getEditedCandidate(candidate, selection, job.metadata.durationSec);
    const outputId = `output-${nanoid(10)}`;
    const baseName = sanitizeFileName(edited.title).slice(0, 60) || "corte";
    const fileName = `${baseName}-${outputId}.mp4`;
    const srtFileName = `${baseName}-${outputId}.srt`;
    const filePath = path.join(outputDir, fileName);
    const srtPath = path.join(outputDir, srtFileName);

    try {
      await writeSrt(job.transcript.segments, edited, srtPath);
      await withVideoLimit("render", signal, () => renderVideoClip({ sourcePath: job.sourcePath as string, outputPath: filePath, srtPath, candidate: edited, options }));
      outputs.push({
        id: outputId,
        candidateId: edited.id,
        title: edited.title,
        fileName,
        srtFileName,
        filePath,
        srtPath,
        downloadUrl: `/api/cuts/jobs/${jobId}/outputs/${outputId}`,
        srtDownloadUrl: `/api/cuts/jobs/${jobId}/outputs/${outputId}?format=srt`,
        createdAt: new Date().toISOString(),
        expiresAt,
      });
    } catch (error) {
      await fs.rm(filePath, { force: true }).catch(() => undefined);
      await fs.rm(srtPath, { force: true }).catch(() => undefined);
      throw new Error(`Falha ao gerar "${edited.title}": ${error instanceof Error ? error.message : "erro no FFmpeg"}`);
    }

    await updateVideoJob(jobId, {
      outputs,
      stage: "rendering",
      progress: Math.round(8 + ((index + 1) / selections.length) * 88),
      message: `${index + 1} de ${selections.length} corte(s) gerado(s).`,
    });
  }

  return updateVideoJob(jobId, {
    outputs,
    stage: "completed",
    progress: 100,
    message: `${outputs.length} corte(s) disponível(is) para assistir e baixar.`,
  });
}
