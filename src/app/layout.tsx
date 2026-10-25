import type { Metadata, Viewport } from "next";
import { Cinzel, Fraunces, Manrope, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/config";
import { LANG_BOOT } from "@/lib/i18n";
import { THEME_BOOT } from "@/lib/theme";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz", "SOFT"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
// « Noir et or » theme only: downloaded by the browser only when that theme is on.
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", display: "swap", preload: false });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — tout retrouver, tout régler`, template: `%s · ${APP_NAME}` },
  description: "Le service qui aide les familles à tout retrouver et à tout régler, de son vivant comme après.",
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  themeColor: "#f7f2e9",
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
