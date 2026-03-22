"use client";

import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import { Plus, MonitorSmartphone } from "lucide-react";
import { clsx } from "clsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AdCampaign {
  id: string;
  name: string;
  platform: string;
  status: string;
  budget: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  [key: string]: unknown;
}

const mockCampaigns: AdCampaign[] = [
  { id: "1", name: "Summer Sale 2026", platform: "Google Ads", status: "running", budget: "$5,000", spend: "$3,240", impressions: "145,230", clicks: "4,320", ctr: "2.97%" },
  { id: "2", name: "Brand Awareness Q1", platform: "Meta Ads", status: "running", budget: "$3,000", spend: "$2,100", impressions: "230,450", clicks: "6,890", ctr: "2.99%" },
  { id: "3", name: "Product Launch", platform: "Snapchat Ads", status: "paused", budget: "$2,000", spend: "$890", impressions: "89,200", clicks: "1,780", ctr: "2.00%" },
  { id: "4", name: "Retargeting Campaign", platform: "Google Ads", status: "running", budget: "$1,500", spend: "$1,200", impressions: "67,800", clicks: "2,710", ctr: "4.00%" },
  { id: "5", name: "Holiday Promo", platform: "Meta Ads", status: "completed", budget: "$4,000", spend: "$4,000", impressions: "312,000", clicks: "9,360", ctr: "3.00%" },
];

const performanceData = [
  { name: "Mon", impressions: 45000, clicks: 1200 },
  { name: "Tue", impressions: 52000, clicks: 1560 },
  { name: "Wed", impressions: 48000, clicks: 1440 },
  { name: "Thu", impressions: 61000, clicks: 1830 },
  { name: "Fri", impressions: 55000, clicks: 1650 },
  { name: "Sat", impressions: 38000, clicks: 1140 },
  { name: "Sun", impressions: 42000, clicks: 1260 },
];

const connectedAccounts = [
  { name: "Google Ads", status: "connected", campaigns: 3 },
  { name: "Meta Ads", status: "connected", campaigns: 2 },
  { name: "Snapchat Ads", status: "connected", campaigns: 1 },
];

export default function AdsPage() {
  const t = useTranslations("adsPage");

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      running: "bg-success/10 text-success",
      paused: "bg-warning/10 text-warning",
      completed: "bg-text-muted/10 text-text-muted",
    };
    return (
      <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", colors[status])}>
        {t(status as "running" | "paused" | "completed")}
      </span>
    );
  };

  const columns: Column<AdCampaign>[] = [
    { key: "name", label: t("campaignName"), sortable: true },
    { key: "platform", label: t("platform"), sortable: true },
    { key: "status", label: t("status"), render: (item) => statusBadge(item.status) },
    { key: "budget", label: t("budget"), sortable: true },
    { key: "spend", label: t("spend"), sortable: true },
    { key: "impressions", label: t("impressions") },
    { key: "clicks", label: t("clicks") },
    { key: "ctr", label: t("ctr") },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Connected accounts */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">
            {t("connectedAccounts")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {connectedAccounts.map((account) => (
              <div
                key={account.name}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <MonitorSmartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{account.name}</p>
                  <p className="text-xs text-success">{account.campaigns} campaigns</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Chart */}
        <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">
            {t("performance")}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="impressions" fill="#FF6B00" radius={[4, 4, 0, 0]} name="Impressions" />
                <Bar dataKey="clicks" fill="#FFB800" radius={[4, 4, 0, 0]} name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Campaign Table */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">{t("campaignName")}</h3>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
            <Plus className="h-4 w-4" />
            {t("createCampaign")}
          </button>
        </div>

        <DataTable
          columns={columns}
          data={mockCampaigns as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
