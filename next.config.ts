import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No standalone - use next start directly (avoids module tracing issues with Prisma)
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
