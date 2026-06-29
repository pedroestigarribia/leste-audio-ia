import "server-only";

import { MissingApiKeyError, getServerEnv, requireGeminiApiKey } from "@/lib/env";

type GeminiSpeechResult = {
  audio: Buffer;
  contentType: string;
};

function buildWavHeader(dataLength: number, sampleRate: number) {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

function getSampleRate(mimeType: string) {
  const match = /rate=(\d+)/i.exec(mimeType);
  return match ? Number.parseInt(match[1], 10) : 24000;
}

function extractInlineAudio(response: any) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    const inlineData = part?.inlineData ?? part?.inline_data;
    const data = inlineData?.data;

    if (typeof data === "string" && data.trim()) {
      return {
        data,
        mimeType: inlineData?.mimeType ?? inlineData?.mime_type ?? "audio/L16;codec=pcm;rate=24000",
      };
    }
  }

  return null;
}

export async function synthesizeSpeechWithGemini(text: string): Promise<GeminiSpeechResult> {
  const env = getServerEnv();
  const apiKey = requireGeminiApiKey();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.geminiTtsModel,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: env.geminiTtsVoice,
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const payload = await response.json();
    const inlineAudio = extractInlineAudio(payload);

    if (!inlineAudio) {
      throw new Error("O Gemini nao retornou audio para leitura.");
    }

    const audioBuffer = Buffer.from(inlineAudio.data, "base64");

    if (inlineAudio.mimeType.toLowerCase().includes("audio/l16")) {
      return {
        audio: Buffer.concat([buildWavHeader(audioBuffer.length, getSampleRate(inlineAudio.mimeType)), audioBuffer]),
        contentType: "audio/wav",
      };
    }

    return {
      audio: audioBuffer,
      contentType: inlineAudio.mimeType,
    };
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    throw new Error(`Falha ao gerar voz com Gemini. ${message}`);
  }
}
