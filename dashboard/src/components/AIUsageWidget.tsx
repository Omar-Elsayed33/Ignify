"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Sparkles, ArrowUpRight, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

interface AIUsage {
  monthly_limit_usd: number;
  usage_usd: number;
  remaining_usd: number;
  usage_pct: number;
  reset_at: string | null;
  has_key: boolean;
}

export default function AIUsageWidget() {
  const t = useTranslations("AIUsage");
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
    </div>
  );
}
