import type { Metadata, Viewport } from "next";
import { Cinzel, Fraunces, Manrope, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/config";
import { APP_URL } from "@/lib/env";
import { LANG_BOOT } from "@/lib/i18n";
import { THEME_BOOT } from "@/lib/theme";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz", "SOFT"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
// « Noir et or » theme only: downloaded by the browser only when that theme is on.
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", display: "swap", preload: false });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap", preload: false });

const DESCRIPTION = "Le coffre de vie et de succession, personnel ou familial : tout retrouver et tout régler, de son vivant comme après.";

export const metadata: Metadata = {
  // The site's origin only: Next adds the base path (/COFFRE-ECN on the public demo) to opengraph-image.jpg itself.
  metadataBase: new URL(APP_URL || "https://kitsunsystem.github.io"),
  title: { default: `${APP_NAME} — coffre de vie et de succession`, template: `%s · ${APP_NAME}` },
  description: DESCRIPTION,
  applicationName: APP_NAME,
  // The preview of a link shared on WhatsApp, Telegram, SMS (image: app/opengraph-image.jpg).
  openGraph: { title: `${APP_NAME} — coffre de vie et de succession`, description: DESCRIPTION, siteName: APP_NAME, locale: "fr_FR", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#07090e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme, lang and the i18n-wait class are set by the boot script before React loads: not a hydration mismatch.
    <html lang="fr" data-scroll-behavior="smooth" className={`${fraunces.variable} ${manrope.variable} ${cinzel.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT + LANG_BOOT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
