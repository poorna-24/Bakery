import Link from "next/link";
import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

async function signOut() {
  "use server";
  await destroySession();
  redirect("/admin/login");
}

export default function Shell({
  children,
  title,
  back,
  action,
}: {
  children: React.ReactNode;
  title: string;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-extrabold uppercase tracking-tight text-[var(--accent)]">
            {process.env.SHOP_NAME ?? "Bakery"} Admin
          </Link>
          <nav className="ml-auto flex flex-wrap items-center gap-1 text-sm">
            <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Menu
            </Link>
            <Link href="/admin/orders" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Orders
            </Link>
            <Link href="/admin/offers" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Offers
            </Link>
            <Link href="/admin/hours" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Hours
            </Link>
            <Link href="/admin/ordering" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Ordering
            </Link>
            <Link href="/admin/appearance" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Appearance
            </Link>
            <Link href="/admin/preview" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Preview
            </Link>
            <Link href="/admin/qr" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              QR code
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {back && (
          <Link href={back.href} className="text-sm text-[var(--muted)] hover:underline">
            ← {back.label}
          </Link>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {action}
        </div>

        <div className="mt-6">{children}</div>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-6 text-xs text-[var(--muted)]">
        {versionLabel()}
      </footer>
    </div>
  );
}

/**
 * Which build this is: the commit Vercel deployed, plus the environment on QA.
 * With dev, qa and main deployed side by side, it answers "is my change live
 * here yet?" at a glance.
 */
function versionLabel(): string {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
  const environment = process.env.ENVIRONMENT_LABEL?.trim();
  return environment ? `Version ${commit} · ${environment}` : `Version ${commit}`;
}
