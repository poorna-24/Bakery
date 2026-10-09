import Link from "next/link";
import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";
import AdminNav from "./AdminNav";

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
      {/* Two rows: the shop and sign-out, then the sections. The sections row
          scrolls sideways on a phone instead of wrapping onto three lines. */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center justify-between gap-3 py-3">
            <Link
              href="/admin"
              className="truncate font-extrabold uppercase tracking-tight text-[var(--accent)]"
            >
              {process.env.SHOP_NAME ?? "Bakery"} Admin
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-[var(--bg)]"
              >
                Sign out
              </button>
            </form>
          </div>
          <AdminNav />
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
