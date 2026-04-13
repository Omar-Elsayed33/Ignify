"use client";

import { useEffect, useMemo, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Languages,
  Flame,
  Calendar,
  HelpCircle,
  FlaskConical,
  Shield,
  Database,
  Building2,
  Radio,
  PenSquare,
  Send,
  MessageCircle,
  LineChart,
  Wrench,
  Bell,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { api } from "@/lib/api";

interface NavItem {
  key: string;
  href: string;
  icon: React.ElementType;
  perm?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  /** Optional top-level href — if set, clicking the group header navigates here */
  href?: string;
  items: NavItem[];
}

export default function Sidebar() {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [isAgency, setIsAgency] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  // Top-level "home" items (no children) + grouped parents
  const homeItem: NavItem = { key: "dashboard", href: "/dashboard", icon: LayoutDashboard };
  const plansItem: NavItem = { key: "plans", href: "/plans", icon: Compass };

  const groups: NavGroup[] = [
    {
      id: "create",
      label: t("createGroup"),
      icon: PenSquare,
      items: [
        { key: "contentGen", href: "/content-gen", icon: Sparkles },
        { key: "creativeGen", href: "/creative/generate", icon: ImageIcon },
        { key: "videoGen", href: "/video/generate", icon: Video },
        { key: "content", href: "/content", icon: FileText },
        { key: "creative", href: "/creative", icon: Palette },
      ],
    },
    {
      id: "distribute",
      label: t("distributeGroup"),
      icon: Send,
      items: [
        { key: "scheduler", href: "/scheduler", icon: Calendar },
        { key: "social", href: "/social", icon: Share2 },
        { key: "ads", href: "/ads", icon: Megaphone },
        { key: "seo", href: "/seo", icon: Search },
        { key: "mySiteSEO", href: "/seo/my-site", icon: Globe },
        { key: "campaigns", href: "/campaigns", icon: Target },
      ],
    },
    {
      id: "engage",
      label: t("engageGroup"),
      icon: MessageCircle,
      items: [
        { key: "inbox", href: "/inbox", icon: Inbox },
        { key: "conversations", href: "/conversations", icon: MessagesSquare },
        { key: "leads", href: "/leads", icon: Users },
        { key: "assistant", href: "/assistant", icon: Bot },
      ],
    },
    {
      id: "insights",
      label: t("insightsGroup"),
      icon: LineChart,
      items: [
        { key: "analyticsDash", href: "/analytics/overview", icon: BarChart3 },
        { key: "analytics", href: "/analytics", icon: BarChart3 },
        { key: "competitors", href: "/competitors", icon: Eye },
      ],
    },
    {
      id: "workspace",
      label: t("workspaceGroup"),
      icon: Wrench,
      items: [
        { key: "businessProfile", href: "/settings/business-profile", icon: Building2 },
        { key: "channels", href: "/settings/channels", icon: Radio },
        { key: "aiAgents", href: "/settings/ai-agents", icon: Brain },
        { key: "integrations", href: "/integrations", icon: Puzzle },
        { key: "team", href: "/settings/team", icon: UserPlus },
        { key: "billing", href: "/billing", icon: CreditCard, perm: "billing" },
        ...(isAgency
          ? [{ key: "whiteLabel", href: "/settings/white-label", icon: Shield }]
          : []),
        { key: "notifications", href: "/notifications", icon: Bell },
        { key: "settings", href: "/settings", icon: Settings },
        { key: "help", href: "/help", icon: HelpCircle },
      ],
    },
  ];

  const userRole = user?.role;
  const visibleGroups: NavGroup[] = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => !it.perm || hasPermission(userRole, it.perm)),
    }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) => pathname === href;
  const groupHasActive = (g: NavGroup) => g.items.some((it) => isActive(it.href));

  // Auto-open the group containing the active route
  const activeGroupId = useMemo(
    () => visibleGroups.find(groupHasActive)?.id,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, isAgency]
  );

  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => (prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }));
    }
  }, [activeGroupId]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const switchLocale = () => {
    router.push(pathname, { locale: otherLocale });
  };

  const renderTopItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
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
        <Icon className={clsx("h-5 w-5 shrink-0", active && "text-primary")} />
        {!collapsed && <span>{t(item.key)}</span>}
      </Link>
    );
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
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {/* Pinned top items */}
        <ul className="mb-3 space-y-1">
          <li>{renderTopItem(homeItem)}</li>
          <li>{renderTopItem(plansItem)}</li>
        </ul>

        {/* Collapsible groups */}
        <ul className="space-y-1">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = !!openGroups[group.id];
            const hasActiveChild = groupHasActive(group);

            // When sidebar is collapsed: show a single icon button that navigates to the first child
            if (collapsed) {
              const first = group.items[0];
              const FirstIcon = first.icon;
              return (
                <li key={group.id}>
                  <Link
                    href={first.href}
                    title={group.label}
                    className={clsx(
                      "flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                      hasActiveChild
                        ? "bg-surface-container-lowest text-primary shadow-soft"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    )}
                  >
                    <FirstIcon className="h-5 w-5 shrink-0" />
                  </Link>
                </li>
              );
            }

            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                    hasActiveChild
                      ? "text-on-surface"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  )}
                >
                  <GroupIcon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-start">{group.label}</span>
                  <ChevronDown
                    className={clsx(
                      "h-4 w-4 shrink-0 text-on-surface-variant/70 transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {isOpen && (
                  <ul className="ms-4 mt-1 space-y-0.5 border-s border-outline/20 ps-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <li key={item.key}>
                          <Link
                            href={item.href}
                            className={clsx(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                              active
                                ? "bg-surface-container-lowest font-medium text-primary shadow-soft"
                                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                            )}
                          >
                            <Icon className={clsx("h-4 w-4 shrink-0", active && "text-primary")} />
                            <span className="truncate">{t(item.key)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
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

        {/* User avatar — clickable */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex w-full items-center gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-soft transition-all hover:bg-surface-container"
          >
            <Avatar.Root className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <Avatar.Fallback className="text-xs font-semibold text-white">
                {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </Avatar.Fallback>
            </Avatar.Root>
            {!collapsed && (
              <div className="min-w-0 flex-1 text-start">
                <p className="truncate text-sm font-semibold text-on-surface">
                  {user?.full_name || "User"}
                </p>
                <p className="truncate text-[10px] uppercase tracking-widest text-on-surface-variant/70">
                  {user?.email || ""}
                </p>
              </div>
            )}
          </button>

          {/* User menu popup */}
          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute bottom-full end-0 z-50 mb-2 w-52 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-outline/10">
                {/* User info header */}
                <div className="border-b border-outline/10 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-on-surface">
                    {user?.full_name || "User"}
                  </p>
                  <p className="truncate text-xs text-on-surface-variant">{user?.email || ""}</p>
                </div>
                {/* Actions */}
                <div className="p-1.5">
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <UserIcon className="h-4 w-4 text-on-surface-variant" />
                    {t("editProfile")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                      router.push("/login");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error-container/30"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("logout")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
