import { headers } from "next/headers";
import { menuQrSvg, menuUrl } from "@/lib/qr";
import Shell from "@/components/admin/Shell";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const url = menuUrl(await headers());
  const svg = await menuQrSvg(url);
  const environment = process.env.ENVIRONMENT_LABEL?.trim();
  // Same source and fallback as the printed card (table-card/route.ts).
  const shopName = process.env.SHOP_NAME ?? "Our Bakery";

  return (
    <Shell title="QR code" back={{ href: "/admin", label: "All categories" }}>
      {environment && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This is the <strong>{environment}</strong> site, so this code opens {environment}, which
          customers cannot reach. Print and share codes from the live dashboard.
        </p>
      )}
      {url.includes("localhost") && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This code points at <strong>localhost</strong>, so it only works on this computer. Open
          the dashboard on the live site to get the code customers can scan.
        </p>
      )}

      <div className="grid items-start gap-6 md:grid-cols-[auto_1fr]">
        <div className="card mx-auto w-full max-w-xs p-5 text-center">
          {/* Laid out like the printed table card, so what a customer scans off
              this screen looks like the one on their table. */}
          <p className="text-xl font-black uppercase leading-tight tracking-tight">{shopName}</p>
          <div aria-hidden="true" className="mb-3 mt-2 flex items-center justify-center gap-2">
            <span className="h-px w-10 bg-[var(--accent)] opacity-60" />
            <span className="h-1.5 w-1.5 rotate-45 bg-[var(--accent)]" />
            <span className="h-px w-10 bg-[var(--accent)] opacity-60" />
          </div>
          {/* Markup from lib/qr: generated, never typed by anyone. */}
          <div
            className="mx-auto w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="mt-3 font-semibold">Scan for our menu</p>
          <p className="text-xs text-[var(--muted)]">Customers can scan it straight off this screen.</p>
        </div>

        <div className="space-y-5">
          <div>
            <p className="label">The code opens</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-medium text-[var(--accent)] hover:underline"
            >
              {url}
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/admin/qr/menu-qr.png" download className="btn-primary">
              Download PNG
            </a>
            <a href="/admin/qr/menu-qr.svg" download className="btn-ghost">
              Download SVG
            </a>
            <a href="/admin/qr/table-card" target="_blank" className="btn-ghost">
              Full screen &amp; print card
            </a>
          </div>

          <ul className="max-w-xl list-disc space-y-1.5 pl-5 text-sm text-[var(--muted)]">
            <li>
              <strong className="text-[var(--text)]">Lost or damaged a table card?</strong> Open{" "}
              <em>Full screen &amp; print card</em> and print a new one — it is sized A6.
            </li>
            <li>
              <strong className="text-[var(--text)]">Showing a customer?</strong> Open it full
              screen on your phone and let them scan it.
            </li>
            <li>
              <strong className="text-[var(--text)]">PNG</strong> is for WhatsApp, Instagram and
              most printing. <strong className="text-[var(--text)]">SVG</strong> stays sharp at any
              size — best for posters and banners.
            </li>
            <li>
              The code only holds the address, so changing the menu, prices or photos never needs
              a new one.
            </li>
          </ul>
        </div>
      </div>
    </Shell>
  );
}
