import type { NextConfig } from "next";

// Static export: the same build runs as a website and, wrapped with Capacitor, as the iOS/Android app (NFC needs a native app on iPhone).
const nextConfig: NextConfig = {
  output: "export",
  // GitHub Pages serves the demo under /COFFRE-ECN; set only by `npm run deploy`, so local dev stays at /.
  basePath: process.env.PAGES_BASE_PATH ?? "",
  images: { unoptimized: true },
  // Dev only: lets an ngrok tunnel load the dev server's scripts (otherwise the page stays blank).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.io"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
