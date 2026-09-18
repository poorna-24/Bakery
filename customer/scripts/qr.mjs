// Generates the QR code that goes on the tables.
//
//   npm run qr                          -> uses http://localhost:3000
//   npm run qr -- https://menu.shop.com -> uses that URL
//
// Writes two files into qr/ :
//   menu-qr.svg        the code on its own, vector, prints at any size
//   table-card.html    an A6 card to print, open it and hit Ctrl+P
//
// Re-run it with the real URL once the site is deployed — a QR pointing at
// localhost only works on this machine.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

/**
 * Loads .env.local the way Next.js would.
 *
 * This script runs as plain Node, which does not read .env files on its own —
 * without this the card printed the fallback shop name instead of the real one.
 * (Node 20's --env-file would do this, but the project runs on 18.)
 */
async function loadEnv() {
  const newline = /\r?\n/;
  const assignment = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
  const quoted = /^["'](.*)["']$/;

  for (const file of [".env.local", ".env"]) {
    let contents;
    try {
      contents = await readFile(path.join(process.cwd(), file), "utf8");
    } catch {
      continue;
    }

    for (const line of contents.split(newline)) {
      const match = assignment.exec(line);
      if (!match) continue;

      const [, key, rawValue] = match;
      // First file wins, matching Next's precedence.
      if (process.env[key] !== undefined) continue;

      process.env[key] = rawValue.trim().replace(quoted, "$1");
    }
  }
}

await loadEnv();

const url = process.argv[2] ?? process.env.CUSTOMER_APP_URL ?? "http://localhost:3000";
const shopName = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Our Bakery";
const outDir = path.join(process.cwd(), "qr");

if (url.includes("localhost")) {
  console.warn("Note: this QR points at localhost, so only this computer can open it.");
  console.warn("      Re-run with your public URL before printing.\n");
}

// High error correction: a printed card picks up smudges and thumbprints.
const svg = await QRCode.toString(url, {
  type: "svg",
  errorCorrectionLevel: "H",
  margin: 2,
  color: { dark: "#3A2418", light: "#FFFFFF" },
});

// The URL is deliberately not printed. The QR is how people get there, and a
// long address underneath is clutter on a table card — worse, it goes stale
// the day the site moves.
const card = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${shopName} — table card</title>
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
  .qr { width: 64mm; height: 64mm; margin: 0 auto; background: #fff; padding: 4mm; border-radius: 4mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  h2 { margin: 6mm 0 0; font-size: 15pt; font-weight: 700; }
  p.hint { margin: 1.5mm 0 0; font-size: 9pt; color: #8A7663; }
  @media print { body { background: #fff; } }
</style>
</head>
<body>
  <div class="card">
    <h1>${shopName}</h1>
    <div class="rule">
      <span class="line"></span><span class="dot"></span><span class="line"></span>
    </div>
    <div class="qr">${svg}</div>
    <h2>Scan for our menu</h2>
    <p class="hint">Point your phone camera at the code</p>
  </div>
</body>
</html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "menu-qr.svg"), svg, "utf8");
await writeFile(path.join(outDir, "table-card.html"), card, "utf8");

console.log(`QR code for: ${url}`);
console.log(`  ${path.join(outDir, "menu-qr.svg")}`);
console.log(`  ${path.join(outDir, "table-card.html")}  (open and print)`);
