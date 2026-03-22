"use client";

import { useTranslations } from "next-intl";
import StatCard from "@/components/StatCard";
import { Building2, DollarSign, Users } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const revenueData = [
  { name: "Jan", revenue: 12000, tenants: 45 },
  { name: "Feb", revenue: 15000, tenants: 52 },
  { name: "Mar", revenue: 18000, tenants: 61 },
  { name: "Apr", revenue: 22000, tenants: 73 },
  { name: "May", revenue: 28000, tenants: 85 },
  { name: "Jun", revenue: 32000, tenants: 98 },
];

export default function AdminDashboardPage() {
  const t = useTranslations("admin");

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <h1 className="text-xl font-bold text-text-primary">{t("platformOverview")}</h1>
      </div>

      <div className="p-6">
        {/* Stats */}
        <div className="mb-6 grid gap-6 sm:grid-cols-3">
          <StatCard
            icon={Building2}
            label={t("totalTenants")}
            value="98"
            change={15.4}
            iconColor="text-primary"
            iconBg="bg-primary/10"
          />
          <StatCard
            icon={DollarSign}
            label={t("totalRevenue")}
            value="$32,450"
            change={22.8}
            iconColor="text-success"
            iconBg="bg-success/10"
          />
          <StatCard
            icon={Users}
            label={t("activeUsers")}
            value="1,247"
            change={8.3}
            iconColor="text-info"
            iconBg="bg-info/10"
          />
        </div>

        {/* Revenue Chart */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">Revenue & Growth</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
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
                <Line type="monotone" dataKey="revenue" stroke="#FF6B00" strokeWidth={2} dot={{ fill: "#FF6B00", r: 4 }} name="Revenue ($)" />
                <Line type="monotone" dataKey="tenants" stroke="#3B82F6" strokeWidth={2} dot={{ fill: "#3B82F6", r: 4 }} name="Tenants" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
