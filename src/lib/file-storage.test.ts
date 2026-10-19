import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectFileType, readStoredFile, removeStoredFile, storeFile } from "@/lib/file-storage";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const JPEG = Buffer.from("ffd8ffe000104a464946", "hex");
const PDF = Buffer.from("%PDF-1.7\n", "latin1");
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);

describe("detectFileType", () => {
  it("recognizes images and PDFs by their content, not their name", () => {
    expect(detectFileType(PNG)).toBe("image/png");
    expect(detectFileType(JPEG)).toBe("image/jpeg");
    expect(detectFileType(PDF)).toBe("application/pdf");
    expect(detectFileType(WEBP)).toBe("image/webp");
  });

  it("refuses anything else, e.g. an HTML page renamed to .png", () => {
    expect(detectFileType(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });
});

describe("file storage", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "dentia-uploads-"));
    process.env.UPLOADS_DIR = dir;
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("stores a file under the clinic's folder and reads it back", async () => {
    const key = await storeFile("clinic1", PNG);
    expect(key.startsWith("clinic1/")).toBe(true);
    expect(await readStoredFile(key)).toEqual(PNG);
    await removeStoredFile(key);
    await expect(readStoredFile(key)).rejects.toThrow();
  });

  it("refuses a key that tries to leave the uploads folder", async () => {
    await expect(readStoredFile("../../etc/passwd")).rejects.toThrow("Archivo inválido");
    await expect(removeStoredFile("clinic1/../../x")).rejects.toThrow("Archivo inválido");
  });
});
