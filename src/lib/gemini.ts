import "server-only";

import { readFile, stat } from "node:fs/promises";

import { GoogleGenAI } from "@google/genai";

import { TRANSCRIPTION_PROMPT } from "@/prompts/transcription";
import { MissingApiKeyError, getServerEnv, requireGeminiApiKey } from "@/lib/env";

type TranscribeAudioParams = {
  filePath: string;
  mimeType: string;
  originalName: string;
  mode?: "smart" | "verbatim";
};

const GEMINI_FILE_READY_TIMEOUT_MS = 120_000;
const GEMINI_FILE_READY_POLL_MS = 1_500;
// Inline data avoids a Files API permission issue present in some Google projects.
const GEMINI_INLINE_AUDIO_MAX_BYTES = 18 * 1024 * 1024;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getGeminiFileState(file: any): string {
  return String(file?.state ?? file?.file?.state ?? "").toUpperCase();
}

export async function waitForGeminiFileActive(client: any, uploadedFile: any): Promise<any> {
  if (!uploadedFile?.name || !client?.files?.get) {
    throw new Error("O Gemini não retornou um arquivo válido para transcrição.");
  }

  const deadline = Date.now() + GEMINI_FILE_READY_TIMEOUT_MS;
  let latestFile = uploadedFile;

  while (Date.now() < deadline) {
    const state = getGeminiFileState(latestFile);

    if (state === "ACTIVE") {
      return latestFile;
    }

    if (state === "FAILED") {
      const detail = latestFile?.error?.message;
      throw new Error(
        detail
          ? `O Gemini não conseguiu preparar o arquivo: ${detail}`
          : "O Gemini não conseguiu preparar o arquivo para transcrição.",
      );
    }

    await sleep(GEMINI_FILE_READY_POLL_MS);
    latestFile = await client.files.get({ name: uploadedFile.name });
  }

  throw new Error("O Gemini demorou demais para preparar o arquivo. Tente novamente.");
}

function getGeminiErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "Erro desconhecido.";

  if (/not in an ACTIVE state|FAILED_PRECONDITION/i.test(rawMessage)) {
    return "O Gemini ainda não terminou de preparar o arquivo. Tente novamente em alguns instantes.";
  }

  if (/model.*not found|not found.*model|404/i.test(rawMessage)) {
    return "O modelo configurado no Gemini não está disponível para esta chave. Revise GEMINI_MODEL no arquivo .env.local.";
  }

  if (/429|quota|resource exhausted/i.test(rawMessage)) {
    return "O limite temporario da API Gemini foi atingido. Aguarde alguns minutos e tente novamente.";
  }

  if (/403|permission denied|permission_denied/i.test(rawMessage)) {
    return "A chave do Gemini foi recusada pelo projeto Google. Crie ou libere uma chave com acesso à Gemini API no Google AI Studio e confirme que ela não possui restrição de site, IP ou API incompatível com este app.";
  }

  return rawMessage;
}

function isGeminiPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /403|permission denied|permission_denied/i.test(message);
}

