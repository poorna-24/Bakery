import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { contentTypeFor, safeFileName, uploadsDir } from "@/lib/storage";

// The admin writes item photos into the shared data folder, which sits outside
// this repo — so they cannot be served from /public. This route reads them back
// for the thumbnails and previews here. Names are validated to stay in-folder.

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  const fileName = safeFileName(name);
  if (!fileName) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(uploadsDir(), fileName);

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("Not found", { status: 404 });

    const file = await readFile(filePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentTypeFor(fileName),
        "Content-Length": String(info.size),
        // Uploads get a fresh random name, so a saved file never changes.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
