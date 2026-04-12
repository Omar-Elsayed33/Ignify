import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ignify.ai";

const paths = [
  "",
  "/features",
  "/pricing",
  "/contact",
  "/about",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refund",
];

const locales = ["en", "ar"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    for (const path of paths) {
      const prefix = locale === "en" ? "" : `/${locale}`;
      entries.push({
        url: `${BASE_URL}${prefix}${path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: path === "" ? 1.0 : 0.7,
      });
    }
  }
  return entries;
}
