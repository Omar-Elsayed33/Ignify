import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ignify — AI-Powered Marketing",
  description: "The all-in-one AI marketing platform",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#ab3500",
};

// Root layout owns <html> and <body> per Next.js 15 App Router requirement.
// Locale-specific `lang`/`dir` attributes are updated by the inner
// [locale]/layout.tsx at runtime via a small client hook (LocaleHtmlAttrs).
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="bg-surface text-on-surface antialiased">{children}</body>
    </html>
  );
}
