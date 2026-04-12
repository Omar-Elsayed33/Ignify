"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter, usePathname } from "@/i18n/navigation";
import Sidebar from "@/components/Sidebar";
import BrandedLayout from "@/components/BrandedLayout";
import QuotaBanner from "@/components/QuotaBanner";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
import { Menu, X } from "lucide-react";
import { api } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    if (pathname.includes("/onboarding")) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await api.get<{ completed: boolean }>("/api/v1/onboarding/status");
        if (!cancelled && !status.completed) {
          router.replace("/onboarding/business");
        }
      } catch {
        // ignore; keep user on current page
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isAuthenticated]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="hidden lg:block">
        <Sidebar />
      </div>
      {mobileOpen && (
        <div className="fixed inset-y-0 start-0 z-40 lg:hidden">
          <Sidebar />
        </div>
      )}

      <main className="lg:ps-64">
        <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-lg font-bold text-primary">Ignify</span>
        </div>

        <QuotaBanner />
        <EmailVerificationBanner />
        <BrandedLayout>{children}</BrandedLayout>
      </main>
    </div>
  );
}
