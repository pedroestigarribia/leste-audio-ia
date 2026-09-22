import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { nanoid } from "nanoid";

const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{12,32}$/;

export function getCutsRoot() {
  return path.resolve(process.cwd(), "tmp", "cuts");
}

export function assertSafeJobId(jobId: string) {
  if (!JOB_ID_PATTERN.test(jobId)) {
    throw new Error("Identificador de processamento inválido.");
  }
}

export function getJobDir(jobId: string) {
  assertSafeJobId(jobId);
  return path.join(getCutsRoot(), jobId);
}

export function createJobId() {
  return `cut-${nanoid(16)}`;
}

export async function ensureJobDir(jobId: string) {
  const jobDir = getJobDir(jobId);
  await fs.mkdir(path.join(jobDir, "output"), { recursive: true });
  return jobDir;
}

export async function safeDeletePath(filePath: string) {
  try {
    await fs.rm(filePath, { recursive: true, force: true });
  } catch {
    // Cleanup must not mask the original processing error.
  }
}

export async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
