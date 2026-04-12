"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import { api } from "@/lib/api";
import {
  Users,
  Target,
  FileText,
  Coins,
  PenLine,
  Rocket,
  UserPlus,
  BarChart3,
  Clock,
  Share2,
  Megaphone,
  AlertCircle,
} from "lucide-react";

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
  name: string;
  report_type: string;
  created_at: string;
}

function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-lg bg-border" />
        <div className="h-4 w-16 rounded bg-border" />
      </div>
      <div className="mt-3 h-8 w-24 rounded bg-border" />
      <div className="mt-1 h-3 w-20 rounded bg-border" />
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [overviewData, reportsData] = await Promise.all([
          api.get<OverviewData>("/api/v1/analytics/overview"),
          api.get<Report[]>("/api/v1/analytics/reports?limit=5"),
        ]);
        setOverview(overviewData);
        setReports(reportsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const quickActions = [
    { label: t("createContent"), icon: PenLine, color: "bg-primary/10 text-primary" },
    { label: t("launchCampaign"), icon: Rocket, color: "bg-accent/10 text-accent" },
    { label: t("addLead"), icon: UserPlus, color: "bg-success/10 text-success" },
    { label: t("generateReport"), icon: BarChart3, color: "bg-info/10 text-info" },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <>
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </>
          ) : (
            <>
              <StatCard
                icon={Users}
                label={t("totalLeads")}
                value={overview?.total_leads.toLocaleString() ?? "0"}
                iconColor="text-primary"
                iconBg="bg-primary/10"
              />
              <StatCard
                icon={Target}
                label={t("activeCampaigns")}
                value={overview?.total_campaigns.toLocaleString() ?? "0"}
                iconColor="text-accent"
                iconBg="bg-accent/10"
              />
              <StatCard
                icon={FileText}
                label={t("contentPublished")}
                value={overview?.total_content_posts.toLocaleString() ?? "0"}
                iconColor="text-success"
                iconBg="bg-success/10"
              />
              <StatCard
                icon={Coins}
                label={t("creditBalance")}
                value={overview?.credit_balance.toLocaleString() ?? "0"}
                iconColor="text-info"
                iconBg="bg-info/10"
              />
            </>
          )}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          {/* Additional Stats */}
          <div className="col-span-2 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-text-primary">
              {t("platformOverview")}
            </h3>
            {loading ? (
              <div className="mt-4 grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-lg bg-background p-4">
                    <div className="h-8 w-8 rounded bg-border" />
                    <div className="mt-2 h-6 w-12 rounded bg-border" />
                    <div className="mt-1 h-3 w-20 rounded bg-border" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-background p-4">
                  <div className="rounded-lg bg-accent/10 p-2 w-fit">
                    <Share2 className="h-5 w-5 text-accent" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-text-primary">
                    {overview?.total_social_posts.toLocaleString() ?? "0"}
                  </p>
                  <p className="text-sm text-text-muted">{t("socialPosts")}</p>
                </div>
                <div className="rounded-lg bg-background p-4">
                  <div className="rounded-lg bg-info/10 p-2 w-fit">
                    <Megaphone className="h-5 w-5 text-info" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-text-primary">
                    {overview?.total_ad_campaigns.toLocaleString() ?? "0"}
                  </p>
                  <p className="text-sm text-text-muted">{t("adCampaigns")}</p>
                </div>
                <div className="rounded-lg bg-background p-4">
                  <div className="rounded-lg bg-success/10 p-2 w-fit">
                    <Target className="h-5 w-5 text-success" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-text-primary">
                    {overview?.total_channels.toLocaleString() ?? "0"}
                  </p>
                  <p className="text-sm text-text-muted">{t("channels")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Recent Reports */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-text-primary">
              {t("recentActivity")}
            </h3>
            <div className="mt-4 space-y-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-border" />
                    <div className="flex-1">
                      <div className="h-4 w-3/4 rounded bg-border" />
                      <div className="mt-1 h-3 w-1/2 rounded bg-border" />
                    </div>
                  </div>
                ))
              ) : reports.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">
                  {t("noRecentActivity")}
                </p>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{report.name}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                        <Clock className="h-3 w-3" />
                        {new Date(report.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">
            {t("quickActions")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-start shadow-sm transition-all hover:shadow-md"
                >
                  <div className={`rounded-lg p-2.5 ${action.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
