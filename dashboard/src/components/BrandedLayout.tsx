"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

interface BrandConfig {
  white_label_enabled: boolean;
  app_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  colors: Record<string, string> | null;
  footer_text: string | null;
  hide_powered_by: boolean;
  is_agency: boolean;
}

const STORAGE_KEY = "ignify:brand";

export default function BrandedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const [brand, setBrand] = useState<BrandConfig | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      return cached ? (JSON.parse(cached) as BrandConfig) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<BrandConfig>("/api/v1/white-label/settings");
        if (!cancelled) {
          setBrand(data);
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch {
            // ignore
          }
        }
      } catch {
        // Non-fatal; default branding stays.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!brand || !brand.white_label_enabled) return;
    if (typeof document === "undefined") return;

    // Document title
    if (brand.app_name) document.title = brand.app_name;

    // Favicon
    if (brand.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = brand.favicon_url;
    }

    // CSS variables
    const root = document.documentElement;
    if (brand.colors?.primary) root.style.setProperty("--color-primary", brand.colors.primary);
    if (brand.colors?.secondary) root.style.setProperty("--color-secondary", brand.colors.secondary);
    root.setAttribute("data-brand-logo", brand.logo_url || "");
    root.setAttribute("data-brand-app-name", brand.app_name || "");
  }, [brand]);

  const showFooter = brand?.white_label_enabled && (brand.footer_text || !brand.hide_powered_by);

  return (
    <>
      {children}
      {showFooter && (
        <footer className="border-t border-border bg-surface px-6 py-4 text-center text-xs text-text-muted">
          {brand?.footer_text}
          {!brand?.hide_powered_by && (
            <span className="ms-2 text-text-muted">Powered by Ignify</span>
          )}
        </footer>
      )}
      {!brand?.white_label_enabled && !brand?.hide_powered_by && null}
    </>
  );
}
