"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import Sidebar from "@/components/Sidebar";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push(`/${locale}/login`);
    }
  }, [hydrated, isAuthenticated, router, locale]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop always visible, mobile toggled */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      {mobileOpen && (
        <div className="fixed inset-y-0 start-0 z-40 lg:hidden">
          <Sidebar />
        </div>
      )}

      {/* Main content */}
      <main className="lg:ps-64">
        {/* Mobile header */}
        <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-lg font-bold text-primary">Ignify</span>
        </div>

        {children}
      </main>
    </div>
  );
}
