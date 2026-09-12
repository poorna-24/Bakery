import { v2 as cloudinary } from "cloudinary";

// Cloudinary is used when CLOUDINARY_URL is set, and the shared data folder on
// disk is used when it is not. That split is what lets the same code run on
// this laptop with no accounts and on Vercel, where there is no writable disk
// to share between the two apps.
//
// CLOUDINARY_URL is read by the SDK itself, in the form
//   cloudinary://<api_key>:<api_secret>@<cloud_name>
// It belongs in .env.local and must never be committed.

export const CLOUDINARY_FOLDER = "bakery";

/** True when credentials are configured, so uploads should go to the cloud. */
export function usingCloudinary(): boolean {
  return Boolean(process.env.CLOUDINARY_URL);
}

function client() {
  // The SDK parses CLOUDINARY_URL on its own; secure forces https delivery.
  cloudinary.config({ secure: true });
  return cloudinary;
}

export type CloudUpload = { url: string; publicId: string };

/**
 * Uploads image bytes and returns the delivery URL.
 *
 * `quality: auto` and `fetch_format: auto` are applied at delivery, so a phone
 * on a weak connection gets a small WebP or AVIF without the owner having to
 * think about formats. The original is kept intact.
 */
export async function uploadToCloudinary(
  bytes: Buffer,
  filename: string,
): Promise<CloudUpload> {
  const api = client();

  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const stream = api.uploader.upload_stream(
        {
          folder: CLOUDINARY_FOLDER,
          resource_type: "image",
          // Never trust a filename from a form as an identifier.
          use_filename: false,
          unique_filename: true,
          overwrite: false,
          context: { original_filename: filename },
        },
        (error, uploaded) => {
          if (error || !uploaded) {
            reject(error ?? new Error("Cloudinary returned no result"));
            return;
          }
          resolve({ secure_url: uploaded.secure_url, public_id: uploaded.public_id });
        },
      );

      stream.end(bytes);
    },
  );

  return { url: deliveryUrl(result.public_id), publicId: result.public_id };
}

/** An auto-format, auto-quality delivery URL for a stored image. */
export function deliveryUrl(publicId: string): string {
  return client().url(publicId, {
    secure: true,
    fetch_format: "auto",
    quality: "auto",
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await client().uploader.destroy(publicId, { resource_type: "image" });
  } catch {
    // Already gone, or the account is unreachable. Losing a stale file is not
    // worth failing the owner's save for.
  }
}

/**
 * Recovers the public id from a stored delivery URL, so an image can be
 * deleted later. Cloudinary URLs look like:
 *   https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v123/bakery/abc.jpg
 * The id is everything after the version segment, without the extension.
 */
export function publicIdFromUrl(url: string): string | null {
  if (!/^https?:\/\/res\.cloudinary\.com\//.test(url)) return null;

  const afterUpload = url.split("/image/upload/")[1];
  if (!afterUpload) return null;

  const segments = afterUpload.split("/");

  // Both the transformation list and the version are optional, so the id can
  // start at any of the first three positions. Dropping a fixed number of
  // segments loses the first folder when neither is present.
  const versionAt = segments.findIndex((segment) => /^v\d+$/.test(segment));
  const looksLikeTransformation = (segment: string) =>
    /^[a-z]{1,3}_[^/]+$/.test(segment) || segment.includes(",");

  const idParts =
    versionAt >= 0
      ? segments.slice(versionAt + 1)
      : segments.slice(looksLikeTransformation(segments[0] ?? "") ? 1 : 0);
  if (idParts.length === 0) return null;

  const joined = idParts.join("/");
  return joined.replace(/\.[a-z0-9]+$/i, "") || null;
}

/**
 * Uploads an image Cloudinary fetches itself, from a public address.
 *
 * Handing Cloudinary the URL rather than downloading it here is deliberate:
 * their servers follow redirects, deal with hosts that reject unfamiliar
 * clients, and reject anything that is not really an image — and the request
 * comes from their network, not ours.
 */
export async function uploadToCloudinaryFromUrl(remoteUrl: string): Promise<CloudUpload> {
  const api = client();

  const result = await api.uploader.upload(remoteUrl, {
    folder: CLOUDINARY_FOLDER,
    resource_type: "image",
    use_filename: false,
    unique_filename: true,
    overwrite: false,
  });

  return { url: deliveryUrl(result.public_id), publicId: result.public_id };
}
