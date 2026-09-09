import { telHref, whatsappHref } from "@/lib/contact";

type Props = {
  shopName: string;
  address: string;
  mapUrl: string;
  phone: string;
  whatsapp: string;
  credit: { name: string; whatsapp: string };
};

/**
 * Sits at the bottom of the menu: where the shop is and how to reach it.
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
}: Props) {
  const tel = telHref(phone);
  const wa = whatsappHref(whatsapp || phone, `Hi ${shopName}, I saw your menu.`);

  // The builder's credit. Quiet by design — it belongs to the shop's page, so
  // it sits below the shop's own details and never competes with them.
  const creditWa = whatsappHref(
    credit.whatsapp,
    `Hi ${credit.name}, I saw the ${shopName} menu page you built.`,
  );

  return (
    <footer className="mt-14 border-t border-[var(--line)] px-5 pb-10 pt-8 text-center">
      <p className="text-base font-extrabold uppercase tracking-tight text-[var(--accent)]">
        {shopName}
      </p>

      {address && (
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[var(--muted)]">
          {address}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] py-3.5 font-semibold text-white"
          >
            <PinIcon />
            Get directions
          </a>
        )}

        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3.5 font-semibold text-white"
          >
            <WhatsAppIcon />
            Message on WhatsApp
          </a>
        )}

        {tel && (
          <a
            href={tel}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--accent)] py-3.5 font-semibold text-[var(--accent)]"
          >
            <PhoneIcon />
            Call {phone}
          </a>
        )}
      </div>

      <p className="mt-7 text-xs text-[var(--muted)]">
        Prices are inclusive of taxes and may change without notice.
      </p>

      {credit.name && (
        <p className="mx-auto mt-6 max-w-xs border-t border-[var(--line)] pt-5 text-[11px] leading-relaxed text-[var(--muted)]">
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
