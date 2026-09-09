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
import {
  deleteFromCloudinary,
  publicIdFromUrl,
  uploadToCloudinary,
  usingCloudinary,
} from "./cloudinary";

export type SaveResult = { url: string } | { error: string };

/**
 * Writes an uploaded photo and returns the URL both apps use to read it back.
 *
 * Goes to Cloudinary when CLOUDINARY_URL is set, and to the shared data folder
 * otherwise — so this laptop needs no accounts, and production needs no shared
 * disk. Callers do not care which; they get a URL either way.
 *
 * Returns null when the form had no file attached, which is the normal case
 * when the owner edits a price and leaves the photo alone.
 */
export async function saveImage(file: File | null): Promise<SaveResult | null> {
  if (!file || file.size === 0) return null;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { error: "Image must be a JPG, PNG, WebP or AVIF file." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image is larger than 5 MB. Please pick a smaller photo." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (usingCloudinary()) {
    try {
      const uploaded = await uploadToCloudinary(bytes, file.name || "upload");
      return { url: uploaded.url };
    } catch {
      // Better to say so than to save an item pointing at nothing.
      return { error: "Could not reach the image service. Please try again." };
    }
  }

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });

  // Random name: no collisions, no guessing, and safe to cache forever.
  const fileName = `${randomUUID()}${extensionFor(file.type)}`;
  await writeFile(path.join(dir, fileName), bytes);

  return { url: `/uploads/${fileName}` };
}

/**
 * Best-effort cleanup when a photo is replaced or its item is deleted.
 *
 * Handles both kinds of URL, because a shop that started on disk and later
 * moved to Cloudinary will have some of each in the database.
 */
export async function deleteImage(url: string | null | undefined): Promise<void> {
  if (!url) return;

  const publicId = publicIdFromUrl(url);
  if (publicId) {
    await deleteFromCloudinary(publicId);
    return;
  }

  if (!url.startsWith("/uploads/")) return;

  const fileName = safeFileName(url.slice("/uploads/".length));
  if (!fileName) return;

  try {
    await unlink(path.join(uploadsDir(), fileName));
  } catch {
    // Already gone, or never written — nothing to do.
  }
}
