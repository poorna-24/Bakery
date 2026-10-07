import { menuQrPng, menuUrl } from "@/lib/qr";

// Behind the login like the rest of /admin (see middleware.ts).
export const dynamic = "force-dynamic";

/** The menu's QR code as a large PNG download, for WhatsApp, Instagram and the like. */
export async function GET(request: Request) {
  const png = await menuQrPng(menuUrl(request.headers));

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'attachment; filename="menu-qr.png"',
      "Cache-Control": "no-store",
    },
  });
}
