import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Ensure native pg driver and Prisma client are traced into standalone output
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pg/**/*",
      "./node_modules/pg-protocol/**/*",
      "./node_modules/pg-pool/**/*",
      "./node_modules/pg-cursor/**/*",
      "./node_modules/pg-types/**/*",
      "./node_modules/pg-packet-stream/**/*",
      "./node_modules/pg-connection-string/**/*",
      "./node_modules/buffer-writer/**/*",
      "./node_modules/object-assign/**/*",
      "./node_modules/split2/**/*",
      "./node_modules/readable-stream/**/*",
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/**/*",
      "./prisma/**/*",
    ],
  },
};

export default nextConfig;
