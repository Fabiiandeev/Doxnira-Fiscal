import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true"
    ? {
        output: "standalone" as const,
        outputFileTracingRoot: process.cwd().replace(/[\\/]apps[\\/]web$/, ""),
      }
    : {}),
  async rewrites() {
    return [
      // Temporary dev-time rewrite to ensure legacy relative page imports
      // like `/login/page.js` resolve to the emitted Next chunk.
      // This prevents 404s in dev when a relative client import is requested
      // from the route path. Remove once bundling is fixed.
      {
        source: "/:page/page.js",
        destination: "/_next/static/chunks/app/:page/page.js",
      },
    ];
  },
};

export default nextConfig;
