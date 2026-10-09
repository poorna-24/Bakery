import { telHref, whatsappHref } from "@/lib/contact";
import type { ShopStatus } from "@/lib/hours";

type Props = {
  shopName: string;
  address: string;
  mapUrl: string;
  phone: string;
  whatsapp: string;
  credit: { name: string; whatsapp: string };
  /** Open or closed right now, from Shop hours; null when no hours are set. */
  status?: ShopStatus | null;
};

type Action = {
  href: string;
  /** The short word on the tile. */
  label: string;
  /** The whole action, for screen readers. */
  name: string;
  icon: React.ReactNode;
  tone: string;
  external: boolean;
};

/**
 * Sits at the bottom of the menu: where the shop is and how to reach it, as
 * one card with the ways to get in touch side by side — directions, WhatsApp,
 * a call — rather than three full-width buttons stacked down the screen.
 *
 * No QR code here on purpose — this page is already being read on a phone, and
 * nobody can scan a QR with the screen showing it. These links open the map,
 * the dialler and WhatsApp directly, and the address is there to read or copy.
 */
export default function Footer({
  shopName,
  address,
  mapUrl,
  phone,
  whatsapp,
  credit,
  status = null,
}: Props) {
  const tel = telHref(phone);
  const wa = whatsappHref(whatsapp || phone, `Hi ${shopName}, I saw your menu.`);

  // The builder's credit. Quiet by design — it belongs to the shop's page, so
  // it sits below the shop's own details and never competes with them.
  const creditWa = whatsappHref(
    credit.whatsapp,
    `Hi ${credit.name}, I saw the ${shopName} menu page you built.`,
  );

  // Only the ways in that are set up; the tiles share the row between them.
  const actions: Action[] = [];
  if (mapUrl) {
    actions.push({
      href: mapUrl,
      label: "Directions",
      name: "Get directions",
      icon: <PinIcon />,
      tone: "bg-[var(--accent)] text-white",
      external: true,
    });
  }
  if (wa) {
    actions.push({
      href: wa,
      label: "WhatsApp",
      name: "Message on WhatsApp",
      icon: <WhatsAppIcon />,
      tone: "bg-[#25D366] text-white",
      external: true,
    });
  }
  if (tel) {
    actions.push({
      href: tel,
      label: "Call",
      name: `Call ${phone}`,
      icon: <PhoneIcon />,
      tone: "border border-[var(--accent)] text-[var(--accent)]",
      external: false,
    });
  }

  return (
    <footer className="mt-14 px-4 pb-10 pt-2">
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-4 py-5 text-center shadow-sm">
        <p className="text-base font-extrabold uppercase tracking-tight text-[var(--accent)]">{shopName}</p>

        {address && (
          <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-[var(--muted)]">{address}</p>
        )}

        {status && (
          <p
            className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              status.isOpen ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.isOpen ? "bg-emerald-500" : "bg-red-500"}`} />
            {status.label} · {status.detail}
          </p>
        )}

        {actions.length > 0 && (
          <div
            className="mt-4 grid gap-2"
            style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
          >
            {actions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                aria-label={action.name}
                {...(action.external ? { target: "_blank", rel: "noreferrer" } : {})}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-3 text-xs font-semibold transition-opacity active:opacity-80 ${action.tone}`}
              >
                {action.icon}
                {action.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-[var(--muted)]">
        Prices are inclusive of taxes and may change without notice.
      </p>

      {credit.name && (
        <p className="mx-auto mt-3 max-w-xs text-center text-[11px] leading-relaxed text-[var(--muted)]">
          Page created by{" "}
          {creditWa ? (
            <a
              href={creditWa}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2"
            >
              {credit.name}
            </a>
          ) : (
            <span className="font-semibold text-[var(--text)]">{credit.name}</span>
          )}
        </p>
      )}
    </footer>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

export function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}
