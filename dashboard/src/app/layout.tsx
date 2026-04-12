import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ignify - AI-Powered Marketing",
  description: "The all-in-one AI marketing platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
