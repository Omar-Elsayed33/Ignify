"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { Loader2, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

interface TenantRow {
  tenant_id: string;
  tenant_name: string;
  plan_slug: string | null;
  monthly_limit_usd: number;
  usage_usd: number;
  remaining_usd: number;
  usage_pct: number;
  usage_synced_at: string | null;
  has_key: boolean;
}

interface AdminAIUsage {
  tenants: TenantRow[];
  total_tenants: number;
  total_usage_usd: number;
  total_limit_usd: number;
}

function UsageBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "bg-error" : pct >= 70 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-container-high">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-medium ${pct >= 90 ? "text-error" : "text-text-secondary"}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function AdminAIUsagePage() {
  const t = useTranslations("AIUsage");
  const locale = useLocale();
  const [data, setData] = useState<AdminAIUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<AdminAIUsage>("/api/v1/ai-usage/admin")
      .then(setData)
      .catch((e) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <DashboardHeader title={t("adminTitle")} />
      <div className="space-y-6 p-6">

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-error/30 bg-error/5 p-4">
            <AlertCircle className="h-5 w-5 text-error" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft">
                <p className="text-xs text-text-secondary mb-1">{t("tenant")}s</p>
                <p className="text-2xl font-bold text-on-surface">{data.total_tenants}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft">
                <p className="text-xs text-text-secondary mb-1">{t("totalUsage")}</p>
                <p className="text-2xl font-bold text-on-surface">${data.total_usage_usd.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft">
                <p className="text-xs text-text-secondary mb-1">{t("totalLimit")}</p>
                <p className="text-2xl font-bold text-on-surface">${data.total_limit_usd.toFixed(2)}</p>
              </div>
            </div>

            {/* Refresh + table */}
            <div className="rounded-2xl bg-surface-container-lowest shadow-soft overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-on-surface">{t("adminTitle")}</span>
                </div>
                <button
                  onClick={load}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  {locale === "ar" ? "تحديث" : "Refresh"}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-container text-xs text-text-secondary">
                      <th className="px-5 py-3 text-start">{t("tenant")}</th>
                      <th className="px-5 py-3 text-start">{t("plan")}</th>
                      <th className="px-5 py-3 text-end">{t("usedLabel")}</th>
                      <th className="px-5 py-3 text-end">{t("limit")}</th>
                      <th className="px-5 py-3 text-start">{t("pct")}</th>
                      <th className="px-5 py-3 text-start">{t("lastSync")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tenants.map((row) => (
                      <tr key={row.tenant_id} className="border-b border-border/50 hover:bg-surface-container/50">
                        <td className="px-5 py-3 font-medium text-on-surface">
                          <div className="flex items-center gap-2">
                            {!row.has_key && (
                              <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-xs text-text-secondary">
                                {t("noKey")}
                              </span>
                            )}
                            {row.tenant_name}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                            {row.plan_slug ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-end font-mono text-on-surface">
                          ${row.usage_usd.toFixed(3)}
                        </td>
                        <td className="px-5 py-3 text-end font-mono text-text-secondary">
                          ${row.monthly_limit_usd.toFixed(2)}
                        </td>
                        <td className="px-5 py-3">
                          <UsageBar pct={row.usage_pct} />
                        </td>
                        <td className="px-5 py-3 text-xs text-text-secondary">
                          {row.usage_synced_at
                            ? new Date(row.usage_synced_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
