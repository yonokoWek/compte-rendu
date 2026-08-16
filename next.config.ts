import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No standalone - use next start directly (avoids module tracing issues with Prisma)
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'preview-chat-9316d6f6-e850-4e5b-a20e-be93a1051508.space-z.ai',
    '127.0.0.1',
    'localhost',
  ],
};

export default nextConfig;
