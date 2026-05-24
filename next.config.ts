import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // @resvg/resvg-wasm ships a binary WASM blob. Externalising the package
  // keeps webpack / turbopack from trying to bundle the .wasm file — we load
  // it at runtime via fs.readFile in lib/server/canvas-svg-renderer.ts.
  serverExternalPackages: ["@resvg/resvg-wasm"],
  // Ensure the WASM blob ships with the standalone bundle. Next's tracer
  // can't see fs.readFile paths so we tell it explicitly.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/@resvg/resvg-wasm/index_bg.wasm",
      "./node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf",
    ],
    "/**/*": [
      "./node_modules/@resvg/resvg-wasm/index_bg.wasm",
      "./node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf",
    ],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
