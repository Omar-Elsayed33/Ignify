"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Twitter, Linkedin, Instagram, Youtube, Heart } from "lucide-react";
import Logo from "./Logo";

export default function Footer() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const pathname = usePathname();
  const switchLocale = locale === "en" ? "ar" : "en";

  const columns = [
    {
      title: t("product"),
      links: [
        { label: t("features"), href: "/features" },
        { label: t("solutions"), href: "/solutions" },
        { label: t("pricing"), href: "/pricing" },
        { label: t("changelog"), href: "#" },
      ],
    },
    {
      title: t("solutionsCol"),
      links: [
        { label: t("solutions_ecommerce"), href: "/solutions#ecommerce" },
        { label: t("solutions_restaurants"), href: "/solutions#restaurants" },
        { label: t("solutions_clinics"), href: "/solutions#clinics" },
        { label: t("solutions_realestate"), href: "/solutions#realestate" },
      ],
    },
    {
      title: t("company"),
      links: [
        { label: t("about"), href: "/about" },
        { label: t("contact"), href: "/contact" },
        { label: t("blog"), href: "#" },
        { label: t("careers"), href: "#" },
      ],
    },
    {
      title: t("legal"),
      links: [
        { label: t("legalLinks.terms"), href: "/legal/terms" },
        { label: t("legalLinks.privacy"), href: "/legal/privacy" },
        { label: t("legalLinks.refund"), href: "/legal/refund" },
      ],
    },
  ];

  const socials = [
    { Icon: Twitter, href: "#", label: "Twitter" },
    { Icon: Linkedin, href: "#", label: "LinkedIn" },
    { Icon: Instagram, href: "#", label: "Instagram" },
    { Icon: Youtube, href: "#", label: "YouTube" },
  ];

  return (
    <footer className="bg-surface-container-low">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-10 mb-12">
          <div className="col-span-2">
            <Logo size={40} locale={locale} />
            <p className="text-on-surface/60 text-sm leading-relaxed mt-5 max-w-xs">
              {t("description")}
            </p>
            <div className="flex gap-2 mt-6">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface/70 hover:brand-gradient-bg hover:text-white transition-all"
                >
                  <s.Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-semibold text-sm mb-4 text-on-surface">{col.title}</h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") && !link.href.includes("#") ? (
                      <Link
                        href={link.href}
                        className="text-sm text-on-surface/60 hover:text-primary transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-on-surface/60 hover:text-primary transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-outline-variant/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <p className="text-on-surface/50">
              &copy; {new Date().getFullYear()} {t("copyright")}
            </p>
            <div className="flex items-center gap-4 text-on-surface/60">
              <a
                href={`/${switchLocale}${pathname}`}
                className="hover:text-primary font-semibold"
              >
                {t("languageToggle")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
