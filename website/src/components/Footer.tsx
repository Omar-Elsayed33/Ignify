"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Flame, Twitter, Linkedin, Github, Youtube } from "lucide-react";

export default function Footer() {
  const t = useTranslations("footer");

  const columns = [
    {
      title: t("product"),
      links: [
        { label: t("features"), href: "/features" },
        { label: t("pricing"), href: "/pricing" },
        { label: t("integrations"), href: "#" },
        { label: t("changelog"), href: "#" },
      ],
    },
    {
      title: t("company"),
      links: [
        { label: t("about"), href: "/about" },
        { label: t("careers"), href: "#" },
        { label: t("blog"), href: "#" },
        { label: t("press"), href: "#" },
      ],
    },
    {
      title: t("support"),
      links: [
        { label: t("help_center"), href: "#" },
        { label: t("documentation"), href: "#" },
        { label: t("community"), href: "#" },
        { label: t("status"), href: "#" },
      ],
    },
    {
      title: t("legal"),
      links: [
        { label: t("privacy"), href: "#" },
        { label: t("terms"), href: "#" },
        { label: t("cookies"), href: "#" },
      ],
    },
  ];

  const socialLinks = [
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Github, href: "#", label: "GitHub" },
    { icon: Youtube, href: "#", label: "YouTube" },
  ];

  return (
    <footer className="bg-secondary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* Top section */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="gradient-primary p-2 rounded-lg">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">
                Ign<span className="text-primary">ify</span>
              </span>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-xs">
              {t("description")}
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-primary transition-colors duration-200"
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-semibold text-sm mb-4">{column.title}</h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link
                        href={link.href}
                        className="text-sm text-white/60 hover:text-primary transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-white/60 hover:text-primary transition-colors duration-200"
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

        {/* Divider */}
        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/40">
              &copy; {new Date().getFullYear()} {t("copyright")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
