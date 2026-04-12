"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuthStore } from "@/store/auth.store";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { clsx } from "clsx";
import { hasPermission } from "@/lib/rbac";
import * as Avatar from "@radix-ui/react-avatar";
import {
  LayoutDashboard,
  Compass,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Video,
  Palette,
  Megaphone,
  Search,
  Share2,
  Users,
  Target,
  BarChart3,
  Eye,
  Globe,
  MessagesSquare,
  Inbox,
  Bot,
  Brain,
  Puzzle,
  Settings,
  CreditCard,
  UserPlus,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Languages,
  Flame,
  Calendar,
  HelpCircle,
  FlaskConical,
  Shield,
  Database,
} from "lucide-react";
import { api } from "@/lib/api";

interface NavItem {
  key: string;
  href: string;
  icon: React.ElementType;
  /** Optional permission required to see this item */
  perm?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export default function Sidebar() {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [isAgency, setIsAgency] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ is_agency: boolean }>("/api/v1/white-label/settings");
        if (!cancelled) setIsAgency(Boolean(res.is_agency));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const otherLocale = locale === "en" ? "ar" : "en";

  const sections: NavSection[] = [
    {
      label: t("marketing"),
      items: [
        { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
        { key: "plans", href: "/plans", icon: Compass },
        { key: "contentGen", href: "/content-gen", icon: Sparkles },
        { key: "experiments", href: "/content-gen/experiments", icon: FlaskConical },
        { key: "content", href: "/content", icon: FileText },
        { key: "creativeGen", href: "/creative/generate", icon: ImageIcon },
        { key: "videoGen", href: "/video/generate", icon: Video },
        { key: "creative", href: "/creative", icon: Palette },
        { key: "ads", href: "/ads", icon: Megaphone },
        { key: "seo", href: "/seo", icon: Search },
        { key: "social", href: "/social", icon: Share2 },
        { key: "scheduler", href: "/scheduler", icon: Calendar },
      ],
    },
    {
      label: t("management"),
      items: [
        { key: "leads", href: "/leads", icon: Users },
        { key: "campaigns", href: "/campaigns", icon: Target },
        { key: "analytics", href: "/analytics", icon: BarChart3 },
        { key: "analyticsDash", href: "/analytics/overview", icon: BarChart3 },
        { key: "competitors", href: "/competitors", icon: Eye },
      ],
    },
    {
      label: t("communication"),
      items: [
        { key: "channels", href: "/channels", icon: Globe },
        { key: "conversations", href: "/conversations", icon: MessagesSquare },
        { key: "inbox", href: "/inbox", icon: Inbox },
        { key: "assistant", href: "/assistant", icon: Bot },
      ],
    },
    {
      label: t("settingsGroup"),
      items: [
        { key: "profile", href: "/profile", icon: UserCircle },
        { key: "integrations", href: "/integrations", icon: Puzzle },
        { key: "settings", href: "/settings", icon: Settings },
        { key: "aiAgents", href: "/settings/ai-agents", icon: Brain },
        { key: "knowledgeBase", href: "/settings/knowledge", icon: Database },
        ...(isAgency
          ? [{ key: "whiteLabel", href: "/settings/white-label", icon: Shield }]
          : []),
        { key: "billing", href: "/billing", icon: CreditCard, perm: "billing" },
        { key: "team", href: "/settings/team", icon: UserPlus },
        { key: "help", href: "/help", icon: HelpCircle },
      ],
    },
  ];

  const userRole = user?.role;
  const visibleSections: NavSection[] = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => !it.perm || hasPermission(userRole, it.perm)),
    }))
    .filter((s) => s.items.length > 0);

  const isActive = (href: string) => pathname === href;

  const switchLocale = () => {
    router.push(pathname, { locale: otherLocale });
  };

  return (
    <aside
      className={clsx(
        "fixed start-0 top-0 z-40 flex h-screen flex-col bg-surface-container-low transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-soft">
          <Flame className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="font-headline text-xl font-bold leading-none tracking-tight text-on-surface">
              Ignify
            </h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Marketing OS
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.label} className="mb-6">
            {!collapsed && (
              <p className="mb-3 px-3 font-headline text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/70">
                {section.label}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        active
                          ? "bg-surface-container-lowest text-primary shadow-soft"
                          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                      )}
                      title={collapsed ? t(item.key) : undefined}
                    >
                      <Icon className={clsx("h-5 w-5 shrink-0 rtl:rotate-0", active && "text-primary")} />
                      {!collapsed && <span>{t(item.key)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-3">
        {/* Language switcher */}
        <button
          onClick={switchLocale}
          className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        >
          <Languages className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{otherLocale === "ar" ? "العربية" : "English"}</span>}
        </button>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mb-3 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          title={t("collapse")}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 shrink-0 rtl:rotate-180" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0 rtl:rotate-180" />
              <span>{t("collapse")}</span>
            </>
          )}
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-soft">
          <Avatar.Root className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Avatar.Fallback className="text-xs font-semibold text-white">
              {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </Avatar.Fallback>
          </Avatar.Root>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-on-surface">
                {user?.full_name || "User"}
              </p>
              <p className="truncate text-[10px] uppercase tracking-widest text-on-surface-variant/70">
                {user?.email || ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
