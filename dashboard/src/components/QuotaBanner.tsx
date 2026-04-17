"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, X, Sparkles, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

interface UsageData {
  quota: Record<string, number>;
  used: Record<string, number>;
  remaining: Record<string, number>;
}

interface SubscriptionStatus {
  plan_code: string;
  status: string;
}

interface UserMe {
  created_at?: string | null;
}

const TRIAL_DAYS = 14;
const DISMISS_KEY_QUOTA = "ignify_banner_quota_dismissed";
const DISMISS_KEY_TRIAL = "ignify_banner_trial_dismissed";

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isPaidPlan(sub: SubscriptionStatus | null): boolean {
  if (!sub) return false;
  const code = (sub.plan_code || "").toLowerCase();
  const paidCodes = ["starter", "pro", "agency", "business", "enterprise"];
  const isActive = ["active", "trialing", "past_due"].includes(
    (sub.status || "").toLowerCase()
  );
  return isActive && paidCodes.includes(code);
}

export default function QuotaBanner() {
  const t = useTranslations("billing");
  const locale = useLocale();
  const isAr = locale === "ar";
  const { user } = useAuthStore();

  const [quotaWarn, setQuotaWarn] = useState(false);
  const [quotaDismissed, setQuotaDismissed] = useState(false);

  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [trialEnded, setTrialEnded] = useState(false);
  const [trialDismissed, setTrialDismissed] = useState(false);

  // session-scoped dismiss state
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY_QUOTA) === "1") setQuotaDismissed(true);
      if (sessionStorage.getItem(DISMISS_KEY_TRIAL) === "1") setTrialDismissed(true);
    } catch {
      // ignore
    }
  }, []);

  // Quota warning fetch (preserves original behavior)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await api.get<UsageData>("/api/v1/billing/usage");
        if (cancelled) return;
        const over = Object.keys(u.quota).some((k) => {
          const q = u.quota[k];
          const used = u.used[k] ?? 0;
          return q !== -1 && q > 0 && (used / q) * 100 >= 80;
        });
        setQuotaWarn(over);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Trial + subscription fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let createdAt: string | null | undefined = user?.created_at;
        if (!createdAt) {
          try {
            const me = await api.get<UserMe>("/api/v1/auth/me");
            createdAt = me?.created_at;
          } catch {
            // ignore
          }
        }
        const age = daysSince(createdAt ?? null);
        if (age == null) return;

        let sub: SubscriptionStatus | null = null;
        try {
          sub = await api.get<SubscriptionStatus>("/api/v1/billing/subscription");
        } catch {
          sub = null;
        }
        if (cancelled) return;
        if (isPaidPlan(sub)) {
          setTrialDaysLeft(null);
          setTrialEnded(false);
          return;
        }
        if (age <= TRIAL_DAYS) {
          setTrialDaysLeft(Math.max(0, TRIAL_DAYS - age));
          setTrialEnded(false);
        } else {
          setTrialDaysLeft(null);
          setTrialEnded(true);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismissTrial = () => {
    setTrialDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY_TRIAL, "1");
    } catch {
      // ignore
    }
  };

  const dismissQuota = () => {
    setQuotaDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY_QUOTA, "1");
    } catch {
      // ignore
    }
  };

  const showTrialActive = trialDaysLeft !== null && !trialDismissed;
  const showTrialEnded = trialEnded && !trialDismissed;
  const showQuota = quotaWarn && !quotaDismissed;

  if (!showTrialActive && !showTrialEnded && !showQuota) return null;

  return (
    <>
      {showTrialActive && (
        <div className="flex items-start gap-3 border-b border-primary/30 bg-primary/5 px-6 py-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="flex-1 text-sm text-on-surface">
            {isAr
              ? `تجربة Pro مجانية — ${trialDaysLeft} ${trialDaysLeft === 1 ? "يوم" : "أيام"} متبقية`
              : `Free Pro trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`}
          </p>
          <Link
            href="/billing/plans"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark"
          >
            {isAr ? "ترقية" : "Upgrade"}
          </Link>
          <button
            onClick={dismissTrial}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low"
            aria-label={isAr ? "إخفاء" : "dismiss"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showTrialEnded && (
        <div className="flex items-start gap-3 border-b border-amber-500/40 bg-amber-500/10 px-6 py-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-900 dark:text-amber-200">
            {isAr
              ? "انتهت الفترة التجريبية. بعض الميزات مقيّدة."
              : "Trial ended. Some features are now limited."}
          </p>
          <Link
            href="/billing/plans"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
          >
            {isAr ? "اختر باقة" : "Choose plan"}
          </Link>
          <button
            onClick={dismissTrial}
            className="rounded p-1 text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
            aria-label={isAr ? "إخفاء" : "dismiss"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showQuota && (
        <div className="flex items-start gap-3 border-b border-error/30 bg-error/5 px-6 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
          <p className="flex-1 text-sm text-error">
            {t("usage.warning80")}{" "}
            <Link
              href="/billing/plans"
              className="font-medium underline hover:opacity-80"
            >
              {t("currentPlan.upgrade")}
            </Link>
          </p>
          <button
            onClick={dismissQuota}
            className="rounded p-1 text-error hover:bg-error/10"
            aria-label="dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

