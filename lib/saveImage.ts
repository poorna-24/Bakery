import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  extensionFor,
  safeFileName,
  uploadsDir,
} from "./storage";

export type SaveResult = { url: string } | { error: string };

/**
 * Writes an uploaded photo into the shared data folder and returns the URL both
 * apps use to read it back. Returns null-ish (no url, no error) when the form
 * had no file attached, which is the normal case when editing other fields.
 */
export async function saveImage(file: File | null): Promise<SaveResult | null> {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { error: "Image must be a JPG, PNG, WebP or AVIF file." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image is larger than 5 MB. Please pick a smaller photo." };
  }

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });

  // Random name: no collisions, no guessing, and safe to cache forever.
  const fileName = `${randomUUID()}${extensionFor(file.type)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), bytes);

  return { url: `/uploads/${fileName}` };
}

/** Best-effort cleanup when a photo is replaced or its item is deleted. */
export async function deleteImage(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return;

  const fileName = safeFileName(url.slice("/uploads/".length));
  if (!fileName) return;

  try {
    await unlink(path.join(uploadsDir(), fileName));
  } catch {
    // Already gone, or never written — nothing to do.
  }
}
