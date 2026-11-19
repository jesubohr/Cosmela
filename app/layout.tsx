import type { Metadata, Viewport } from "next";
import { Newsreader, Onest } from "next/font/google";
import { Providers } from "@/components/providers";
import { siteUrl } from "@/lib/seo";
import "./globals.css";

const onest = Onest({ subsets: ["latin"], variable: "--font-onest", display: "swap" });
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: "Cosmela", template: "%s · Cosmela" },
  description: "Agenda, fichas clínicas y consentimientos para cosmetólogas en Colombia.",
  applicationName: "Cosmela",
  appleWebApp: { capable: true, title: "Cosmela", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5B2A86" },
    { media: "(prefers-color-scheme: dark)", color: "#151118" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" suppressHydrationWarning className={`${onest.variable} ${newsreader.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
