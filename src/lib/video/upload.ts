import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { nanoid } from "nanoid";

import { ensureJobDir } from "@/lib/video/paths";
import { sanitizeFileName } from "@/lib/temp-files";

export const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v"]);

export function getVideoExtension(name: string) {
  return path.extname(name).slice(1).toLowerCase();
}

export function isAllowedVideo(name: string, type?: string) {
  const extension = getVideoExtension(name);
  if (!VIDEO_EXTENSIONS.has(extension)) {
    return false;
  }

  return !type || type.startsWith("video/") || type === "application/octet-stream";
}

export async function saveVideoUpload(jobId: string, file: File) {
  const extension = getVideoExtension(file.name);
  const jobDir = await ensureJobDir(jobId);
  const sourcePath = path.join(jobDir, `source-${nanoid(10)}.${extension}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(sourcePath, bytes, { flag: "wx" });
  return sourcePath;
}

function getMultipartBoundary(contentType: string) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return (match?.[1] || match?.[2] || "").trim();
}

function getPartHeaders(rawHeaders: Buffer) {
  const headers = new Map<string, string>();
  for (const line of rawHeaders.toString("latin1").split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator > 0) headers.set(line.slice(0, separator).toLowerCase(), line.slice(separator + 1).trim());
  }
  return headers;
}

function getPartName(disposition: string | undefined, attribute: "name" | "filename") {
  if (!disposition) return "";
  const match = disposition.match(new RegExp(`${attribute}="([^"]*)"`, "i"));
  return match?.[1] || "";
}

export async function saveVideoUploadFromMultipart(request: Request, jobId: string, maxBytes: number) {
  const boundaryText = getMultipartBoundary(request.headers.get("content-type") || "");
  if (!boundaryText || boundaryText.length > 200) {
    throw new Error("O upload multipart não contém um boundary válido.");
  }
  if (!request.body) throw new Error("O corpo do upload não está disponível.");

  const jobDir = await ensureJobDir(jobId);
  const boundary = Buffer.from(`--${boundaryText}`);
  const nextBoundary = Buffer.from(`\r\n--${boundaryText}`);
  const reader = request.body.getReader();
  let buffer = Buffer.alloc(0);
  let phase: "boundary" | "headers" | "body" = "boundary";
  let fileHandle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let sourcePath = "";
  let originalName = "";
  let mimeType = "";
  let fileSize = 0;
  let currentPart = "";
  let fieldValue = "";
  let preferencesValue: string | undefined;
  let completed = false;

  async function writeFileChunk(chunk: Buffer) {
    if (!fileHandle || !chunk.length) return;
    fileSize += chunk.length;
    if (fileSize > maxBytes) {
      throw new Error(`O arquivo excede o limite de ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
    }
    await fileHandle.write(chunk);
  }

  async function closePart() {
    if (fileHandle) {
      await fileHandle.close();
      fileHandle = undefined;
    }
    if (currentPart === "preferences" && fieldValue.length <= 100_000) preferencesValue = fieldValue;
    fieldValue = "";
  }

  async function consumeBodyChunk(chunk: Buffer) {
    if (fileHandle) await writeFileChunk(chunk);
    else if (currentPart === "preferences" && fieldValue.length < 100_000) fieldValue += chunk.toString("utf8");
  }

  try {
    while (!completed) {
      const next = await reader.read();
      if (next.done) {
        throw new Error("O upload multipart terminou antes do arquivo ser recebido.");
      }
      buffer = Buffer.concat([buffer, Buffer.from(next.value)]);

      let progressed = true;
      while (progressed && !completed) {
        progressed = false;
        if (phase === "boundary") {
          if (buffer.length < boundary.length + 2 || !buffer.subarray(0, boundary.length).equals(boundary)) {
            const boundaryStart = buffer.indexOf(boundary);
            if (boundaryStart < 0) {
              buffer = buffer.subarray(Math.max(0, buffer.length - boundary.length));
              break;
            }
            buffer = buffer.subarray(boundaryStart);
          }
          if (buffer.length < boundary.length + 2) break;
          if (buffer.subarray(boundary.length, boundary.length + 2).toString() === "--") {
            completed = true;
            break;
          }
          if (buffer.subarray(boundary.length, boundary.length + 2).toString() !== "\r\n") {
            throw new Error("O formato multipart recebido é inválido.");
          }
          buffer = buffer.subarray(boundary.length + 2);
          phase = "headers";
          progressed = true;
        }

        if (phase === "headers") {
          const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"));
          if (headerEnd < 0) break;
          const headers = getPartHeaders(buffer.subarray(0, headerEnd));
          const disposition = headers.get("content-disposition");
          currentPart = getPartName(disposition, "name");
          const filename = getPartName(disposition, "filename");
          if (filename) {
            if (!isAllowedVideo(filename, headers.get("content-type") || undefined)) {
              throw new Error("Formato não aceito. Use MP4, MOV, WEBM ou M4V.");
            }
            originalName = sanitizeFileName(filename);
            mimeType = headers.get("content-type") || "video/mp4";
            const extension = getVideoExtension(originalName);
            sourcePath = path.join(jobDir, `source-${nanoid(10)}.${extension}`);
            fileHandle = await fs.open(sourcePath, "wx");
          }
          buffer = buffer.subarray(headerEnd + 4);
          phase = "body";
          progressed = true;
        }

        if (phase === "body") {
          const boundaryIndex = buffer.indexOf(nextBoundary);
          if (boundaryIndex < 0) {
            const safeLength = Math.max(0, buffer.length - nextBoundary.length);
            if (safeLength) {
              await consumeBodyChunk(buffer.subarray(0, safeLength));
              buffer = buffer.subarray(safeLength);
              progressed = true;
            }
            break;
          }
          await consumeBodyChunk(buffer.subarray(0, boundaryIndex));
          buffer = buffer.subarray(boundaryIndex + 2);
          await closePart();
          phase = "boundary";
          progressed = true;
        }
      }
    }

    await closePart();
    if (!sourcePath || !originalName || fileSize <= 0) throw new Error("Nenhum arquivo de vídeo foi recebido.");
    return { sourcePath, originalName, mimeType, size: fileSize, preferences: preferencesValue };
  } catch (error) {
    await fileHandle?.close().catch(() => undefined);
    await fs.rm(sourcePath, { force: true }).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
