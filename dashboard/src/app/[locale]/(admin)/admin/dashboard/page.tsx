"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import StatCard from "@/components/StatCard";
import { Building2, Users, Radio, MessageSquare, Zap } from "lucide-react";
import { api } from "@/lib/api";

interface DashboardStats {
  total_tenants: number;
  total_users: number;
  total_channels: number;
  total_messages: number;
  active_campaigns: number;
}

export default function AdminDashboardPage() {
  const t = useTranslations("admin");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardStats>("/api/v1/admin/dashboard")
      .then((data) => setStats(data))
      .catch((err) => setError(err.message ?? "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <h1 className="text-xl font-bold text-text-primary">{t("platformOverview")}</h1>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {!loading && !error && stats && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              icon={Building2}
              label={t("totalTenants")}
              value={String(stats.total_tenants)}
              change={0}
              iconColor="text-primary"
              iconBg="bg-primary/10"
            />
            <StatCard
              icon={Users}
              label={t("totalUsers")}
              value={String(stats.total_users)}
              change={0}
              iconColor="text-info"
              iconBg="bg-info/10"
            />
            <StatCard
              icon={Radio}
              label={t("totalChannels")}
              value={String(stats.total_channels)}
              change={0}
              iconColor="text-accent"
              iconBg="bg-accent/10"
            />
            <StatCard
              icon={MessageSquare}
              label={t("totalMessages")}
              value={String(stats.total_messages)}
              change={0}
              iconColor="text-success"
              iconBg="bg-success/10"
            />
            <StatCard
              icon={Zap}
              label={t("activeCampaigns")}
              value={String(stats.active_campaigns)}
              change={0}
              iconColor="text-warning"
              iconBg="bg-warning/10"
            />
          </div>
        )}
      </div>
    </div>
  );
}
