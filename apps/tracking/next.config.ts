import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  devIndicators: false,
  serverExternalPackages: ["@prisma/client", "prisma"],
  transpilePackages: ["@cpl/database", "@cpl/shared", "@cpl/tracking-core"],
  productionBrowserSourceMaps: false,
  turbopack: {
    root: monorepoRoot,
  },
  experimental: {
    webpackMemoryOptimizations: true,
    cpus: 1,
  },
  webpack: (config) => {
    config.parallelism = 1;
    return config;
  },
  async headers() {
    const baseHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    if (process.env.NODE_ENV === "production") {
      baseHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    // Smart-link entry (/s) and lead forms (/t) must be iframe-embeddable for
    // traffic exchanges — omit X-Frame-Options and allow any frame ancestor.
    const embeddableHeaders = [
      ...baseHeaders,
      { key: "Content-Security-Policy", value: "frame-ancestors *" },
    ];

    // Everything else stays clickjacking-protected.
    const lockedHeaders = [
      ...baseHeaders,
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ];

    return [
      // Negative lookahead: all paths except /s and /t
      { source: "/((?!s(?:/|$)|t(?:/|$)).*)", headers: lockedHeaders },
      { source: "/s/:path*", headers: embeddableHeaders },
      { source: "/t/:path*", headers: embeddableHeaders },
    ];
  },
};

export default nextConfig;
