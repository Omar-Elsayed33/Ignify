"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import DataTable, { Column } from "@/components/DataTable";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { Plus, MonitorSmartphone, Loader2, X, Megaphone } from "lucide-react";
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

// ── Types matching backend snake_case responses ──

interface AdAccount {
  id: string;
  tenant_id: string;
  platform: string;
  account_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface AdCampaign {
  id: string;
  tenant_id: string;
  ad_account_id: string;
  platform: string;
  campaign_id_external: string | null;
  name: string;
  status: string;
  budget_daily: number | null;
  budget_total: number | null;
  start_date: string | null;
  end_date: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  [key: string]: unknown;
}

interface AdPerformance {
  id: string;
  ad_campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number | null;
  cpc: number | null;
  roas: number | null;
}

interface CreateCampaignForm {
  ad_account_id: string;
  platform: string;
  name: string;
  status: string;
  budget_daily: string;
  budget_total: string;
  start_date: string;
  end_date: string;
}

const AD_PLATFORMS = ["google_ads", "meta_ads", "snapchat_ads", "tiktok_ads", "twitter_ads"];

export default function AdsPage() {
  const t = useTranslations("adsPage");

  // ── State ──
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [performance, setPerformance] = useState<AdPerformance[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateCampaignForm>({
    ad_account_id: "",
    platform: "",
    name: "",
    status: "draft",
    budget_daily: "",
    budget_total: "",
    start_date: "",
    end_date: "",
  });

  // ── Fetch accounts ──
  useEffect(() => {
    setLoadingAccounts(true);
    api
      .get<AdAccount[]>("/api/v1/ads/accounts")
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoadingAccounts(false));
  }, []);

  // ── Fetch campaigns ──
  useEffect(() => {
    setLoadingCampaigns(true);
    api
      .get<AdCampaign[]>("/api/v1/ads/campaigns")
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoadingCampaigns(false));
  }, []);

  // ── Fetch performance for selected campaign ──
  useEffect(() => {
    if (!selectedCampaignId) return;
    setLoadingPerf(true);
    api
      .get<AdPerformance[]>(`/api/v1/ads/campaigns/${selectedCampaignId}/performance`)
      .then(setPerformance)
      .catch(() => setPerformance([]))
      .finally(() => setLoadingPerf(false));
  }, [selectedCampaignId]);

  // ── Auto-select first campaign for performance ──
  useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  // ── Sync platform from account selection ──
  function handleAccountChange(accountId: string) {
    const acct = accounts.find((a) => a.id === accountId);
    setForm((f) => ({
      ...f,
      ad_account_id: accountId,
      platform: acct ? acct.platform : f.platform,
    }));
  }

  // ── Create campaign ──
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ad_account_id || !form.name || !form.platform) {
      setCreateError("Account, name, and platform are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload = {
        ad_account_id: form.ad_account_id,
        platform: form.platform,
        name: form.name,
        status: form.status,
        budget_daily: form.budget_daily ? parseFloat(form.budget_daily) : null,
        budget_total: form.budget_total ? parseFloat(form.budget_total) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      const created = await api.post<AdCampaign>("/api/v1/ads/campaigns", payload);
      setCampaigns((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setForm({
        ad_account_id: "",
        platform: "",
        name: "",
        status: "draft",
        budget_daily: "",
        budget_total: "",
        start_date: "",
        end_date: "",
      });
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  }

  // ── Status badge ──
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      running: "bg-success/10 text-success",
      active: "bg-success/10 text-success",
      paused: "bg-warning/10 text-warning",
      completed: "bg-text-muted/10 text-text-muted",
      draft: "bg-info/10 text-info",
    };
    return (
      <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", colors[status] ?? "bg-text-muted/10 text-text-muted")}>
        {status}
      </span>
    );
  };

  // ── Table columns ──
  const columns: Column<AdCampaign>[] = [
    { key: "name", label: t("campaignName"), sortable: true },
    { key: "platform", label: t("platform"), sortable: true, render: (item) => <span className="capitalize">{String(item.platform).replace(/_/g, " ")}</span> },
    { key: "status", label: t("status"), render: (item) => statusBadge(String(item.status)) },
    {
      key: "budget_daily",
      label: t("budget"),
      render: (item) => item.budget_daily != null ? `$${Number(item.budget_daily).toLocaleString()}` : "—",
    },
    {
      key: "budget_total",
      label: t("spend"),
      render: (item) => item.budget_total != null ? `$${Number(item.budget_total).toLocaleString()}` : "—",
    },
    {
      key: "start_date",
      label: t("impressions"),
      render: (item) => item.start_date ? String(item.start_date) : "—",
    },
    {
      key: "end_date",
      label: t("clicks"),
      render: (item) => item.end_date ? String(item.end_date) : "—",
    },
  ];

  // ── Chart data from performance ──
  const chartData = performance.slice(0, 7).reverse().map((p) => ({
    name: p.date,
    impressions: p.impressions,
    clicks: p.clicks,
  }));

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Connected Accounts */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">
            {t("connectedAccounts")}
          </h3>
          {loadingAccounts ? (
            <div className="flex items-center gap-2 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading accounts…</span>
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-text-muted">No ad accounts connected yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="rounded-lg bg-primary/10 p-2">
                    <MonitorSmartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{account.name}</p>
                    <p className="text-xs capitalize text-text-muted">
                      {account.platform.replace(/_/g, " ")}
                    </p>
                    <span className={clsx("mt-0.5 inline-block text-xs", account.is_active ? "text-success" : "text-text-muted")}>
                      {account.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance Chart */}
        <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">{t("performance")}</h3>
            {campaigns.length > 0 && (
              <select
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                value={selectedCampaignId ?? ""}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          {loadingPerf ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-text-muted">
              No performance data available for this campaign.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
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
          )}
        </div>

        {/* Campaign Table */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">{t("campaignName")}</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("createCampaign")}
          </button>
        </div>

        {loadingCampaigns ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="لا توجد حملات إعلانية بعد"
            description="أنشئ أول حملة إعلانية لربط حساباتك وتتبع أداء الإعلانات في مكان واحد."
            actionLabel={t("createCampaign")}
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <DataTable
            columns={columns}
            data={campaigns}
          />
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">{t("createCampaign")}</h2>
              <button
                onClick={() => { setShowCreateModal(false); setCreateError(null); }}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Ad Account *</label>
                <select
                  required
                  value={form.ad_account_id}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">{t("platform")} *</label>
                <select
                  required
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select platform…</option>
                  {AD_PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">{t("campaignName")} *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Campaign name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">{t("status")}</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Daily Budget ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.budget_daily}
                    onChange={(e) => setForm((f) => ({ ...f, budget_daily: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Total Budget ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.budget_total}
                    onChange={(e) => setForm((f) => ({ ...f, budget_total: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(null); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("createCampaign")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
