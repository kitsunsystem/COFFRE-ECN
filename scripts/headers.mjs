// Security headers of the production website (Cloudflare Pages reads out/_headers).
// The Supabase address comes from the build environment, so the page may only talk to our own backend.
// Usage: node scripts/headers.mjs (run by "npm run build:prod").
import { writeFileSync } from "node:fs";

const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!api) throw new Error("NEXT_PUBLIC_SUPABASE_URL manquant : ce script sert au build de production.");
const origin = new URL(api).origin;

const csp = [
  "default-src 'self'",
  // Next.js static pages carry small inline boot scripts; libsodium runs as WebAssembly; Paddle.js opens the checkout.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.paddle.com",
  "style-src 'self' 'unsafe-inline' https://cdn.paddle.com",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://*.paddle.com",
  // Alma talks to the Botpress webchat API; the checkout to Paddle (shortcut: hosts to confirm in the Paddle sandbox).
  `connect-src 'self' ${origin} ${origin.replace(/^http/, "ws")} https://webchat.botpress.cloud https://*.paddle.com`,
  "worker-src 'self' blob:",
  "frame-src https://buy.paddle.com https://sandbox-buy.paddle.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const headers = `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self "https://buy.paddle.com" "https://sandbox-buy.paddle.com"), usb=(self), publickey-credentials-get=(self), publickey-credentials-create=(self)

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
`;

writeFileSync("out/_headers", headers);
console.log(`out/_headers écrit (API : ${origin})`);
