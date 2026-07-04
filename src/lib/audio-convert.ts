import "server-only";

import { existsSync, promises as fs } from "fs";
import path from "path";

import { Mp3Encoder } from "@breezystack/lamejs";
import { execa } from "execa";
import ffmpegStatic from "ffmpeg-static";

async function runFfmpeg(binaryPath: string, args: string[]) {
  await execa(binaryPath, args, {
    windowsHide: true,
  });
}

function getStaticFfmpegCandidates() {
  const executableName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const candidates = [
    process.env.FFMPEG_BIN,
    ffmpegStatic || undefined,
    path.join(process.cwd(), "node_modules", "ffmpeg-static", executableName),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return Array.from(new Set(candidates));
}

async function runFfmpegWithFallback(args: string[]) {
  const failures: string[] = [];

  for (const candidate of getStaticFfmpegCandidates()) {
    if (!existsSync(candidate)) {
      failures.push(`FFmpeg nao encontrado em ${candidate}.`);
      continue;
    }

    try {
      await runFfmpeg(candidate, args);
      return;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Falha no ffmpeg-static.");
    }
  }

  try {
    await runFfmpeg("ffmpeg", args);
    return;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "Falha no FFmpeg do sistema.");
  }

  throw new Error(
    `Nao foi possivel executar o FFmpeg. Verifique ffmpeg-static, FFMPEG_BIN ou a instalacao do FFmpeg no sistema. ${failures.join(" | ")}`.trim(),
  );
}

export async function convertToWav(inputPath: string): Promise<string> {
  const inputFilePath = path.resolve(inputPath);
  const parsedPath = path.parse(inputFilePath);
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}-converted.wav`);
  const args = ["-y", "-i", inputFilePath, "-ac", "1", "-ar", "16000", outputPath];

  await runFfmpegWithFallback(args);
  return outputPath;
}

export async function convertWavBufferToMp3(input: Buffer): Promise<Buffer> {
  return convertWavBuffersToMp3([input]);
}

function readWavMetadata(input: Buffer) {
  if (input.length < 44 || input.toString("ascii", 0, 4) !== "RIFF" || input.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Audio WAV invalido para conversao em MP3.");
  }

  const sampleRate = input.readUInt32LE(24);
  const channels = input.readUInt16LE(22);
  const bitsPerSample = input.readUInt16LE(34);
  const dataIndex = input.indexOf(Buffer.from("data"));

  if (dataIndex === -1 || dataIndex + 8 > input.length) {
    throw new Error("Audio WAV sem bloco de dados.");
  }

  const dataStart = dataIndex + 8;
  const dataLength = input.readUInt32LE(dataIndex + 4);
  const dataEnd = Math.min(dataStart + dataLength, input.length);

  return {
    bitsPerSample,
    channels,
    data: input.subarray(dataStart, dataEnd),
    sampleRate,
  };
}

function buildWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number) {
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

export async function convertWavBuffersToMp3(inputs: Buffer[]): Promise<Buffer> {
  if (!inputs.length) {
    throw new Error("Nenhum audio gerado para conversao em MP3.");
  }

  const wavParts = inputs.map(readWavMetadata);
  const firstPart = wavParts[0];
  const hasSameFormat = wavParts.every(
    (part) =>
      part.sampleRate === firstPart.sampleRate &&
      part.channels === firstPart.channels &&
      part.bitsPerSample === firstPart.bitsPerSample,
  );

  if (!hasSameFormat) {
    throw new Error("Os blocos de voz retornaram formatos WAV diferentes.");
  }

  const data = Buffer.concat(wavParts.map((part) => part.data));
  const wav = Buffer.concat([buildWavHeader(data.length, firstPart.sampleRate, firstPart.channels, firstPart.bitsPerSample), data]);

  return encodeWavToMp3(wav);
}

function encodeWavToMp3(input: Buffer) {
  const wav = readWavMetadata(input);

  if (wav.bitsPerSample !== 16) {
    throw new Error("A conversao direta para MP3 suporta apenas WAV PCM 16-bit.");
  }

  const samples = new Int16Array(wav.data.buffer, wav.data.byteOffset, Math.floor(wav.data.byteLength / 2));
  const encoder = new Mp3Encoder(wav.channels, wav.sampleRate, 128);
  const mp3Chunks: Buffer[] = [];
  const blockSize = 1152;

  for (let offset = 0; offset < samples.length; offset += blockSize * wav.channels) {
    if (wav.channels === 1) {
      const left = samples.subarray(offset, Math.min(offset + blockSize, samples.length));
      const chunk = encoder.encodeBuffer(left);

      if (chunk.length) {
        mp3Chunks.push(Buffer.from(chunk));
      }

      continue;
    }

    const frame = samples.subarray(offset, Math.min(offset + blockSize * wav.channels, samples.length));
    const sampleCount = Math.floor(frame.length / wav.channels);
    const left = new Int16Array(sampleCount);
    const right = new Int16Array(sampleCount);

    for (let index = 0; index < sampleCount; index += 1) {
      left[index] = frame[index * wav.channels];
      right[index] = frame[index * wav.channels + 1] ?? frame[index * wav.channels];
    }

    const chunk = encoder.encodeBuffer(left, right);

    if (chunk.length) {
      mp3Chunks.push(Buffer.from(chunk));
    }
  }

  const finalChunk = encoder.flush();

  if (finalChunk.length) {
    mp3Chunks.push(Buffer.from(finalChunk));
  }

  return Buffer.concat(mp3Chunks);
}
