import path from "node:path";

// Shared file. An identical copy lives in bakery-admin/lib/storage.ts.
//
// Both apps point at ONE folder on disk (../data by default, set with
// BAKERY_DATA_DIR). The admin writes uploaded photos into it; the customer app
// reads them back out through its /uploads/[...path] route. That folder also
// holds bakery.db, which is why it lives outside both repos and is gitignored.
//
// Swapping to S3 / Supabase Storage later means replacing only this file.

export function uploadsDir(): string {
  const base = process.env.BAKERY_DATA_DIR ?? path.join(process.cwd(), "..", "data");
  return path.resolve(process.cwd(), base, "uploads");
}

/** Only these are accepted from the upload form. */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/avif":
      return ".avif";
    default:
      return ".jpg";
  }
}

export function contentTypeFor(fileName: string): string {
  switch (path.extname(fileName).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    default:
      return "image/jpeg";
  }
}

/**
 * Guards against `../../etc/passwd` style names arriving in a URL.
 * Returns null when the name is not a plain single-segment file name.
 */
export function safeFileName(name: string): string | null {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return /^[A-Za-z0-9._-]+$/.test(name) ? name : null;
}
