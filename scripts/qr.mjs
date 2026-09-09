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

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

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
  h1 { margin: 0 0 2mm; font-size: 22pt; letter-spacing: -0.5px; }
  p.lead { margin: 0 0 6mm; font-size: 11pt; color: #8A7663; }
  .qr { width: 62mm; height: 62mm; margin: 0 auto; background: #fff; padding: 4mm; border-radius: 4mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  h2 { margin: 6mm 0 1mm; font-size: 14pt; }
  p.url { margin: 0; font-size: 8pt; color: #8A7663; word-break: break-all; }
  @media print { body { background: #fff; } }
</style>
</head>
<body>
  <div class="card">
    <h1>${shopName}</h1>
    <p class="lead">Everything we bake, on your phone.</p>
    <div class="qr">${svg}</div>
    <h2>Scan for our menu</h2>
    <p class="url">${url}</p>
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
