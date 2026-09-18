import Shell from "@/components/admin/Shell";

export const dynamic = "force-dynamic";

export default function PreviewPage() {
  // The menu is served by this very app, so the frame points at our own root.
  // It used to need CUSTOMER_APP_URL and a second server running alongside.
  const menuUrl = "/";

  return (
    <Shell title="Phone preview" back={{ href: "/admin", label: "All categories" }}>
      <p className="text-sm text-[var(--muted)]">
        This is the live customer page — exactly what someone sees after scanning the QR code.
        Save a change, then reload this frame to check it.
      </p>

      <div className="mt-6 flex justify-center">
        {/* 390 x 780 is roughly an iPhone 15 viewport. */}
        <div className="rounded-[2.5rem] border-8 border-neutral-800 bg-neutral-800 shadow-xl">
          <iframe
            src={menuUrl}
            title="Customer menu preview"
            width={390}
            height={780}
            className="rounded-[2rem] bg-white"
          />
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Or open it full size:{" "}
        <a
          href={menuUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[var(--accent)] hover:underline"
        >
          the menu
        </a>
      </p>
    </Shell>
  );
}
