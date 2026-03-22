"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import DataTable, { Column } from "@/components/DataTable";
import { TrendingUp, Percent, DollarSign, Receipt, FileDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const channelData = [
  { name: "Google Ads", leads: 420, revenue: 28000, cost: 8400 },
  { name: "Meta Ads", leads: 380, revenue: 22000, cost: 6800 },
  { name: "Email", leads: 290, revenue: 18500, cost: 1200 },
  { name: "Social", leads: 220, revenue: 12000, cost: 3200 },
  { name: "SEO", leads: 340, revenue: 25000, cost: 2800 },
  { name: "Referral", leads: 180, revenue: 15000, cost: 500 },
];

interface CampaignComparison {
  name: string;
  type: string;
  leads: string;
  conversions: string;
  revenue: string;
  roi: string;
  [key: string]: unknown;
}

const campaignComparison: CampaignComparison[] = [
  { name: "Summer Sale 2026", type: "Email", leads: "420", conversions: "84", revenue: "$28,000", roi: "233%" },
  { name: "Brand Awareness Q1", type: "Social", leads: "380", conversions: "57", revenue: "$22,000", roi: "224%" },
  { name: "Product Launch", type: "Multi-channel", leads: "290", conversions: "72", revenue: "$18,500", roi: "185%" },
  { name: "Retargeting", type: "Ads", leads: "220", conversions: "66", revenue: "$12,000", roi: "176%" },
  { name: "SEO Content Push", type: "Content", leads: "340", conversions: "51", revenue: "$25,000", roi: "793%" },
];

export default function AnalyticsPage() {
  const t = useTranslations("analyticsPage");
  const [dateRange, setDateRange] = useState("30");

  const columns: Column<CampaignComparison>[] = [
    { key: "name", label: "Campaign", sortable: true },
    { key: "type", label: "Type" },
    { key: "leads", label: "Leads", sortable: true },
    { key: "conversions", label: "Conversions", sortable: true },
    { key: "revenue", label: "Revenue", sortable: true },
    { key: "roi", label: "ROI", sortable: true },
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
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
            <FileDown className="h-4 w-4" />
            {t("generateReport")}
          </button>
        </div>

        {/* Stat Cards */}
        <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={TrendingUp} label={t("roi")} value="245%" change={18.3} iconColor="text-primary" iconBg="bg-primary/10" />
          <StatCard icon={Percent} label={t("conversionRate")} value="4.8%" change={0.6} iconColor="text-success" iconBg="bg-success/10" />
          <StatCard icon={DollarSign} label={t("costPerLead")} value="$24.50" change={-8.2} iconColor="text-accent" iconBg="bg-accent/10" />
          <StatCard icon={Receipt} label={t("totalRevenue")} value="$120,500" change={22.4} iconColor="text-info" iconBg="bg-info/10" />
        </div>

        {/* Channel Performance Chart */}
        <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("channelPerformance")}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData}>
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
                <Bar dataKey="leads" fill="#FF6B00" radius={[4, 4, 0, 0]} name="Leads" />
                <Bar dataKey="revenue" fill="#FFB800" radius={[4, 4, 0, 0]} name="Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Campaign Comparison Table */}
        <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("campaignComparison")}</h3>
        <DataTable
          columns={columns}
          data={campaignComparison as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
