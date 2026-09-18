/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Docker needs the self-contained server bundle that `standalone` emits.
  // Vercel does not, and turning it on there changes nothing for the better —
  // so it is gated on the flag the Dockerfile sets, leaving Vercel builds
  // exactly as they were.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
