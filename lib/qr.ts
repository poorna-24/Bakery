import QRCode from "qrcode";

// The menu's QR code, for the dashboard's QR page and its downloads.
//
// Same look as the printed table cards from scripts/qr.mjs — brown on white,
// high error correction because a card on a table picks up smudges — so a
// code downloaded here matches the ones already printed.

const QR_OPTIONS = {
  errorCorrectionLevel: "H",
  margin: 2,
  color: { dark: "#3A2418", light: "#FFFFFF" },
} as const;

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** First entry of a header a proxy may have turned into a list ("https, http"). */
function firstOf(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

/**
 * The address the code should open: the customer menu on this site.
 *
 * SITE_URL wins when it is a real public address — set it once a custom
 * domain is live, and the code points there even when the dashboard is opened
 * on the vercel.app address. Otherwise it is whatever host the dashboard was
 * reached on, which is always a site that exists, with no setting to forget.
 */
export function menuUrl(headers: Headers, siteUrl = process.env.SITE_URL): string {
  const configured = siteUrl?.trim().replace(/\/+$/, "");
  if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
    return configured;
  }

  const host = firstOf(headers.get("x-forwarded-host")) ?? firstOf(headers.get("host"));
  if (!host) return configured || "http://localhost:3000";

  const proto = firstOf(headers.get("x-forwarded-proto")) ?? (LOCAL.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** The code as SVG markup: sharp at any size, for posters and print shops. */
export function menuQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });
}

/** The code as a large PNG, for WhatsApp, Instagram and anything that wants a picture. */
export function menuQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...QR_OPTIONS, type: "png", width: 1024 });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A printable A6 table card, and a full-screen code to show a customer.
 *
 * The URL is deliberately not printed: the code is how people get there, and
 * a long address under it is clutter that goes stale the day the site moves.
 */
export function tableCardHtml(shopName: string, svg: string): string {
  const name = escapeHtml(shopName);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — menu QR code</title>
<style>
  @page { size: A6; margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; display: grid; place-items: center; min-height: 100vh;
    font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
    background: #FDF6EC; color: #3A2418; text-align: center;
  }
  .card { padding: 10mm 8mm; }
  h1 {
    margin: 0 0 3mm; font-size: 24pt; font-weight: 900;
    text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1;
  }
  .rule { display: flex; align-items: center; justify-content: center; gap: 3mm; margin: 0 0 6mm; }
  .rule .line { display: block; width: 12mm; height: 1px; background: #B4741F; opacity: 0.6; }
  .rule .dot { display: block; width: 2mm; height: 2mm; background: #B4741F; transform: rotate(45deg); }
  .qr { width: min(64mm, 80vw); aspect-ratio: 1; margin: 0 auto; background: #fff; padding: 4mm; border-radius: 4mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  h2 { margin: 6mm 0 0; font-size: 15pt; font-weight: 700; }
  p.hint { margin: 1.5mm 0 0; font-size: 9pt; color: #8A7663; }
  .print {
    margin-top: 8mm; padding: 10px 22px; border: 0; border-radius: 10px; cursor: pointer;
    background: #B4741F; color: #fff; font: 600 15px ui-sans-serif, system-ui, sans-serif;
  }
  @media print { body { background: #fff; } .print { display: none; } }
</style>
</head>
<body>
  <div class="card">
    <h1>${name}</h1>
    <div class="rule">
      <span class="line"></span><span class="dot"></span><span class="line"></span>
    </div>
    <div class="qr">${svg}</div>
    <h2>Scan for our menu</h2>
    <p class="hint">Point your phone camera at the code</p>
    <button class="print" onclick="window.print()">Print this card</button>
  </div>
</body>
</html>
`;
}
