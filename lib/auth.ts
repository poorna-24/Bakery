import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

// One owner account, credentials held in .env.local — there is no sign-up and
// no user table, because only the shop owner ever logs in here.
//
// In development ADMIN_PASSWORD may be plain text. Before going live, set
// ADMIN_PASSWORD_HASH instead (npm run hash-password) and drop the plain one.

export const SESSION_COOKIE = "bakery_admin_session";
const SESSION_HOURS = 12;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short — set it in .env.local");
  }
  return new TextEncoder().encode(secret);
}

/** Constant-time-ish comparison so a wrong password leaks no length hints. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkCredentials(email: string, password: string): Promise<boolean> {
  const expectedEmail = process.env.ADMIN_EMAIL ?? "";
  const hash = process.env.ADMIN_PASSWORD_HASH ?? "";
  const plain = process.env.ADMIN_PASSWORD ?? "";

  // An unset ADMIN_EMAIL would compare "" against "" and pass, leaving the
  // password as the only thing standing between a stranger and the dashboard.
  // A half-configured environment must refuse everyone, not almost everyone.
  const emailOk =
    expectedEmail.trim().length > 0 &&
    safeEqual(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordOk = hash
    ? await bcrypt.compare(password, hash)
    : plain.length > 0 && safeEqual(password, plain);

  // Both checks always run, so a wrong email and a wrong password cost the same.
  return emailOk && passwordOk;
}

export async function createSession(email: string): Promise<void> {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

/** The signed-in owner's email, or null. Use in server components. */
export async function currentUser(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifyToken(token) : null;
}
