import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Serves the spec straight from openapi/openapi.yaml.
 *
 * Read from the file rather than duplicated into code, so the document under
 * review in git is byte-for-byte the one Swagger renders. There is no second
 * copy to drift.
 */
export async function GET() {
  try {
    const spec = await readFile(path.join(process.cwd(), "openapi", "openapi.yaml"), "utf8");

    return new Response(spec, {
      headers: {
        "Content-Type": "application/yaml; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("openapi/openapi.yaml is missing from the deployment", { status: 500 });
  }
}
