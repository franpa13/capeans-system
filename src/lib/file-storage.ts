import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

/** Patient files (radiografías, fotos, PDFs) live on the server's disk,
 * under UPLOADS_DIR (a Docker volume in production, included in the
 * backup), one folder per clinic. */
// The turbopackIgnore comments below tell the build these are runtime data
// paths, not source files to bundle — otherwise it traces (and ships) the
// whole project into the standalone server output.
function uploadsDir() {
  return path.resolve(/* turbopackIgnore: true */ process.env.UPLOADS_DIR ?? "uploads");
}

/** Only these are accepted, recognized by their first bytes — never by the
 * file name or the browser's claimed type, so nothing that could run in
 * the browser (an HTML page renamed to .png) is ever stored or served. */
export type StoredFileType = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";

export function detectFileType(buffer: Buffer): StoredFileType | null {
  const startsWith = (hex: string, offset = 0) =>
    buffer.length >= offset + hex.length / 2 &&
    buffer.subarray(offset, offset + hex.length / 2).toString("hex") === hex;
  if (startsWith("ffd8ff")) return "image/jpeg";
  if (startsWith("89504e470d0a1a0a")) return "image/png";
  if (startsWith("474946383761") || startsWith("474946383961")) return "image/gif";
  if (startsWith("52494646") && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (startsWith("255044462d")) return "application/pdf";
  return null;
}

/** The absolute path for a key, refusing anything that resolves outside
 * the uploads folder ("../" tricks). */
function resolveKey(key: string) {
  const root = uploadsDir();
  const full = path.resolve(/* turbopackIgnore: true */ root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Archivo inválido");
  return full;
}

export async function storeFile(clinicId: string, buffer: Buffer): Promise<string> {
  const key = `${clinicId}/${randomUUID()}`;
  const full = resolveKey(key);
  await mkdir(/* turbopackIgnore: true */ path.dirname(full), { recursive: true });
  await writeFile(/* turbopackIgnore: true */ full, buffer);
  return key;
}

export async function readStoredFile(key: string): Promise<Buffer> {
  return readFile(/* turbopackIgnore: true */ resolveKey(key));
}

export async function removeStoredFile(key: string): Promise<void> {
  await rm(/* turbopackIgnore: true */ resolveKey(key), { force: true });
}
