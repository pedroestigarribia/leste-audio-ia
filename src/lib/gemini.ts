import "server-only";

import { GoogleGenAI } from "@google/genai";

import { TRANSCRIPTION_PROMPT } from "@/prompts/transcription";
import { MissingApiKeyError, getServerEnv, requireGeminiApiKey } from "@/lib/env";

type TranscribeAudioParams = {
  filePath: string;
  mimeType: string;
  originalName: string;
};

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

async function deleteGeminiRemoteFile(client: any, uploadedFile: any) {
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

export async function transcribeAudioWithGemini(params: TranscribeAudioParams): Promise<string> {
  const env = getServerEnv();
  const apiKey = requireGeminiApiKey();
  const client = new GoogleGenAI({ apiKey }) as any;

  let uploadedFile: any = null;

  try {
    if (!client?.files?.upload) {
      throw new Error("A versao instalada de @google/genai nao expoe a Files API.");
    }

    uploadedFile = await client.files.upload({
      file: params.filePath,
      config: {
        mimeType: params.mimeType,
        displayName: params.originalName,
      },
    });

    const fileUri = uploadedFile?.uri ?? uploadedFile?.file?.uri;
    const uploadedMimeType =
      uploadedFile?.mimeType ?? uploadedFile?.mime_type ?? params.mimeType;

    if (!fileUri) {
      throw new Error("O upload para o Gemini nao retornou a URI do arquivo.");
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
      throw new Error("O Gemini nao retornou texto para a transcricao.");
    }

    return text.trim();
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    throw new Error(`Falha ao transcrever com Gemini. ${message}`);
  } finally {
    await deleteGeminiRemoteFile(client, uploadedFile);
  }
}
