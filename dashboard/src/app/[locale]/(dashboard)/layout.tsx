"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter, usePathname } from "@/i18n/navigation";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import BrandedLayout from "@/components/BrandedLayout";
import QuotaBanner from "@/components/QuotaBanner";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
import NPSWidget from "@/components/NPSWidget";
import SubscriptionWall from "@/components/SubscriptionWall";
import { Menu, X } from "lucide-react";
import { api } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user, tenant } = useAuthStore();
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

  // Fallback: if a referral code is still sitting in localStorage (register-time
  // redemption failed or user arrived via direct link), try once now that we have a JWT.
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    let code: string | null = null;
    try {
      code = localStorage.getItem("ignify_ref_code");
    } catch {
      return;
    }
    if (!code) return;
    (async () => {
      try {
        await api.post("/api/v1/referrals/redeem", { code });
      } catch {
        // swallow — endpoint is a no-op on invalid/self-refer anyway
      } finally {
        try {
          localStorage.removeItem("ignify_ref_code");
        } catch {
          // ignore
        }
      }
    })();
  }, [hydrated, isAuthenticated]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-on-surface/30 backdrop-blur-sm lg:hidden"
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
        <div className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-surface/80 px-4 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-container-low"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-headline text-lg font-bold brand-gradient-text">Ignify</span>
        </div>

        <QuotaBanner />
        <EmailVerificationBanner />
        <div className="pb-20 lg:pb-0">
          <BrandedLayout>{children}</BrandedLayout>
        </div>
        {/* Subscription gate: show wall for non-superadmin tenants without active subscription */}
        {hydrated &&
          isAuthenticated &&
          user?.role !== "superadmin" &&
          tenant &&
          !tenant.subscription_active &&
          !pathname.includes("/billing") &&
          !pathname.includes("/onboarding") && (
            <SubscriptionWall />
          )}
      </main>

      <NPSWidget />
      <MobileTabBar />
    </div>
  );
}
