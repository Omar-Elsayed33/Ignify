"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { Flame, LayoutDashboard, Building2, Cpu, Settings, ChevronLeft, Network, CreditCard, Sparkles } from "lucide-react";
import { clsx } from "clsx";

const adminNav = [
  { key: "dashboard", href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { key: "tenants", href: "/admin/tenants", icon: Building2, label: "Tenants" },
  { key: "plans", href: "/admin/plans", icon: CreditCard, label: "Plans" },
  { key: "agents", href: "/admin/agents", icon: Network, label: "Agents" },
  { key: "aiProviders", href: "/admin/ai-providers", icon: Cpu, label: "AI Providers" },
  { key: "ai-usage", href: "/admin/ai-usage", icon: Sparkles, label: "AI Usage" },
  { key: "settings", href: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && (!isAuthenticated || (user?.role !== "superadmin" && user?.role !== "owner"))) {
      router.push("/login");
    }
  }, [hydrated, isAuthenticated, user, router]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed start-0 top-0 z-40 flex h-screen w-64 flex-col border-e border-border bg-secondary">
        <div className="flex h-16 items-center gap-2 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Flame className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const active = pathname.includes(item.key === "dashboard" ? "/admin/dashboard" : item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      <main className="flex-1 ps-64">{children}</main>
    </div>
  );
}
