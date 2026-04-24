"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import DataTable, { Column } from "@/components/DataTable";
import { api } from "@/lib/api";
import {
  TrendingUp,
  Users,
  Megaphone,
  FileText,
  FileDown,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types matching snake_case API responses ──────────────────────────────────

interface OverviewData {
  total_leads: number;
  total_campaigns: number;
  total_channels: number;
  total_content_posts: number;
  total_social_posts: number;
  total_ad_campaigns: number;
  credit_balance: number;
}

interface Report {
  id: string;
  tenant_id: string;
  name: string;
  report_type: string;
  config: Record<string, unknown> | null;
  file_url: string | null;
  created_at: string;
  [key: string]: unknown;
}

// ── Modal: Generate Report ───────────────────────────────────────────────────

interface GenerateReportModalProps {
  onClose: () => void;
  onCreated: (report: Report) => void;
  t: ReturnType<typeof useTranslations>;
}

function GenerateReportModal({ onClose, onCreated, t }: GenerateReportModalProps) {
  const [name, setName] = useState("");
  const [reportType, setReportType] = useState("overview");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<Report>("/api/v1/analytics/reports", {
        name: name.trim(),
        report_type: reportType,
        config: {},
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGenerate"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-text-primary">{t("generateReport")}</h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("reportName")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t("reportType")}
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="overview">{t("typeOverview")}</option>
              <option value="campaigns">{t("typeCampaigns")}</option>
              <option value="leads">{t("typeLeads")}</option>
              <option value="channels">{t("typeChannels")}</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("generate")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const t = useTranslations("analyticsPage");
  const [dateRange, setDateRange] = useState("30");

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await api.get<OverviewData>("/api/v1/analytics/overview");
      setOverview(data);
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setOverviewLoading(false);
    }
  }, [t]);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const data = await api.get<Report[]>("/api/v1/analytics/reports");
      setReports(data);
    } catch (err) {
      setReportsError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setReportsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchOverview();
    fetchReports();
  }, [fetchOverview, fetchReports]);

  // Re-fetch when date range changes (overview is tenant-wide; pass as query hint)
  useEffect(() => {
    fetchOverview();
  }, [dateRange, fetchOverview]);

  function handleReportCreated(report: Report) {
    setReports((prev) => [report, ...prev]);
    setShowGenerateModal(false);
  }

  // Build chart data from overview counts
  const chartData = overview
    ? [
        { name: t("chartLeads"), value: overview.total_leads },
        { name: t("chartCampaigns"), value: overview.total_campaigns },
        { name: t("chartChannels"), value: overview.total_channels },
        { name: t("chartContent"), value: overview.total_content_posts },
        { name: t("chartSocial"), value: overview.total_social_posts },
        { name: t("chartAds"), value: overview.total_ad_campaigns },
      ]
    : [];

  const reportColumns: Column<Report>[] = [
    { key: "name", label: t("colName"), sortable: true },
    { key: "report_type", label: t("colType"), sortable: true },
    {
      key: "created_at",
      label: t("colCreated"),
      sortable: true,
      render: (row) =>
        new Date(row.created_at as string).toLocaleDateString(),
    },
    {
      key: "file_url",
      label: t("colFile"),
      render: (row) =>
        row.file_url ? (
          <a
            href={row.file_url as string}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileDown className="h-3 w-3" />
            {t("download")}
          </a>
        ) : (
          <span className="text-xs text-text-muted">{t("pending")}</span>
        ),
    },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Controls */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-secondary">{t("dateRange")}:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="7">{t("last7Days")}</option>
              <option value="30">{t("last30Days")}</option>
              <option value="90">{t("last90Days")}</option>
            </select>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("generateReport")}
          </button>
        </div>

        {/* Overview Error */}
        {overviewError && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {overviewError}
          </div>
        )}

        {/* Stat Cards */}
        {overviewLoading ? (
          <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-border bg-surface"
              />
            ))}
          </div>
        ) : overview ? (
          <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label={t("totalLeads")}
              value={overview.total_leads.toLocaleString()}
              iconColor="text-primary"
              iconBg="bg-primary/10"
            />
            <StatCard
              icon={Megaphone}
              label={t("totalCampaigns")}
              value={overview.total_campaigns.toLocaleString()}
              iconColor="text-success"
              iconBg="bg-success/10"
            />
            <StatCard
              icon={FileText}
              label={t("totalContent")}
              value={(overview.total_content_posts + overview.total_social_posts).toLocaleString()}
              iconColor="text-accent"
              iconBg="bg-accent/10"
            />
            <StatCard
              icon={TrendingUp}
              label={t("creditBalance")}
              value={overview.credit_balance.toLocaleString()}
              iconColor="text-info"
              iconBg="bg-info/10"
            />
          </div>
        ) : null}

        {/* Overview Chart */}
        {!overviewLoading && overview && (
          <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("overviewBreakdown")}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #E2E8F0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" fill="#FF6B00" radius={[4, 4, 0, 0]} name={t("count")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Reports Table */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">{t("reports")}</h3>
          {reportsLoading && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
        </div>

        {reportsError && (
          <div className="flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {reportsError}
          </div>
        )}

        {!reportsLoading && !reportsError && reports.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-text-muted/40" />
            <p className="mt-3 text-sm font-medium text-text-secondary">{t("noReports")}</p>
            <p className="mt-1 text-xs text-text-muted">{t("noReportsHint")}</p>
          </div>
        )}

        {!reportsLoading && reports.length > 0 && (
          <DataTable
            columns={reportColumns}
            data={reports}
          />
        )}
      </div>

      {showGenerateModal && (
        <GenerateReportModal
          onClose={() => setShowGenerateModal(false)}
          onCreated={handleReportCreated}
          t={t}
        />
      )}
    </div>
  );
}
