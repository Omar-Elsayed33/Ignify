"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Users,
  TrendingUp,
  Target,
  Sparkles,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import DashboardHeader from "@/components/DashboardHeader";
import { api, BASE_URL, getAccessToken } from "@/lib/api";

// ── Types matching backend schemas ─────────────────────────────────────────

interface KPICard {
  key: string;
  label_en: string;
  label_ar: string;
  value: number;
  delta_pct: number | null;
  unit: string;
}

interface TrendPoint {
  date: string;
  value: number;
}

interface TopPost {
  id: string;
  caption: string;
  platform: string;
  reach: number;
  engagement: number;
}

interface DashboardResponse {
  kpis: KPICard[];
  reach_trend: TrendPoint[];
  engagement_trend: TrendPoint[];
  top_posts: TopPost[];
  leads_by_source: Record<string, number>;
  conversion_rate: number;
}

interface AgentReportResponse {
  summary: string;
  insights: string[];
  recommendations: string[];
}

type Period = "7d" | "30d" | "90d";

const KPI_ICONS: Record<string, React.ElementType> = {
  reach: Users,
  engagement: TrendingUp,
  leads: Target,
  conversion: BarChart3,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function AnalyticsOverviewPage() {
  const t = useTranslations("analyticsDash");
  const tAdmin = useTranslations("adminDash");
  const [period, setPeriod] = useState<Period>("7d");
  const [pdfLang, setPdfLang] = useState<"ar" | "en">("en");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<AgentReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const locale =
    typeof document !== "undefined"
      ? document.documentElement.lang || "en"
      : "en";

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DashboardResponse>(
        `/api/v1/analytics-dashboard/overview?period=${period}`
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  async function handleDownloadWeeklyPdf() {
    setPdfLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${BASE_URL}/api/v1/analytics-dashboard/report/weekly.pdf?lang=${pdfLang}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const dl = document.createElement("a");
      dl.href = URL.createObjectURL(blob);
      dl.download = `weekly-report-${pdfLang}.pdf`;
      document.body.appendChild(dl);
      dl.click();
      dl.remove();
      URL.revokeObjectURL(dl.href);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "PDF download failed");
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleGenerateReport() {
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await api.post<AgentReportResponse>(
        "/api/v1/analytics-dashboard/report/generate",
        { period, language: locale }
      );
      setReport(res);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setReportLoading(false);
    }
  }

  const kpiLabel = (k: KPICard) => (locale === "ar" ? k.label_ar : k.label_en);

  const leadsSourceData = data
    ? Object.entries(data.leads_by_source).map(([source, count]) => ({
        source,
        count,
      }))
    : [];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Period selector */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-secondary">
              {t("period.label")}:
            </span>
            <div className="inline-flex rounded-lg border border-border bg-surface p-1">
              {(["7d", "30d", "90d"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                    (period === p
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:bg-surface-hover")
                  }
                >
                  {t(`period.${p}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-surface p-1 text-xs">
              <button
                type="button"
                onClick={() => setPdfLang("en")}
                className={
                  "rounded px-2 py-1 " +
                  (pdfLang === "en" ? "bg-primary text-white" : "text-text-secondary")
                }
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setPdfLang("ar")}
                className={
                  "rounded px-2 py-1 " +
                  (pdfLang === "ar" ? "bg-primary text-white" : "text-text-secondary")
                }
              >
                AR
              </button>
            </div>
            <button
              onClick={handleDownloadWeeklyPdf}
              disabled={pdfLoading}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-60"
            >
              {pdfLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {pdfLoading ? tAdmin("report.downloading") : tAdmin("report.download")}
            </button>
          <button
            onClick={handleGenerateReport}
            disabled={reportLoading || loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {reportLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {reportLoading ? t("report.generating") : t("report.generate")}
          </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* KPI Cards */}
        {loading ? (
          <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-border bg-surface"
              />
            ))}
          </div>
        ) : data ? (
          <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((k) => {
              const Icon = KPI_ICONS[k.key] || BarChart3;
              const deltaUp = (k.delta_pct ?? 0) >= 0;
              return (
                <div
                  key={k.key}
                  className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    {k.delta_pct !== null && (
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold " +
                          (deltaUp
                            ? "bg-success/10 text-success"
                            : "bg-error/10 text-error")
                        }
                        title={deltaUp ? t("kpi.deltaUp") : t("kpi.deltaDown")}
                      >
                        {deltaUp ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {Math.abs(k.delta_pct).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    {kpiLabel(k)}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {formatNumber(k.value)}
                    {k.unit && (
                      <span className="ms-1 text-base font-medium text-text-secondary">
                        {k.unit}
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Charts */}
        {!loading && data && (
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-text-primary">
                {t("charts.reachOverTime")}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.reach_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#FF6B00"
                      strokeWidth={2}
                      dot={{ fill: "#FF6B00", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-text-primary">
                {t("charts.engagementOverTime")}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.engagement_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0EA5E9"
                      strokeWidth={2}
                      dot={{ fill: "#0EA5E9", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Top Posts & Leads by Source */}
        {!loading && data && (
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-text-primary">
                {t("topPosts.title")}
              </h3>
              {data.top_posts.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">
                  {t("topPosts.empty")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.top_posts.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-start gap-3 rounded-lg border border-border/50 p-3"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm text-text-primary">
                          {p.caption || "—"}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                          <span className="rounded bg-surface-hover px-2 py-0.5 font-medium">
                            {p.platform}
                          </span>
                          <span>
                            {t("kpi.reach")}: {formatNumber(p.reach)}
                          </span>
                          <span>
                            {t("kpi.engagement")}: {formatNumber(p.engagement)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-text-primary">
                {t("leadsBySource.title")}
              </h3>
              {leadsSourceData.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">
                  {t("leadsBySource.empty")}
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadsSourceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        type="number"
                        stroke="#94A3B8"
                        fontSize={11}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="source"
                        stroke="#94A3B8"
                        fontSize={11}
                        width={90}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #E2E8F0",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#FF6B00"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Report */}
        {(report || reportError) && (
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-text-primary">
                {t("report.summary")}
              </h3>
            </div>

            {reportError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-sm text-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {reportError}
              </div>
            )}

            {report && (
              <div className="space-y-6">
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                  {report.summary}
                </p>

                {report.insights.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-text-primary">
                      {t("report.insights")}
                    </h4>
                    <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
                      {report.insights.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.recommendations.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-text-primary">
                      {t("report.recommendations")}
                    </h4>
                    <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
                      {report.recommendations.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
