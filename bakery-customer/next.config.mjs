/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
