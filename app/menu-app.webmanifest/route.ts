import { menuManifest } from "@/lib/appManifest";

export const dynamic = "force-dynamic";

/** The installable-app description for the customer menu (see lib/appManifest). */
export function GET() {
  return new Response(
    JSON.stringify(menuManifest(process.env.SHOP_NAME ?? "", process.env.SHOP_TAGLINE ?? "")),
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
