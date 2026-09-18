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
  const onLoginPage = request.nextUrl.pathname === "/admin/login";

  if (!signedIn && !onLoginPage) {
    const url = new URL("/admin/login", request.url);
    // Remember where they were headed so login can send them back.
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && onLoginPage) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // The dashboard only. The menu, the public API and the photo route share this
  // app and must stay open — matching more than /admin here would put the
  // customer menu behind the login, which is the whole point of the site.
  matcher: ["/admin/:path*"],
};
