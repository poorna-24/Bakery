import { adminManifest } from "@/lib/appManifest";

// Outside /admin on purpose: the browser fetches the manifest without the
// login cookie, so it must not sit behind the dashboard's sign-in.
export const dynamic = "force-dynamic";

/** The installable-app description for the dashboard (see lib/appManifest). */
export function GET() {
  return new Response(JSON.stringify(adminManifest(process.env.SHOP_NAME ?? "")), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
