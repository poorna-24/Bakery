import Link from "next/link";
import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

async function signOut() {
  "use server";
  await destroySession();
  redirect("/login");
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
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="font-extrabold uppercase tracking-tight text-[var(--accent)]">
            {process.env.NEXT_PUBLIC_SHOP_NAME ?? "Bakery"} Admin
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Menu
            </Link>
            <Link href="/appearance" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Appearance
            </Link>
            <Link href="/preview" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg)]">
              Preview
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
    </div>
  );
}
