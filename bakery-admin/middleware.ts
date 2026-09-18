import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Runs before every dashboard request. Middleware is the Edge runtime, so it
// cannot import lib/auth.ts (bcryptjs is Node-only) — the JWT check is inlined.

const SESSION_COOKIE = "bakery_admin_session";

async function isSignedIn(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const signedIn = await isSignedIn(request.cookies.get(SESSION_COOKIE)?.value);
  const onLoginPage = request.nextUrl.pathname === "/login";

  if (!signedIn && !onLoginPage) {
    const url = new URL("/login", request.url);
    // Remember where they were headed so login can send them back.
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && onLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and the image-serving route.
  matcher: ["/((?!_next/static|_next/image|uploads|favicon.ico).*)"],
};
