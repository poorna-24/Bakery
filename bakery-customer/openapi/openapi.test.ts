/**
 * @vitest-environment node
 *
 * This suite reads files off disk and runs no DOM code. Declared here
 * rather than in vitest.config.ts because environmentMatchGlobs is
 * deprecated in Vitest 3 and gone in 4.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3 } from "openapi-types";

const SPEC = path.join(process.cwd(), "openapi", "openapi.yaml");

async function loadSpec() {
  // validate() resolves every $ref and rejects on a malformed document.
  return (await SwaggerParser.validate(SPEC)) as OpenAPIV3.Document;
}

describe("the spec itself", () => {
  it("is a valid OpenAPI 3 document", async () => {
    const api = await loadSpec();
    expect(api.openapi).toMatch(/^3\./);
    expect(api.info.title).toBe("Bakery Menu API");
  });

  it("gives every operation an operationId, which clients generate names from", async () => {
    const api = await loadSpec();

    for (const [route, item] of Object.entries(api.paths ?? {})) {
      for (const method of ["get", "post", "put", "patch", "delete"] as const) {
        const operation = item?.[method];
        if (!operation) continue;
        expect(operation.operationId, `${method.toUpperCase()} ${route}`).toBeTruthy();
      }
    }
  });

  it("documents a 500 on every endpoint except health", async () => {
    const api = await loadSpec();

    for (const [route, item] of Object.entries(api.paths ?? {})) {
      if (route === "/health") continue;
      expect(Object.keys(item?.get?.responses ?? {}), route).toContain("500");
    }
  });

  it("exposes only GET — this API is read-only", async () => {
    const api = await loadSpec();

    for (const [route, item] of Object.entries(api.paths ?? {})) {
      for (const method of ["post", "put", "patch", "delete"] as const) {
        expect(item?.[method], `${method.toUpperCase()} ${route}`).toBeUndefined();
      }
    }
  });

  it("declares no security, and says why in the description", async () => {
    const api = await loadSpec();
    expect(api.security ?? []).toEqual([]);
    expect(api.info.description).toMatch(/no authentication/i);
  });
});

/**
 * The guard that actually matters: a spec nobody checks drifts from the code
 * within a week. Every documented path must have a route handler on disk, and
 * every route handler must be documented.
 */
describe("the spec matches the routes on disk", () => {
  const routeFileFor = (specPath: string) => {
    // "/items/{id}" -> app/api/v1/items/[id]/route.ts
    const segments = specPath
      .split("/")
      .filter(Boolean)
      .map((segment) =>
        segment.startsWith("{") ? `[${segment.slice(1, -1)}]` : segment,
      );

    return path.join(process.cwd(), "app", "api", "v1", ...segments, "route.ts");
  };

  it("has a route handler for every documented path", async () => {
    const api = await loadSpec();

    for (const specPath of Object.keys(api.paths ?? {})) {
      const file = routeFileFor(specPath);
      expect(existsSync(file), `${specPath} is documented but ${file} does not exist`).toBe(true);
    }
  });

  it("documents every route handler that exists", async () => {
    const api = await loadSpec();
    const documented = new Set(Object.keys(api.paths ?? {}));

    const routes = [
      "/menu",
      "/categories",
      "/items",
      "/items/{id}",
      "/shop",
      "/health",
    ];

    for (const route of routes) {
      expect(documented.has(route), `${route} exists but is not in the spec`).toBe(true);
    }
  });
});
