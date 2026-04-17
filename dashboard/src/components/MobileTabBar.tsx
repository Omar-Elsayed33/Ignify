"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import {
  LayoutDashboard,
  FileText,
  PenSquare,
  Calendar,
  MoreHorizontal,
} from "lucide-react";
import { clsx } from "clsx";

const TABS = [
  {
    key: "home",
    href: "/dashboard",
    icon: LayoutDashboard,
    ar: "الرئيسية",
    en: "Home",
    matchPrefix: ["/dashboard"],
  },
  {
    key: "plans",
    href: "/plans",
    icon: FileText,
    ar: "الخطط",
    en: "Plans",
    matchPrefix: ["/plans"],
  },
  {
    key: "content",
    href: "/content-gen",
    icon: PenSquare,
    ar: "محتوى",
    en: "Content",
    matchPrefix: ["/content-gen", "/content", "/creative", "/video"],
  },
  {
    key: "scheduler",
    href: "/scheduler",
    icon: Calendar,
    ar: "الجدولة",
    en: "Schedule",
    matchPrefix: ["/scheduler"],
  },
  {
    key: "more",
    href: "/settings",
    icon: MoreHorizontal,
    ar: "المزيد",
    en: "More",
    matchPrefix: ["/settings", "/profile", "/notifications", "/team", "/billing", "/integrations", "/help", "/changelog"],
  },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <nav
      role="navigation"
      aria-label={isAr ? "التنقل السريع" : "Quick nav"}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline/10 bg-surface-container-lowest/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-between px-2 py-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.matchPrefix.some((p) => pathname?.startsWith(p));
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                className={clsx(
                  "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] transition-colors",
                  active
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                <Icon
                  className={clsx("h-5 w-5", active && "text-primary")}
                  aria-hidden="true"
                />
                <span className="font-medium">{isAr ? tab.ar : tab.en}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
