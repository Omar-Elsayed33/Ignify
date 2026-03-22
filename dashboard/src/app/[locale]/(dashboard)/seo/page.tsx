"use client";

import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import StatCard from "@/components/StatCard";
import { Search, TrendingUp, TrendingDown, Link, FileSearch, Play } from "lucide-react";
import { clsx } from "clsx";

interface KeywordData {
  keyword: string;
  volume: string;
  difficulty: string;
  rank: number;
  change: number;
  [key: string]: unknown;
}

const mockKeywords: KeywordData[] = [
  { keyword: "AI marketing platform", volume: "8,100", difficulty: "Hard", rank: 3, change: 2 },
  { keyword: "marketing automation tool", volume: "12,400", difficulty: "Medium", rank: 7, change: -1 },
  { keyword: "content generation AI", volume: "6,600", difficulty: "Medium", rank: 5, change: 3 },
  { keyword: "social media management", volume: "22,200", difficulty: "Hard", rank: 12, change: 0 },
  { keyword: "email marketing software", volume: "18,100", difficulty: "Hard", rank: 15, change: -2 },
  { keyword: "SEO analytics tool", volume: "4,400", difficulty: "Easy", rank: 2, change: 1 },
  { keyword: "lead generation platform", volume: "9,900", difficulty: "Medium", rank: 8, change: 4 },
];

const recentAudits = [
  { date: "2026-03-20", score: 87, issues: 12 },
  { date: "2026-03-13", score: 82, issues: 18 },
  { date: "2026-03-06", score: 79, issues: 23 },
];

export default function SeoPage() {
  const t = useTranslations("seoPage");

  const columns: Column<KeywordData>[] = [
    { key: "keyword", label: t("keyword"), sortable: true },
    { key: "volume", label: t("volume"), sortable: true },
    {
      key: "difficulty",
      label: t("difficulty"),
      render: (item) => {
        const colors: Record<string, string> = {
          Easy: "bg-success/10 text-success",
          Medium: "bg-accent/10 text-accent",
          Hard: "bg-error/10 text-error",
        };
        return (
          <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", colors[item.difficulty])}>
            {item.difficulty}
          </span>
        );
      },
    },
    {
      key: "rank",
      label: t("rank"),
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-text-primary">#{item.rank}</span>
      ),
    },
    {
      key: "change",
      label: t("change"),
      render: (item) => (
        <div className="flex items-center gap-1">
          {item.change > 0 ? (
            <TrendingUp className="h-4 w-4 text-success" />
          ) : item.change < 0 ? (
            <TrendingDown className="h-4 w-4 text-error" />
          ) : (
            <span className="h-4 w-4 text-center text-text-muted">-</span>
          )}
          <span
            className={clsx(
              "text-sm font-medium",
              item.change > 0 ? "text-success" : item.change < 0 ? "text-error" : "text-text-muted"
            )}
          >
            {item.change > 0 ? `+${item.change}` : item.change}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* SEO Score and Stats */}
        <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Search} label={t("seoScore")} value="87/100" change={6.1} iconColor="text-primary" iconBg="bg-primary/10" />
          <StatCard icon={FileSearch} label={t("technicalSeo")} value="92%" change={3.2} iconColor="text-success" iconBg="bg-success/10" />
          <StatCard icon={FileSearch} label={t("onPageSeo")} value="78%" change={-1.5} iconColor="text-accent" iconBg="bg-accent/10" />
          <StatCard icon={Link} label={t("backlinks")} value="1,234" change={15.3} iconColor="text-info" iconBg="bg-info/10" />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Keyword Tracking */}
          <div className="xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">{t("keywordTracking")}</h3>
            </div>
            <DataTable
              columns={columns}
              data={mockKeywords as unknown as Record<string, unknown>[]}
            />
          </div>

          {/* Recent Audits & Run Audit */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">{t("recentAudits")}</h3>
              <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
                <Play className="h-4 w-4" />
                {t("runAudit")}
              </button>
            </div>
            <div className="space-y-3">
              {recentAudits.map((audit) => (
                <div
                  key={audit.date}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{audit.date}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{audit.issues} issues found</p>
                  </div>
                  <div className={clsx(
                    "flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold",
                    audit.score >= 85 ? "bg-success/10 text-success" :
                    audit.score >= 70 ? "bg-accent/10 text-accent" : "bg-error/10 text-error"
                  )}>
                    {audit.score}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
