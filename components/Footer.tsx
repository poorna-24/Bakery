type Props = {
  shopName: string;
  address: string;
  mapUrl: string;
  phone: string;
};

/**
 * Sits at the bottom of the menu: where the shop is, and one tap to get there.
 *
 * No QR code here on purpose — this page is already being read on a phone, and
 * nobody can scan a QR with the screen showing it. A link opens the map app
 * directly, and the written address is there to read or copy.
 */
export default function Footer({ shopName, address, mapUrl, phone }: Props) {
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

        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--accent)] py-3.5 font-semibold text-[var(--accent)]"
          >
            <PhoneIcon />
            Call the shop
          </a>
        )}
      </div>

      <p className="mt-7 text-xs text-[var(--muted)]">
        Prices are inclusive of taxes and may change without notice.
      </p>
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
