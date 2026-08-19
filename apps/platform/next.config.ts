import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  devIndicators: false,
  serverExternalPackages: ["@prisma/client", "prisma"],
  transpilePackages: ["@cpl/database", "@cpl/shared", "@cpl/tracking-core"],
  productionBrowserSourceMaps: false,
  turbopack: {},
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
    ...(isProd
      ? {
          webpackMemoryOptimizations: true,
          cpus: 1,
        }
      : {}),
  },
  webpack: (config) => {
    if (isProd) {
      config.parallelism = 1;
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      // Keep craft.js on its nested immer@9 (default produce) — aliasing to v11 breaks undo/redo.
      "react-redux": path.join(root, "node_modules/react-redux"),
      "preact-render-to-string": path.join(root, "node_modules/preact-render-to-string"),
    };
    return config;
  },
  async rewrites() {
    return [
      { source: "/privacy", destination: "/privacy.html" },
      { source: "/terms", destination: "/termsofservice.html" },
      { source: "/contact", destination: "/contact.html" },
    ];
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

    // Optin funnels (/o) and custom-domain landings must be iframe-embeddable
    // for traffic exchanges (smart-link redirect targets).
    const embeddableHeaders = [
      ...baseHeaders,
      { key: "Content-Security-Policy", value: "frame-ancestors *" },
    ];

    // Login, admin, dashboards stay clickjacking-protected.
    const lockedHeaders = [
      ...baseHeaders,
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ];

    return [
      // Negative lookahead: all paths except /o and /domains
      { source: "/((?!o(?:/|$)|domains(?:/|$)).*)", headers: lockedHeaders },
      { source: "/o/:path*", headers: embeddableHeaders },
      { source: "/domains/:path*", headers: embeddableHeaders },
    ];
  },
};

export default nextConfig;
