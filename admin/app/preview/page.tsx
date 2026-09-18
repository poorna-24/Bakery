import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default function PreviewPage() {
  const customerUrl = process.env.CUSTOMER_APP_URL ?? "http://localhost:3000";

  return (
    <Shell title="Phone preview" back={{ href: "/", label: "All categories" }}>
      <p className="text-sm text-[var(--muted)]">
        This is the live customer page — exactly what someone sees after scanning the QR code.
        Save a change, then reload this frame to check it.
      </p>

      <div className="mt-6 flex justify-center">
        {/* 390 x 780 is roughly an iPhone 15 viewport. */}
        <div className="rounded-[2.5rem] border-8 border-neutral-800 bg-neutral-800 shadow-xl">
          <iframe
            src={customerUrl}
            title="Customer menu preview"
            width={390}
            height={780}
            className="rounded-[2rem] bg-white"
          />
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Not loading? The customer app has to be running too —{" "}
        <code className="rounded bg-[var(--bg)] px-1.5 py-0.5">npm run dev</code> in
        bakery-customer. Direct link:{" "}
        <a
          href={customerUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[var(--accent)] hover:underline"
        >
          {customerUrl}
        </a>
      </p>
    </Shell>
  );
}
