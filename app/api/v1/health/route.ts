import { prisma } from "@/lib/db";
import { API_VERSION, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Liveness plus a real database round-trip, so it fails when the data is gone. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: "ok", version: API_VERSION, checkedAt: new Date().toISOString() });
  } catch {
    return json(
      { status: "error", version: API_VERSION, checkedAt: new Date().toISOString() },
      503,
    );
  }
}
