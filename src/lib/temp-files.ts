import "server-only";

import { promises as fs } from "fs";
import path from "path";

import { nanoid } from "nanoid";

import { getFileExtension, getMimeTypeFromExtension } from "@/lib/audio";
import { getServerEnv } from "@/lib/env";

function getResolvedTempDir() {
  return path.resolve(process.cwd(), getServerEnv().tempUploadDir);
}

export function sanitizeFileName(name: string): string {
  const baseName = path.basename(name).normalize("NFKD");
  const sanitized = baseName.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
  return sanitized || "audio";
}

export async function ensureTempDir() {
  await fs.mkdir(getResolvedTempDir(), { recursive: true });
  return getResolvedTempDir();
}

export async function saveUploadedFileToTemp(file: File) {
  const tempDir = await ensureTempDir();
  const sanitizedOriginalName = sanitizeFileName(file.name);
  const extension = getFileExtension(sanitizedOriginalName);
  const fileName = `${nanoid()}-${sanitizedOriginalName || `audio.${extension || "bin"}`}`;
  const filePath = path.join(tempDir, fileName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, bytes);

  return {
    filePath,
    originalName: sanitizedOriginalName,
    mimeType: file.type || getMimeTypeFromExtension(extension),
    size: file.size,
    extension,
  };
}

export async function safeDeleteFile(filePath: string) {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;

    if (errorCode !== "ENOENT") {
      return;
    }
  }
}

export async function cleanupFiles(paths: string[]) {
  await Promise.all(paths.map((filePath) => safeDeleteFile(filePath)));
}
