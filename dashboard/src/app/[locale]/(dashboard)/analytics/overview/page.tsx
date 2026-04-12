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
  Area,
  AreaChart,
} from "recharts";

import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import InsightChip from "@/components/InsightChip";
import { api, BASE_URL, getAccessToken } from "@/lib/api";

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

      <div className="p-8">
        <div className="space-y-8">
          <PageHeader
            eyebrow="ANALYTICS"
            title={t("title")}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full bg-surface-container-low p-1">
                  {(["7d", "30d", "90d"] as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={
                        "rounded-full px-3 py-1 font-headline text-xs font-bold transition-all " +
                        (period === p
                          ? "brand-gradient-bg text-white shadow-soft"
                          : "text-on-surface-variant")
                      }
                    >
                      {t(`period.${p}`)}
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-full bg-surface-container-low p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setPdfLang("en")}
                    className={
                      "rounded-full px-3 py-1 font-bold " +
                      (pdfLang === "en" ? "brand-gradient-bg text-white" : "text-on-surface-variant")
                    }
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfLang("ar")}
                    className={
                      "rounded-full px-3 py-1 font-bold " +
                      (pdfLang === "ar" ? "brand-gradient-bg text-white" : "text-on-surface-variant")
                    }
                  >
                    AR
                  </button>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleDownloadWeeklyPdf}
                  disabled={pdfLoading}
                  leadingIcon={
                    pdfLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )
                  }
                >
                  {pdfLoading ? tAdmin("report.downloading") : tAdmin("report.download")}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleGenerateReport}
                  disabled={reportLoading || loading}
                  leadingIcon={
                    reportLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )
                  }
                >
                  {reportLoading ? t("report.generating") : t("report.generate")}
                </Button>
              </div>
            }
          />

          {error && (
            <Card padding="sm" className="flex items-center gap-3 !bg-error-container">
              <AlertCircle className="h-4 w-4 shrink-0 text-on-error-container" />
              <span className="text-sm font-medium text-on-error-container">{error}</span>
            </Card>
          )}

          {/* KPI Cards with gradient numbers */}
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl bg-surface-container-low"
                />
              ))}
            </div>
          ) : data ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {data.kpis.map((k) => {
                const Icon = KPI_ICONS[k.key] || BarChart3;
                const deltaUp = (k.delta_pct ?? 0) >= 0;
                return (
                  <Card key={k.key} padding="lg" className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="brand-gradient-bg flex h-11 w-11 items-center justify-center rounded-xl shadow-soft">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      {k.delta_pct !== null && (
                        <span
                          className={
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold " +
                            (deltaUp
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-error-container text-on-error-container")
                          }
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
                    <div>
                      <p className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        {kpiLabel(k)}
                      </p>
                      <p className="brand-gradient-text mt-2 font-headline text-4xl font-bold tracking-tight">
                        {formatNumber(k.value)}
                        {k.unit && (
                          <span className="ms-1 text-base font-semibold text-on-surface-variant">
                            {k.unit}
                          </span>
                        )}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : null}

          {/* Charts with gradient fill */}
          {!loading && data && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card padding="lg">
                <div className="mb-4 flex items-center gap-2">
                  <InsightChip icon={TrendingUp}>TREND</InsightChip>
                  <h3 className="font-headline text-base font-bold tracking-tight text-on-surface">
                    {t("charts.reachOverTime")}
                  </h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.reach_trend}>
                      <defs>
                        <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ebe6f5" />
                      <XAxis dataKey="date" stroke="#8b8497" fontSize={11} />
                      <YAxis stroke="#8b8497" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "none",
                          borderRadius: "12px",
                          fontSize: "12px",
                          boxShadow: "0 8px 24px rgba(124, 58, 237, 0.15)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#7c3aed"
                        strokeWidth={2.5}
                        fill="url(#reachFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card padding="lg">
                <div className="mb-4 flex items-center gap-2">
                  <InsightChip icon={TrendingUp}>ENGAGEMENT</InsightChip>
                  <h3 className="font-headline text-base font-bold tracking-tight text-on-surface">
                    {t("charts.engagementOverTime")}
                  </h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.engagement_trend}>
                      <defs>
                        <linearGradient id="engFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ec4899" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ebe6f5" />
                      <XAxis dataKey="date" stroke="#8b8497" fontSize={11} />
                      <YAxis stroke="#8b8497" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "none",
                          borderRadius: "12px",
                          fontSize: "12px",
                          boxShadow: "0 8px 24px rgba(236, 72, 153, 0.15)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#ec4899"
                        strokeWidth={2.5}
                        fill="url(#engFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {/* Top Posts & Leads by Source */}
          {!loading && data && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card padding="lg">
                <div className="mb-4 flex items-center gap-2">
                  <InsightChip>TOP</InsightChip>
                  <h3 className="font-headline text-base font-bold tracking-tight text-on-surface">
                    {t("topPosts.title")}
                  </h3>
                </div>
                {data.top_posts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-on-surface-variant">
                    {t("topPosts.empty")}
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {data.top_posts.map((p, i) => (
                      <li
                        key={p.id}
                        className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4"
                      >
                        <span className="brand-gradient-bg flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-headline text-xs font-bold text-white shadow-soft">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm text-on-surface">
                            {p.caption || "—"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                            <span className="rounded-full bg-surface-container-lowest px-2 py-0.5 font-headline text-[10px] font-bold uppercase">
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
              </Card>

              <Card padding="lg">
                <div className="mb-4 flex items-center gap-2">
                  <InsightChip>SOURCES</InsightChip>
                  <h3 className="font-headline text-base font-bold tracking-tight text-on-surface">
                    {t("leadsBySource.title")}
                  </h3>
                </div>
                {leadsSourceData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-on-surface-variant">
                    {t("leadsBySource.empty")}
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsSourceData} layout="vertical">
                        <defs>
                          <linearGradient id="barFill" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#7c3aed" />
                            <stop offset="100%" stopColor="#ec4899" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ebe6f5" />
                        <XAxis type="number" stroke="#8b8497" fontSize={11} allowDecimals={false} />
                        <YAxis type="category" dataKey="source" stroke="#8b8497" fontSize={11} width={90} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "none",
                            borderRadius: "12px",
                            fontSize: "12px",
                            boxShadow: "0 8px 24px rgba(124, 58, 237, 0.15)",
                          }}
                        />
                        <Bar dataKey="count" fill="url(#barFill)" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* AI Report */}
          {(report || reportError) && (
            <Card padding="lg" className="space-y-5">
              <div className="flex items-center gap-2">
                <InsightChip icon={Sparkles}>AI INSIGHT</InsightChip>
                <h3 className="font-headline text-lg font-bold tracking-tight text-on-surface">
                  {t("report.summary")}
                </h3>
              </div>

              {reportError && (
                <div className="flex items-center gap-2 rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {reportError}
                </div>
              )}

              {report && (
                <div className="space-y-5">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">
                    {report.summary}
                  </p>

                  {report.insights.length > 0 && (
                    <div>
                      <h4 className="mb-3 font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        {t("report.insights")}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {report.insights.map((s, i) => (
                          <InsightChip key={i}>{s}</InsightChip>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.recommendations.length > 0 && (
                    <div>
                      <h4 className="mb-3 font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                        {t("report.recommendations")}
                      </h4>
                      <ul className="space-y-2 text-sm leading-relaxed text-on-surface-variant">
                        {report.recommendations.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="brand-gradient-text font-bold">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
