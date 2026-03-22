"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { clsx } from "clsx";
import * as Avatar from "@radix-ui/react-avatar";
import {
  LayoutDashboard,
  FileText,
  Palette,
  Megaphone,
  Search,
  Share2,
  Users,
  Target,
  BarChart3,
  Eye,
  Globe,
  MessageSquare,
  MessagesSquare,
  Bot,
  Puzzle,
  Settings,
  CreditCard,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Languages,
  Flame,
} from "lucide-react";

interface NavItem {
  key: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export default function Sidebar() {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const locale = pathname.split("/")[1] || "en";
  const otherLocale = locale === "en" ? "ar" : "en";

  const sections: NavSection[] = [
    {
      label: t("marketing"),
      items: [
        { key: "dashboard", href: `/${locale}/dashboard`, icon: LayoutDashboard },
        { key: "content", href: `/${locale}/content`, icon: FileText },
        { key: "creative", href: `/${locale}/creative`, icon: Palette },
        { key: "ads", href: `/${locale}/ads`, icon: Megaphone },
        { key: "seo", href: `/${locale}/seo`, icon: Search },
        { key: "social", href: `/${locale}/social`, icon: Share2 },
      ],
    },
    {
      label: t("management"),
      items: [
        { key: "leads", href: `/${locale}/leads`, icon: Users },
        { key: "campaigns", href: `/${locale}/campaigns`, icon: Target },
        { key: "analytics", href: `/${locale}/analytics`, icon: BarChart3 },
        { key: "competitors", href: `/${locale}/competitors`, icon: Eye },
      ],
    },
    {
      label: t("communication"),
      items: [
        { key: "channels", href: `/${locale}/channels`, icon: Globe },
        { key: "conversations", href: `/${locale}/conversations`, icon: MessagesSquare },
        { key: "assistant", href: `/${locale}/assistant`, icon: Bot },
      ],
    },
    {
      label: t("settingsGroup"),
      items: [
        { key: "integrations", href: `/${locale}/integrations`, icon: Puzzle },
        { key: "settings", href: `/${locale}/settings`, icon: Settings },
        { key: "billing", href: `/${locale}/billing`, icon: CreditCard },
        { key: "team", href: `/${locale}/team`, icon: UserPlus },
      ],
    },
  ];

  const isActive = (href: string) => pathname === href;

  const switchLocale = () => {
    const newPath = pathname.replace(`/${locale}`, `/${otherLocale}`);
    router.push(newPath);
  };

  return (
    <aside
      className={clsx(
        "fixed start-0 top-0 z-40 flex h-screen flex-col border-e border-border bg-surface transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Flame className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-xl font-bold text-secondary">Ignify</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.key}>
                    <a
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      )}
                      title={collapsed ? t(item.key) : undefined}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{t(item.key)}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-3">
        {/* Language switcher */}
        <button
          onClick={switchLocale}
          className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <Languages className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{otherLocale === "ar" ? "العربية" : "English"}</span>}
        </button>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mb-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          title={t("collapse")}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span>{t("collapse")}</span>
            </>
          )}
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <Avatar.Root className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary">
            <Avatar.Image
              src={user?.avatarUrl}
              alt={user?.fullName || "User"}
              className="h-full w-full object-cover"
            />
            <Avatar.Fallback className="text-xs font-semibold text-white">
              {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
            </Avatar.Fallback>
          </Avatar.Root>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {user?.fullName || "User"}
              </p>
              <p className="truncate text-xs text-text-muted">
                {user?.email || "user@example.com"}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
