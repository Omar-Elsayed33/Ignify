"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import StatCard from "@/components/StatCard";
import { Building2, Sparkles, Bot, DollarSign } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/api";

interface DashboardStats {
  total_tenants: number;
  total_users: number;
  total_channels: number;
  total_messages: number;
  active_campaigns: number;
}

interface PlanRow {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  title: string;
  status: string;
  version: number;
  created_at: string;
}

interface RunRow {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  agent_name: string;
  model: string | null;
  status: string;
  cost_usd: number | null;
  latency_ms: number | null;
  started_at: string;
}

interface CostStats {
  total_cost_usd: number;
  by_agent: { agent_name: string; total_cost_usd: number; run_count: number }[];
  by_tenant: unknown[];
}

export default function AdminDashboardPage() {
  const t = useTranslations("adminDash");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [cost, setCost] = useState<CostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>("/api/v1/admin/dashboard"),
      api.get<PlanRow[]>("/api/v1/admin/marketing-plans?limit=10"),
      api.get<RunRow[]>("/api/v1/admin/agent-runs?limit=20"),
      api.get<CostStats>("/api/v1/admin/stats/cost?days=30"),
    ])
      .then(([s, p, r, c]) => {
        setStats(s);
        setPlans(p);
        setRuns(r);
        setCost(c);
      })
      .catch((err) => setError(err?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  // Compute runs in last 24h from the runs list (approximation)
  const runs24h = runs.filter((r) => {
    const t = new Date(r.started_at).getTime();
    return Date.now() - t < 24 * 3600 * 1000;
  }).length;

  const activePlans = plans.filter((p) => p.status !== "archived").length;

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t("title")}</h1>
          <p className="text-xs text-text-muted">{t("subtitle")}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Building2}
                label={t("kpi.tenants")}
                value={String(stats?.total_tenants ?? 0)}
                change={0}
                iconColor="text-primary"
                iconBg="bg-primary/10"
              />
              <StatCard
                icon={Sparkles}
                label={t("kpi.plans")}
                value={String(activePlans)}
                change={0}
                iconColor="text-info"
                iconBg="bg-info/10"
              />
              <StatCard
                icon={Bot}
                label={t("kpi.runs24h")}
                value={String(runs24h)}
                change={0}
                iconColor="text-accent"
                iconBg="bg-accent/10"
              />
              <StatCard
                icon={DollarSign}
                label={t("kpi.cost30d")}
                value={`$${(cost?.total_cost_usd ?? 0).toFixed(2)}`}
                change={0}
                iconColor="text-success"
                iconBg="bg-success/10"
              />
            </div>

            {/* Recent plans */}
            <section className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-text-primary">{t("plans.title")}</h2>
              </div>
              {plans.length === 0 ? (
                <div className="p-6 text-center text-sm text-text-muted">{t("plans.empty")}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                    <tr>
                      <th className="px-5 py-2 text-start">{t("plans.tenant")}</th>
                      <th className="px-5 py-2 text-start">{t("plans.planTitle")}</th>
                      <th className="px-5 py-2 text-start">{t("plans.status")}</th>
                      <th className="px-5 py-2 text-start">{t("plans.created")}</th>
                      <th className="px-5 py-2 text-end">{t("plans.view")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-2">{p.tenant_name ?? p.tenant_id}</td>
                        <td className="px-5 py-2">{p.title}</td>
                        <td className="px-5 py-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-2 text-text-muted">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-2 text-end">
                          <Link
                            className="text-primary hover:underline"
                            href={`/admin/tenants/${p.tenant_id}`}
                          >
                            {t("plans.view")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Recent runs */}
            <section className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-text-primary">{t("runs.title")}</h2>
              </div>
              {runs.length === 0 ? (
                <div className="p-6 text-center text-sm text-text-muted">{t("runs.empty")}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                    <tr>
                      <th className="px-5 py-2 text-start">{t("plans.tenant")}</th>
                      <th className="px-5 py-2 text-start">{t("runs.agent")}</th>
                      <th className="px-5 py-2 text-start">{t("runs.model")}</th>
                      <th className="px-5 py-2 text-start">{t("runs.status")}</th>
                      <th className="px-5 py-2 text-end">{t("runs.cost")}</th>
                      <th className="px-5 py-2 text-end">{t("runs.latency")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-background/30">
                        <td className="px-5 py-2">
                          <Link href={`/admin/agent-runs/${r.id}`} className="text-primary hover:underline">
                            {r.tenant_name ?? r.tenant_id}
                          </Link>
                        </td>
                        <td className="px-5 py-2 font-medium">{r.agent_name}</td>
                        <td className="px-5 py-2 text-text-muted">{r.model ?? "—"}</td>
                        <td className="px-5 py-2">
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-xs",
                              r.status === "success"
                                ? "bg-success/10 text-success"
                                : r.status === "error"
                                ? "bg-error/10 text-error"
                                : "bg-warning/10 text-warning"
                            )}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-5 py-2 text-end">
                          {r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(4)}` : "—"}
                        </td>
                        <td className="px-5 py-2 text-end text-text-muted">
                          {r.latency_ms ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
