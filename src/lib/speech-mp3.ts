import "server-only";

import { Mp3Encoder } from "@breezystack/lamejs";

type WavMetadata = {
  bitsPerSample: number;
  channels: number;
  data: Buffer;
  sampleRate: number;
};

function readWavMetadata(input: Buffer): WavMetadata {
  if (
    input.length < 44 ||
    input.toString("ascii", 0, 4) !== "RIFF" ||
    input.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("Áudio WAV inválido para conversão em MP3.");
  }

  const sampleRate = input.readUInt32LE(24);
  const channels = input.readUInt16LE(22);
  const bitsPerSample = input.readUInt16LE(34);
  const dataIndex = input.indexOf(Buffer.from("data"));

  if (dataIndex === -1 || dataIndex + 8 > input.length) {
    throw new Error("Áudio WAV sem bloco de dados.");
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

function encodeWavToMp3(input: Buffer) {
  const wav = readWavMetadata(input);

  if (wav.bitsPerSample !== 16) {
    throw new Error("A conversao direta para MP3 suporta apenas WAV PCM 16-bit.");
  }

  const samples = new Int16Array(
    wav.data.buffer,
    wav.data.byteOffset,
    Math.floor(wav.data.byteLength / 2),
  );
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

export function encodeWavBuffersToMp3(inputs: Buffer[]): Buffer {
  if (!inputs.length) {
    throw new Error("Nenhum áudio gerado para conversão em MP3.");
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
  const wav = Buffer.concat([
    buildWavHeader(data.length, firstPart.sampleRate, firstPart.channels, firstPart.bitsPerSample),
    data,
  ]);

  return encodeWavToMp3(wav);
}
