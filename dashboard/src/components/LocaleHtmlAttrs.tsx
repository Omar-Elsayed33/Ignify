"use client";

import { useEffect } from "react";

/** Syncs <html lang> and <html dir> to the active locale after hydration.
 * The root layout ships with `lang="ar" dir="rtl"` as the SSR default; this
 * component updates them client-side when the user navigates to `/en/*`. */
export default function LocaleHtmlAttrs({ locale }: { locale: string }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    el.lang = locale;
    el.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);
  return null;
}
