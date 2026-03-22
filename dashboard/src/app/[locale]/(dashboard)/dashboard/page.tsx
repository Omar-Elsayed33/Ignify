"use client";

import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import StatCard from "@/components/StatCard";
import { Users, Target, FileText, DollarSign, PenLine, Rocket, UserPlus, BarChart3, Clock } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const performanceData = [
  { name: "Jan", leads: 120, conversions: 45, traffic: 2400 },
  { name: "Feb", leads: 150, conversions: 52, traffic: 2800 },
  { name: "Mar", leads: 180, conversions: 61, traffic: 3200 },
  { name: "Apr", leads: 220, conversions: 78, traffic: 3800 },
  { name: "May", leads: 260, conversions: 95, traffic: 4200 },
  { name: "Jun", leads: 310, conversions: 112, traffic: 4800 },
  { name: "Jul", leads: 350, conversions: 130, traffic: 5400 },
];

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  const activities = [
    { text: t("newLeadCaptured"), time: t("minutesAgo", { count: 15 }), icon: UserPlus },
    { text: t("campaignLaunched"), time: t("hoursAgo", { count: 2 }), icon: Rocket },
    { text: t("contentPublishedActivity"), time: t("hoursAgo", { count: 4 }), icon: FileText },
    { text: t("adPerformance"), time: t("hoursAgo", { count: 6 }), icon: Target },
  ];

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
        {/* Stat Cards */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label={t("totalLeads")}
            value="2,847"
            change={12.5}
            iconColor="text-primary"
            iconBg="bg-primary/10"
          />
          <StatCard
            icon={Target}
            label={t("activeCampaigns")}
            value="18"
            change={8.2}
            iconColor="text-accent"
            iconBg="bg-accent/10"
          />
          <StatCard
            icon={FileText}
            label={t("contentPublished")}
            value="142"
            change={24.1}
            iconColor="text-success"
            iconBg="bg-success/10"
          />
          <StatCard
            icon={DollarSign}
            label={t("adSpend")}
            value="$12,450"
            change={-3.2}
            iconColor="text-info"
            iconBg="bg-info/10"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          {/* Performance Chart */}
          <div className="col-span-2 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-text-primary">
              {t("performanceOverTime")}
            </h3>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
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
                  <Line
                    type="monotone"
                    dataKey="leads"
                    stroke="#FF6B00"
                    strokeWidth={2}
                    dot={{ fill: "#FF6B00", r: 4 }}
                    name="Leads"
                  />
                  <Line
                    type="monotone"
                    dataKey="conversions"
                    stroke="#FFB800"
                    strokeWidth={2}
                    dot={{ fill: "#FFB800", r: 4 }}
                    name="Conversions"
                  />
                  <Line
                    type="monotone"
                    dataKey="traffic"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: "#3B82F6", r: 4 }}
                    name="Traffic"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-text-primary">
              {t("recentActivity")}
            </h3>
            <div className="mt-4 space-y-4">
              {activities.map((activity, idx) => {
                const Icon = activity.icon;
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary">{activity.text}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                        <Clock className="h-3 w-3" />
                        {activity.time}
                      </div>
                    </div>
                  </div>
                );
              })}
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
