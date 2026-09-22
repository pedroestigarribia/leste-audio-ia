import { z } from "zod";

import { cleanupFiles } from "@/lib/temp-files";
import { extractYoutubeVideoId, fetchYoutubeOEmbed, buildYoutubeThumbnail } from "@/lib/youtube";
import { normalizePlainText } from "@/lib/plain-text";
import { runTextTask } from "@/lib/text-ai";
import { buildYoutubeAnalysisPrompt } from "@/prompts/youtubeAnalysis";
import type {
  YoutubeAnalysisState,
  YoutubeDeepSeekResult,
  YoutubeGeminiResult,
  YoutubeProgressEvent,
  YoutubeSegment,
  YoutubeVideoInfo,
} from "@/types/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const analyzeSchema = z.object({
  url: z.string().trim().min(1, "Envie um link do YouTube."),
  cutStart: z.number().min(0).nullable().default(null),
  cutEnd: z.number().min(0).nullable().default(null),
});

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
}

function parseDeepSeekSections(text: string): YoutubeDeepSeekResult {
  const markers = [
    "===TRANSCRICAO_REVISADA===",
    "===RESUMO===",
    "===INTERPRETACAO===",
    "===ASSUNTOS===",
    "===FRASES_IMPORTANTES===",
    "===ESTILO_LINGUAGEM===",
    "===PERFIL_COMUNICACAO===",
    "===CONTEUDO_GERADO===",
  ] as const;

  const sections: Record<string, string> = {};

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const startIdx = text.indexOf(marker);

    if (startIdx === -1) {
      sections[marker] = "";
      continue;
    }

    const contentStart = startIdx + marker.length;
    const nextMarker = markers[i + 1];
    const endIdx = nextMarker ? text.indexOf(nextMarker, contentStart) : text.length;
    const content = endIdx === -1 ? text.slice(contentStart) : text.slice(contentStart, endIdx);

    sections[marker] = normalizePlainText(content);
  }

  return {
    revisedTranscription: sections["===TRANSCRICAO_REVISADA==="] || "",
    summary: sections["===RESUMO==="] || "",
    interpretation: sections["===INTERPRETACAO==="] || "",
    topics: sections["===ASSUNTOS==="] || "",
    keyPhrases: sections["===FRASES_IMPORTANTES==="] || "",
    styleAnalysis: sections["===ESTILO_LINGUAGEM==="] || "",
    communicationProfile: sections["===PERFIL_COMUNICACAO==="] || "",
    generatedContent: sections["===CONTEUDO_GERADO==="] || "",
  };
}

function applyCutOffset(gemini: YoutubeGeminiResult, cutStart: number): YoutubeGeminiResult {
  if (!cutStart || cutStart <= 0) {
    return gemini;
  }

  return {
    ...gemini,
    segments: gemini.segments.map((seg) => ({
      ...seg,
      startTime: seg.startTime + cutStart,
      endTime: seg.endTime + cutStart,
    })),
  };
}

