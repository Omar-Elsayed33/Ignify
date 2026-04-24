"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Sparkles, ArrowUpRight, RefreshCw, AlertTriangle, XCircle } from "lucide-react";
import { useLocale } from "next-intl";
import { api } from "@/lib/api";

interface AIUsage {
  monthly_limit_usd: number;
  usage_usd: number;
  remaining_usd: number;
  usage_pct: number;
  reset_at: string | null;
  has_key: boolean;
  // Phase 7 P4b: server-computed gate flags for widget banners.
  soft_warning?: boolean;
  blocked?: boolean;
  deep_runs_this_month?: number;
  deep_runs_cap?: number;
}

export default function AIUsageWidget() {
  const t = useTranslations("AIUsage");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [data, setData] = useState<AIUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AIUsage>("/api/v1/ai-usage/me")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft animate-pulse h-28" />
    );
  }

  if (!data) return null;

  const pct = data.usage_pct;
  const danger = pct >= 90;
  const warn = pct >= 70 && pct < 90;

  const barColor = danger
    ? "bg-error"
    : warn
    ? "bg-warning"
    : "bg-primary";

  const resetDate = data.reset_at
    ? new Date(data.reset_at).toLocaleDateString("ar-EG", { month: "long", day: "numeric" })
    : null;

  return (
    <div className={`rounded-2xl p-5 shadow-soft ${danger ? "bg-error-container" : "bg-surface-container-lowest"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className={`h-4 w-4 ${danger ? "text-on-error-container" : "text-primary"}`} />
          <span className={`text-sm font-semibold ${danger ? "text-on-error-container" : "text-on-surface"}`}>
            {t("title")}
          </span>
        </div>
        <Link
          href="/billing"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {t("upgrade")}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mb-2 flex items-end justify-between">
        <span className={`text-2xl font-bold ${danger ? "text-on-error-container" : "text-on-surface"}`}>
          ${data.remaining_usd.toFixed(2)}
        </span>
        <span className="text-xs text-text-secondary">
          {t("of")} ${data.monthly_limit_usd.toFixed(2)}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high mb-2">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span>{pct.toFixed(1)}% {t("used")}</span>
        {resetDate && (
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            {t("resetsOn")} {resetDate}
          </span>
        )}
      </div>

      {/* Phase 7 P4b: surface soft-warning (80%) and blocked (100%) states
          with actionable copy instead of just changing bar color. Users miss
          color changes; they don't miss a banner. */}
      {data.blocked && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-error-container p-3 text-xs text-on-error-container">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {isAr ? "تم الوصول إلى حد الاستخدام الشهري" : "Monthly AI budget reached"}
            </p>
            <p className="mt-0.5 opacity-90">
              {isAr
                ? "لن يمكنك تشغيل إجراءات جديدة من الذكاء الاصطناعي حتى تجديد الباقة أو الترقية."
                : "New AI actions are blocked until your plan renews or you upgrade."}
            </p>
            <Link
              href="/billing"
              className="mt-1 inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              {isAr ? "ترقية الآن" : "Upgrade now"}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
      {!data.blocked && data.soft_warning && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100 p-3 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {isAr ? "اقتربت من حد الاستخدام" : "Approaching your AI budget"}
            </p>
            <p className="mt-0.5 opacity-90">
              {isAr
                ? "استخدمت أكثر من ٨٠٪ من حد الشهر. فكّر في الترقية لتجنب التوقف."
                : "You've used over 80% of this month's budget. Consider upgrading to avoid interruption."}
            </p>
          </div>
        </div>
      )}

      {/* Deep-mode counter — only show if cap exists (Growth/Pro/Agency). */}
      {typeof data.deep_runs_cap === "number" && data.deep_runs_cap > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-container-high/60 px-3 py-2 text-xs text-on-surface-variant">
          <span>{isAr ? "خطط وضع Deep هذا الشهر" : "Deep plans this month"}</span>
          <span className="font-semibold tabular-nums text-on-surface">
            {data.deep_runs_this_month ?? 0} / {data.deep_runs_cap}
          </span>
        </div>
      )}
    </div>
  );
}
