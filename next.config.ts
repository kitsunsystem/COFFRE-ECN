import type { NextConfig } from "next";

// A production build (Supabase keys present) with simulated cards would let anyone open a Coffre: refused.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_CARD_DRIVER === "demo")
  throw new Error("Build refusé : NEXT_PUBLIC_CARD_DRIVER=demo est réservé aux tests, jamais à une version de production.");

// Static export: the same build runs as a website and, wrapped with Capacitor, as the iOS/Android app (NFC needs a native app on iPhone).
const nextConfig: NextConfig = {
  output: "export",
  // GitHub Pages serves the demo under /<repo>; set only by `npm run deploy`, so local dev stays at /.
  basePath: process.env.PAGES_BASE_PATH ?? "",
  // Full links built in the browser (the QR code shown to the phone) need it too.
  env: { NEXT_PUBLIC_BASE_PATH: process.env.PAGES_BASE_PATH ?? "" },
  // Emits espace/index.html instead of espace.html: static hosts (GitHub Pages) pick the espace/ folder otherwise, and reloads 404.
  trailingSlash: true,
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
