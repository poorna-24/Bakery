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
};

export default nextConfig;
