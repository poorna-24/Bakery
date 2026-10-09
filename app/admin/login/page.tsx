import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { allowLoginAttempt, checkCredentials, createSession, safeNextPath } from "@/lib/auth";
import { clientKey } from "@/lib/rateLimit";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function signIn(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const target = safeNextPath(String(formData.get("next") ?? ""));
    const back = target !== "/admin" ? `&next=${encodeURIComponent(target)}` : "";

    // Counted before the password is even checked, so guessing costs the
    // same whether the guesses are right or wrong.
    if (!allowLoginAttempt(clientKey(await headers()))) redirect(`/admin/login?error=locked${back}`);

    if (!(await checkCredentials(email, password))) {
      // Deliberately vague: never say which half was wrong.
      redirect(`/admin/login?error=1${back}`);
    }

    await createSession(email);
    redirect(target);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form action={signIn} className="card w-full max-w-sm p-6 shadow-sm">
        <h1 className="text-lg font-bold">
          {process.env.SHOP_NAME ?? "Bakery"} Admin
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Sign in to manage the menu.</p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error === "locked"
              ? "Too many sign-in attempts. Please wait 15 minutes and try again."
              : "Wrong email or password."}
          </p>
        )}

        <input type="hidden" name="next" value={safeNextPath(next)} />

        <div className="mt-5">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="field"
          />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="field"
          />
        </div>

        <button type="submit" className="btn-primary mt-6 w-full">Sign in</button>
      </form>
    </main>
  );
}
