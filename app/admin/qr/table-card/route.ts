import { menuQrSvg, menuUrl, tableCardHtml } from "@/lib/qr";

// Behind the login like the rest of /admin (see middleware.ts).
export const dynamic = "force-dynamic";

/**
 * The printable table card. A plain HTML page rather than a dashboard page, so
 * it prints as just the card and fills a phone screen when shown to a customer.
 */
export async function GET(request: Request) {
  const svg = await menuQrSvg(menuUrl(request.headers));
  const html = tableCardHtml(process.env.SHOP_NAME ?? "Our Bakery", svg);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