function extractTextFromGeminiResponse(response: any): string {
  if (!response) {
    return "";
  }

  if (typeof response.text === "string") {
    return response.text;
  }

  if (typeof response.text === "function") {
    return response.text();
  }

  const parts = response.candidates?.flatMap((candidate: any) => candidate.content?.parts ?? []) ?? [];

  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractTextFromGeminiInteraction(interaction: any): string {
  if (typeof interaction?.outputText === "string" && interaction.outputText.trim()) {
    return interaction.outputText.trim();
  }

  if (typeof interaction?.output_text === "string" && interaction.output_text.trim()) {
    return interaction.output_text.trim();
  }

  const outputs = interaction?.outputs ?? [];
  return outputs
    .map((output: any) => (typeof output?.text === "string" ? output.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function deleteGeminiRemoteFile(client: any, uploadedFile: any) {
  if (!uploadedFile?.name || !client?.files?.delete) {
    return;
  }

  try {
    await client.files.delete({ name: uploadedFile.name });
  } catch {
    try {
      await client.files.delete(uploadedFile.name);
    } catch {
      return;
    }
  }
}

function shouldFallbackToLegacyTranscription(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /model.*not found|not found.*model|unknown parameter|unsupported.*model|404/i.test(message);
}

async function transcribeWithDedicatedModel(
  client: any,
  params: TranscribeAudioParams,
  fileUri: string,
  mimeType: string,
): Promise<string> {
  const env = getServerEnv();

  if (!client?.interactions?.create) {
    throw new Error("A versão instalada de @google/genai não expõe a Interactions API.");
  }

  const interaction = await client.interactions.create({
    model: env.geminiTranscribeModel,
    // Do not retain audio or transcript state in Gemini's Interactions API.
    store: false,
    input: [
      {
        type: "audio",
        uri: fileUri,
        mime_type: mimeType,
      },
    ],
    generation_config: {
      transcription_config: {
        language_codes: ["pt-BR"],
        mode: params.mode ?? "smart",
      },
    },
  });

  const text = extractTextFromGeminiInteraction(interaction);

  if (!text) {
    throw new Error("O Gemini não retornou texto para a transcrição.");
  }

  return text;
}

async function transcribeWithInlineAudio(
  client: any,
  params: TranscribeAudioParams,
  model: string,
): Promise<string> {
  const fileStats = await stat(params.filePath);

  if (fileStats.size > GEMINI_INLINE_AUDIO_MAX_BYTES) {
    throw new Error(
      "O projeto Google recusou o uso de arquivos remotos e este áudio é grande demais para o modo alternativo. Libere a Files API no Google AI Studio ou envie um arquivo de até 18 MB.",
    );
  }

  const audioBase64 = (await readFile(params.filePath)).toString("base64");
  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: TRANSCRIPTION_PROMPT },
          {
            inlineData: {
              mimeType: params.mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ],
  });

  const text = extractTextFromGeminiResponse(response);

  if (!text) {
    throw new Error("O Gemini não retornou texto para a transcrição.");
  }

  return text.trim();
}

export async function transcribeAudioWithGemini(params: TranscribeAudioParams): Promise<string> {
  const env = getServerEnv();
  const apiKey = requireGeminiApiKey();
  const client = new GoogleGenAI({ apiKey }) as any;

  let uploadedFile: any = null;

  try {
    if (!client?.files?.upload) {
      throw new Error("A versão instalada de @google/genai não expõe a Files API.");
    }

    uploadedFile = await client.files.upload({
      file: params.filePath,
      config: {
        mimeType: params.mimeType,
        displayName: params.originalName,
      },
    });

    const activeFile = await waitForGeminiFileActive(client, uploadedFile);
    const fileUri = activeFile?.uri ?? activeFile?.file?.uri;
    const uploadedMimeType =
      activeFile?.mimeType ?? activeFile?.mime_type ?? params.mimeType;

    if (!fileUri) {
      throw new Error("O upload para o Gemini não retornou a URI do arquivo.");
    }

    try {
      return await transcribeWithDedicatedModel(client, params, fileUri, uploadedMimeType);
    } catch (interactionError) {
      if (!shouldFallbackToLegacyTranscription(interactionError)) {
        throw interactionError;
      }

      const response = await client.models.generateContent({
        model: env.geminiModel,
        contents: [
          {
            role: "user",
            parts: [
              { text: TRANSCRIPTION_PROMPT },
              {
                fileData: {
                  fileUri,
                  mimeType: uploadedMimeType,
                },
              },
            ],
          },
        ],
      });

      const text = extractTextFromGeminiResponse(response);

      if (!text) {
        throw new Error("O Gemini não retornou texto para a transcrição.");
      }

      return text.trim();
    }
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      throw error;
    }

    if (isGeminiPermissionError(error)) {
      try {
        return await transcribeWithInlineAudio(client, params, env.geminiModel);
      } catch (inlineError) {
        throw new Error(`Falha ao transcrever com Gemini. ${getGeminiErrorMessage(inlineError)}`);
      }
    }

    throw new Error(`Falha ao transcrever com Gemini. ${getGeminiErrorMessage(error)}`);
  } finally {
    await deleteGeminiRemoteFile(client, uploadedFile);
  }
}
