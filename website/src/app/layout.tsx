import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ignify - Ignite Your Marketing with AI",
  description:
    "The all-in-one AI-powered marketing platform that creates content, manages campaigns, optimizes ads, and drives growth.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
