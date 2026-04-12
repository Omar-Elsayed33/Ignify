"use client";

import React, { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

export default function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/features", label: t("features") },
    { href: "/solutions", label: t("solutions") },
    { href: "/pricing", label: t("pricing") },
    { href: "/contact", label: t("contact") },
  ];

  const switchLocale = locale === "en" ? "ar" : "en";
  const registerHref = `${DASHBOARD_URL}/${locale}/register`;
  const loginHref = `${DASHBOARD_URL}/${locale}/login`;

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl shadow-soft"
          : "bg-background/60 backdrop-blur-xl"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex items-center">
            <Logo size={36} locale={locale} />
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 hover:text-primary ${
                  pathname === link.href
                    ? "text-primary"
                    : "text-on-surface/70"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <a
              href={`/${switchLocale}${pathname}`}
              className="text-sm font-semibold text-on-surface/70 hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-surface-container-low"
            >
              {t("language")}
            </a>
            <a
              href={loginHref}
              className="text-sm font-semibold text-on-surface/80 hover:text-primary px-3 py-2"
            >
              {t("login")}
            </a>
            <a
              href={registerHref}
              className="brand-gradient-bg text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:scale-[1.02] transition-transform shadow-soft"
            >
              {t("register")}
            </a>
          </div>

          <button
            className="lg:hidden p-2 text-on-surface"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bg-background/95 backdrop-blur-xl z-40">
          <div className="px-6 py-8 space-y-5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block text-xl font-semibold py-2 ${
                  pathname === link.href ? "text-primary" : "text-on-surface/80"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="h-px bg-outline-variant/20 my-4" />
            <a
              href={`/${switchLocale}${pathname}`}
              className="block text-base font-semibold text-on-surface/70 py-2"
            >
              {t("language")}
            </a>
            <div className="flex flex-col gap-3 pt-4">
              <a
                href={loginHref}
                className="w-full text-center py-3 rounded-xl bg-surface-container-low font-semibold"
              >
                {t("login")}
              </a>
              <a
                href={registerHref}
                className="w-full text-center py-3 rounded-xl brand-gradient-bg text-white font-semibold"
              >
                {t("register")}
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
