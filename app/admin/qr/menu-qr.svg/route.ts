import { menuQrSvg, menuUrl } from "@/lib/qr";

// Behind the login like the rest of /admin (see middleware.ts).
export const dynamic = "force-dynamic";

/** The menu's QR code as an SVG download: sharp at any size, for posters and print shops. */
export async function GET(request: Request) {
  const svg = await menuQrSvg(menuUrl(request.headers));

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="menu-qr.svg"',
      "Cache-Control": "no-store",
    },
  });
}
