import { loadRootEnv } from "./scripts/load-root-env.mjs";

// One env file lives at the repository root. Next only reads its own folder,
// so it is loaded here — before the config object is built, so everything
// below and every server module can see it.
loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Docker needs the self-contained server bundle that `standalone` emits.
  // Vercel does not, and turning it on there changes nothing for the better —
  // so it is gated on the flag the Dockerfile sets, leaving Vercel builds
  // exactly as they were.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  // The /api/v1/openapi.yaml route reads the spec off disk at runtime. Next
  // traces imports, not runtime file reads, so without this the file is left
  // out of the deployment bundle and the route 500s in production.
  outputFileTracingIncludes: {
    "/api/v1/openapi.yaml": ["./openapi/**"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },

  // Browser-side protections on every response. Framing is allowed from this
  // site only — the dashboard's Preview tab shows the menu in a frame — so no
  // other site can lay the login or the dashboard under a fake page
  // (clickjacking). Location stays allowed for this site alone: delivery
  // orders ask for it.
  async headers() {
    const everywhere = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
      },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ];
    return [
      { source: "/:path*", headers: everywhere },
      // The dashboard is never cached on a shared device, nor indexed.
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