function buildTranscriptForDisplay(segments: YoutubeSegment[]): string {
  return segments
    .map((seg) => {
      return `[${formatClock(seg.startTime)} - ${formatClock(seg.endTime)}]

${seg.participant}:
${seg.text}

Tonalidade:
${seg.tone}`;
    })
    .join("\n\n");
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const filesToCleanup: string[] = [];

  function send(event: YoutubeProgressEvent) {
    return encoder.encode(JSON.stringify(event) + "\n");
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const rawBody = await request.json();
        const parsed = analyzeSchema.safeParse(rawBody);

        if (!parsed.success) {
          controller.enqueue(
            send({
              step: "error",
              status: "done",
              message: parsed.error.issues[0]?.message ?? "Corpo inválido.",
            }),
          );
          controller.close();
          return;
        }

        const { url, cutStart, cutEnd } = parsed.data;

        controller.enqueue(
          send({ step: "validate", status: "done", message: "Link validado." }),
        );

        const videoId = extractYoutubeVideoId(url);

        if (!videoId) {
          controller.enqueue(
            send({
              step: "error",
              status: "done",
              message: "Link do YouTube inválido.",
            }),
          );
          controller.close();
          return;
        }

        let video: YoutubeVideoInfo;
        let downloadInfo: Awaited<ReturnType<typeof import("@/lib/youtube-download")["getYoutubeDownloadInfo"]>>;

        try {
          const { getYoutubeDownloadInfo } = await import("@/lib/youtube-download");
          downloadInfo = await getYoutubeDownloadInfo(videoId);

          let oEmbedTitle = downloadInfo.title;
          let oEmbedChannel = downloadInfo.channel;
          let oEmbedThumbnail = "";

          try {
            const oembed = await fetchYoutubeOEmbed(videoId);
            oEmbedTitle = oembed.title || oEmbedTitle;
            oEmbedChannel = oembed.author_name || oEmbedChannel;
            oEmbedThumbnail = oembed.thumbnail_url;
          } catch {
            oEmbedThumbnail = buildYoutubeThumbnail(videoId);
          }

          video = {
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: oEmbedTitle,
            channel: oEmbedChannel,
            thumbnail: oEmbedThumbnail || buildYoutubeThumbnail(videoId),
            duration: downloadInfo.duration,
          };
        } catch (error) {
          controller.enqueue(
            send({
              step: "error",
              status: "done",
              message:
                error instanceof Error
                  ? error.message
                  : "Não foi possível obter informações do vídeo.",
            }),
          );
          controller.close();
          return;
        }

        if (cutStart !== null && cutEnd !== null && cutEnd <= cutStart) {
          controller.enqueue(
            send({
              step: "error",
              status: "done",
              message: "O minuto final deve ser maior que o minuto inicial.",
            }),
          );
          controller.close();
          return;
        }

        if (
          video.duration > 0 &&
          cutEnd !== null &&
          cutEnd > video.duration
        ) {
          controller.enqueue(
            send({
              step: "error",
              status: "done",
              message: `O minuto final excede a duração do vídeo (${formatClock(video.duration)}).`,
            }),
          );
          controller.close();
          return;
        }

        controller.enqueue(send({ step: "info", status: "done", video }));

        const { downloadAndCutSegment } = await import("@/lib/youtube-download");

        const segmentFiles = await downloadAndCutSegment(
          downloadInfo,
          cutStart,
          cutEnd,
          (message, progress) => {
            controller.enqueue(
              send({
                step: "download",
                status: "in_progress",
                message,
                progress,
              }),
            );
          },
        );

        filesToCleanup.push(segmentFiles.audioPath);

        if (segmentFiles.videoPath) {
          filesToCleanup.push(segmentFiles.videoPath);
        }

        controller.enqueue(
          send({ step: "download", status: "done", message: "Trecho processado." }),
        );

        controller.enqueue(
          send({
            step: "gemini",
            status: "in_progress",
            message: "Enviando ao Gemini para transcrição e análise...",
          }),
        );

        const { analyzeYoutubeWithGemini } = await import("@/lib/gemini-video");

        const geminiResult = await analyzeYoutubeWithGemini({
          audioPath: segmentFiles.audioPath,
          audioMimeType: "audio/wav",
          videoPath: segmentFiles.videoPath,
          videoMimeType: "video/mp4",
          title: video.title,
          channel: video.channel,
          cutStart,
          cutEnd,
        });

        const adjustedGemini = applyCutOffset(geminiResult, cutStart ?? 0);

        controller.enqueue(
          send({ step: "gemini", status: "done", message: "Análise do Gemini concluída." }),
        );

        controller.enqueue(
          send({
            step: "deepseek",
            status: "in_progress",
            message: "Enviando ao DeepSeek para revisão e interpretação...",
          }),
        );

        const deepSeekPrompt = buildYoutubeAnalysisPrompt({
          title: video.title,
          channel: video.channel,
          segments: adjustedGemini.segments,
          language: adjustedGemini.language,
          sceneNotes: adjustedGemini.sceneNotes,
        });

        const deepSeekRaw = await runTextTask({
          system:
            "Você analisa transcrições estruturadas de vídeos em português brasileiro. Não inventa fatos. Não afirma emoções como fato. Descreve apenas características observáveis. Não expõe raciocínio oculto.",
          prompt: deepSeekPrompt,
          temperature: 0.2,
        });

        const deepSeekResult = parseDeepSeekSections(deepSeekRaw);

        controller.enqueue(
          send({ step: "deepseek", status: "done", message: "Análise do DeepSeek concluída." }),
        );

        const result: YoutubeAnalysisState = {
          video,
          cutStart,
          cutEnd,
          gemini: adjustedGemini,
          deepseek: deepSeekResult,
          processedAt: new Date().toISOString(),
        };

        controller.enqueue(send({ step: "complete", status: "done", result }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao processar o vídeo.";

        controller.enqueue(
          send({ step: "error", status: "done", message }),
        );
      } finally {
        await cleanupFiles(filesToCleanup);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
