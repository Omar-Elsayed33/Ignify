"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { Flame, LayoutDashboard, Building2, Cpu, ChevronLeft } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";

const adminNav = [
  { key: "dashboard", href: "dashboard", icon: LayoutDashboard },
  { key: "tenants", href: "tenants", icon: Building2 },
  { key: "aiProviders", href: "ai-providers", icon: Cpu },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== "owner")) {
      router.push(`/${locale}/login`);
    }
  }, [hydrated, isAuthenticated, user, router, locale]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Admin Sidebar */}
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
              const href = `/${locale}/${item.href === "dashboard" ? "" : ""}${item.href}`;
              const active = pathname.includes(item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={`/${locale}/${item.href}`}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.key === "dashboard" ? "Dashboard" : item.key === "tenants" ? "Tenants" : "AI Providers"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href={`/${locale}/dashboard`}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ps-64">{children}</main>
    </div>
  );
}
