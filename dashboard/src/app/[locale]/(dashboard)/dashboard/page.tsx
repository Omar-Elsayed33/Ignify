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
  Sparkles,
  ArrowRight,
  Calendar,
  Download,
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
    <div className="animate-pulse rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="h-11 w-11 rounded-xl bg-surface-container-high" />
        <div className="h-5 w-14 rounded-lg bg-surface-container-high" />
      </div>
      <div className="mt-5 h-3 w-20 rounded bg-surface-container-high" />
      <div className="mt-2 h-8 w-24 rounded bg-surface-container-high" />
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
    { label: t("createContent"), icon: PenLine, tint: "bg-primary-fixed text-primary" },
    { label: t("launchCampaign"), icon: Rocket, tint: "bg-secondary-fixed text-secondary" },
    { label: t("addLead"), icon: UserPlus, tint: "bg-tertiary-fixed text-on-tertiary-fixed-variant" },
    { label: t("generateReport"), icon: BarChart3, tint: "bg-primary-fixed text-primary" },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="px-8 pb-12 pt-2">
        <div className="mx-auto max-w-7xl space-y-10">
          {error && (
            <div className="flex items-center gap-3 rounded-2xl bg-error-container px-5 py-3 text-sm text-on-error-container">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Hero */}
          <section className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div className="space-y-3">
              <span className="insight-chip">
                <Sparkles className="h-3 w-3" />
                {t("welcome")}
              </span>
              <h2 className="font-headline text-4xl font-bold tracking-tight text-on-surface md:text-5xl">
                {t("title")}
              </h2>
              <p className="max-w-lg text-sm font-medium leading-relaxed text-on-surface-variant">
                {t("heroDesc") ?? "لوحة تحكم التسويق جاهزة. تابع أداء حملاتك ومنصاتك من مكان واحد."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 rounded-2xl bg-surface-container-highest px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant">
                <Calendar className="h-4 w-4" />
                {t("last30Days") ?? "Last 30 Days"}
              </button>
              <button className="brand-gradient flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02]">
                <Download className="h-4 w-4" />
                {t("exportReport") ?? "Export Report"}
              </button>
            </div>
          </section>

          {/* KPI Grid */}
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
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
                  change={14.2}
                  iconColor="text-primary"
                  iconBg="bg-primary-fixed"
                />
                <StatCard
                  icon={Target}
                  label={t("activeCampaigns")}
                  value={overview?.total_campaigns.toLocaleString() ?? "0"}
                  change={5.4}
                  iconColor="text-secondary"
                  iconBg="bg-secondary-fixed"
                />
                <StatCard
                  icon={FileText}
                  label={t("contentPublished")}
                  value={overview?.total_content_posts.toLocaleString() ?? "0"}
                  change={22}
                  iconColor="text-on-tertiary-fixed-variant"
                  iconBg="bg-tertiary-fixed"
                />
                <StatCard
                  icon={Coins}
                  label={t("creditBalance")}
                  value={overview?.credit_balance.toLocaleString() ?? "0"}
                  iconColor="text-primary"
                  iconBg="bg-primary-fixed"
                />
              </>
            )}
          </section>

          {/* Main grid: focus + insights */}
          <section className="grid gap-8 lg:grid-cols-3">
            {/* Left 2/3 — Platform Overview */}
            <div className="space-y-8 lg:col-span-2">
              <div className="rounded-2xl bg-surface-container-lowest p-8 shadow-soft ghost-border">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-headline text-xl font-bold text-on-surface">
                      {t("platformOverview")}
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      Your marketing surface at a glance
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse rounded-2xl bg-surface-container-low p-5">
                        <div className="h-9 w-9 rounded-lg bg-surface-container-high" />
                        <div className="mt-3 h-7 w-14 rounded bg-surface-container-high" />
                        <div className="mt-1 h-3 w-20 rounded bg-surface-container-high" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl bg-surface-container-low p-5">
                      <div className="w-fit rounded-lg bg-secondary-fixed p-2.5">
                        <Share2 className="h-5 w-5 text-secondary" />
                      </div>
                      <p className="mt-3 font-headline text-2xl font-bold text-on-surface">
                        {overview?.total_social_posts.toLocaleString() ?? "0"}
                      </p>
                      <p className="text-sm text-on-surface-variant">{t("socialPosts")}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-5">
                      <div className="w-fit rounded-lg bg-primary-fixed p-2.5">
                        <Megaphone className="h-5 w-5 text-primary" />
                      </div>
                      <p className="mt-3 font-headline text-2xl font-bold text-on-surface">
                        {overview?.total_ad_campaigns.toLocaleString() ?? "0"}
                      </p>
                      <p className="text-sm text-on-surface-variant">{t("adCampaigns")}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-5">
                      <div className="w-fit rounded-lg bg-tertiary-fixed p-2.5">
                        <Target className="h-5 w-5 text-on-tertiary-fixed-variant" />
                      </div>
                      <p className="mt-3 font-headline text-2xl font-bold text-on-surface">
                        {overview?.total_channels.toLocaleString() ?? "0"}
                      </p>
                      <p className="text-sm text-on-surface-variant">{t("channels")}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="mb-4 font-headline text-lg font-bold text-on-surface">
                  {t("quickActions")}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        className="group flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-4 text-start shadow-soft ghost-border transition-all hover:-translate-y-0.5"
                      >
                        <div className={`rounded-xl p-2.5 ${action.tint}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-semibold text-on-surface">
                          {action.label}
                        </span>
                        <ArrowRight className="ms-auto h-4 w-4 text-on-surface-variant/50 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 1/3 — activity */}
            <div className="space-y-6">
              {/* Recent Activity */}
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft ghost-border">
                <h4 className="mb-5 font-headline text-lg font-bold text-on-surface">
                  {t("recentActivity")}
                </h4>
                <div className="space-y-5">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex animate-pulse items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-surface-container-high" />
                        <div className="flex-1">
                          <div className="h-4 w-3/4 rounded bg-surface-container-high" />
                          <div className="mt-1 h-3 w-1/2 rounded bg-surface-container-high" />
                        </div>
                      </div>
                    ))
                  ) : reports.length === 0 ? (
                    <p className="py-6 text-center text-sm text-on-surface-variant">
                      {t("noRecentActivity")}
                    </p>
                  ) : (
                    reports.map((report) => (
                      <div key={report.id} className="flex items-start gap-3">
                        <div className="rounded-full bg-primary-fixed p-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-on-surface">
                            {report.name}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-variant">
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
          </section>
        </div>
      </div>
    </div>
  );
}
