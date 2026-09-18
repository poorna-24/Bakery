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
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
