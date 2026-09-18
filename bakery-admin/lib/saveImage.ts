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
  uploadToCloudinaryFromUrl,
  usingCloudinary,
} from "./cloudinary";
import {
  checkImageUrl,
  isAcceptableImageType,
  isShortLink,
  unwrapGoogleImageUrl,
  type UrlCheck,
} from "./imageUrl";

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

/**
 * Turns whatever the owner pasted into the address of an actual picture.
 *
 * Two Google shapes need unwrapping before anything is fetched, because both
 * are what you get from an ordinary copy-paste:
 *
 *   google.com/imgres?imgurl=...   right-click a thumbnail, "Copy link address"
 *   share.google/xxxx              the Share button, which redirects to imgres
 *
 * Whatever comes out is checked again from scratch. The inner address is
 * attacker-controlled in the same way the outer one is — unwrapping must not
 * become a way to smuggle a private address past the first check.
 */
async function resolveToPicture(rawUrl: string): Promise<UrlCheck> {
  const first = checkImageUrl(rawUrl);
  if (!first.ok) return first;

  const unwrapped = unwrapGoogleImageUrl(first.url);
  if (unwrapped) return checkImageUrl(unwrapped.toString());

  if (!isShortLink(first.url)) return first;

  // A short link hides its destination, so the only way to know is to follow.
  let landedOn: URL;
  try {
    const response = await fetch(first.url.toString(), {
      redirect: "follow",
      headers: { Accept: "image/*,text/html" },
      signal: AbortSignal.timeout(15_000),
    });
    landedOn = new URL(response.url);
  } catch {
    return { ok: false, error: "Could not follow that short link. Try the image address instead." };
  }

  const inner = unwrapGoogleImageUrl(landedOn);
  return checkImageUrl((inner ?? landedOn).toString());
}

/**
 * Saves an image the owner pasted a link to.
 *
 * The picture is copied into our own storage rather than the address being
 * stored as-is. A link to someone else's site is not a photo you own: it can
 * be moved or deleted without warning, many hosts refuse requests that come
 * from another site, and every customer's phone would be fetching from a
 * stranger's server. Copying it once makes the menu self-contained.
 */
export async function saveImageFromUrl(rawUrl: string): Promise<SaveResult | null> {
  const resolved = await resolveToPicture(rawUrl);
  if (!resolved.ok) return { error: resolved.error };

  const address = resolved.url.toString();

  if (usingCloudinary()) {
    try {
      const uploaded = await uploadToCloudinaryFromUrl(address);
      return { url: uploaded.url };
    } catch {
      return {
        error:
          "Could not fetch that image. Check the link opens the picture directly, and that it ends in .jpg or .png.",
      };
    }
  }

  // No Cloudinary configured — development on a laptop. Fetch it here instead,
  // with the same checks the file upload applies.
  let response: Response;
  try {
    response = await fetch(address, {
      redirect: "follow",
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { error: "Could not reach that link. Check it opens in a browser." };
  }

  if (!response.ok) {
    return { error: `That link returned an error (${response.status}). Check it is still valid.` };
  }

  const contentType = response.headers.get("content-type");
  if (!isAcceptableImageType(contentType)) {
    return { error: "That link is not an image. Copy the image address itself, not the page." };
  }

  // Trust the declared length when present, but check the real size too: a
  // server can understate it, or omit the header entirely.
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    return { error: "That image is larger than 5 MB. Please pick a smaller one." };
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { error: "That image is larger than 5 MB. Please pick a smaller one." };
  }

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });

  const fileName = `${randomUUID()}${extensionFor(contentType?.split(";")[0].trim() ?? "")}`;
  await writeFile(path.join(dir, fileName), bytes);

  return { url: `/uploads/${fileName}` };
}
