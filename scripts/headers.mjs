// Security headers of the production website (Cloudflare Pages reads out/_headers).
// The Supabase address comes from the build environment, so the page may only talk to our own backend.
// Usage: node scripts/headers.mjs (run by "npm run build:prod").
import { writeFileSync } from "node:fs";

const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!api) throw new Error("NEXT_PUBLIC_SUPABASE_URL manquant : ce script sert au build de production.");
const origin = new URL(api).origin;

const csp = [
  "default-src 'self'",
  // Next.js static pages carry small inline boot scripts; libsodium runs as WebAssembly.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${origin} ${origin.replace(/^http/, "ws")}`,
  "worker-src 'self' blob:",
  "frame-src 'none'",
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
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(self), publickey-credentials-get=(self), publickey-credentials-create=(self)

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
`;

writeFileSync("out/_headers", headers);
console.log(`out/_headers écrit (API : ${origin})`);
