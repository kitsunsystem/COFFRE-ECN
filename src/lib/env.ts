// Build-time configuration (values are inlined by Next.js). Without a Supabase project the app runs as the demo:
// everything stays on the device. With one, it is the production app: accounts, data and files go to Supabase.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const PROD = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Cards: "auto" picks FIDO2 (web) or Tangem (native app); "demo" simulates the chip, for end-to-end tests only.
export const CARD_DRIVER = (process.env.NEXT_PUBLIC_CARD_DRIVER ?? "auto") as "auto" | "demo";
// WebAuthn relying party: the site's domain (e.g. app.sillage.fr). Empty = the current host.
export const FIDO_RP_ID = process.env.NEXT_PUBLIC_FIDO_RP_ID || undefined;
// Public web address, used in links and for the native app's redirects.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
// Phone notifications (a computer asks for the Coffre): on once Firebase (Android) and APNs (iOS) are set up.
export const PUSH = process.env.NEXT_PUBLIC_PUSH === "1";
// Store pages, shown on a phone's browser (the Coffre opens in the app). Empty until the apps are published.
export const STORE_IOS = process.env.NEXT_PUBLIC_STORE_IOS ?? "";
export const STORE_ANDROID = process.env.NEXT_PUBLIC_STORE_ANDROID ?? "";
