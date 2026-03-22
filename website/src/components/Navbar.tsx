"use client";

import React, { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Menu, X, Flame } from "lucide-react";
import Button from "./Button";

export default function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/features", label: t("features") },
    { href: "/pricing", label: t("pricing") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ];

  const switchLocale = locale === "en" ? "ar" : "en";

  return (
    <nav
      className={`fixed top-0 start-0 end-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="gradient-primary p-2 rounded-lg">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-secondary">
              Ign<span className="gradient-text">ify</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 hover:text-primary ${
                  pathname === link.href
                    ? "text-primary"
                    : "text-secondary/70"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href={`/${switchLocale}${pathname}`}
              className="text-sm font-semibold text-secondary/70 hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-surface"
            >
              {t("language")}
            </a>
            <Button variant="ghost" size="sm">
              {t("login")}
            </Button>
            <Button variant="primary" size="sm">
              {t("register")}
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 text-secondary"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="px-4 py-6 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block text-base font-medium py-2 transition-colors ${
                  pathname === link.href
                    ? "text-primary"
                    : "text-secondary/70"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-gray-100" />
            <a
              href={`/${switchLocale}${pathname}`}
              className="block text-sm font-semibold text-secondary/70 py-2"
            >
              {t("language")}
            </a>
            <div className="flex flex-col gap-3 pt-2">
              <Button variant="secondary" size="md">
                {t("login")}
              </Button>
              <Button variant="primary" size="md">
                {t("register")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
