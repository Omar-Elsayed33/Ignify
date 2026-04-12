"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Loader2, Pause, Play, Square, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import DashboardHeader from "@/components/DashboardHeader";

interface Campaign {
  id: string;
  name: string;
  status: string;
  platform: string;
  campaign_id_external: string | null;
  budget_daily: number | null;
  budget_total: number | null;
  start_date: string | null;
  end_date: string | null;
  config: Record<string, unknown> | null;
}

interface Insights {
  campaign_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number | null;
  cpc: number | null;
  reach: number | null;
}

interface Perf {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number | null;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const t = useTranslations("ads");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [perf, setPerf] = useState<Perf[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        api.get<Campaign>(`/api/v1/ads/campaigns/${id}`),
        api.get<Perf[]>(`/api/v1/ads/campaigns/${id}/performance`).catch(() => [] as Perf[]),
      ]);
      setCampaign(c);
      setPerf(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  async function refreshInsights() {
    setAction("refresh");
    try {
      const data = await api.get<Insights>(`/api/v1/ads/campaigns/${id}/insights`);
      setInsights(data);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Insights failed");
    } finally {
      setAction(null);
    }
  }

  async function act(kind: "pause" | "resume" | "stop") {
    setAction(kind);
    try {
      const updated = await api.post<Campaign>(`/api/v1/ads/campaigns/${id}/${kind}`, {});
      setCampaign(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setAction(null);
    }
  }

  useEffect(() => { load(); }, [id]);

  const chartData = [...perf].reverse().map((r) => ({
    date: r.date, impressions: r.impressions, clicks: r.clicks, spend: r.spend,
  }));

  return (
    <div>
      <DashboardHeader title={campaign?.name || t("campaign")} />
      <div className="p-6">
        {error && <div className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        {loading || !campaign ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-info/10 px-2.5 py-0.5 text-xs capitalize text-info">{campaign.status}</span>
              <span className="text-xs text-text-muted">{campaign.platform}</span>
              <div className="ms-auto flex gap-2">
                <button onClick={refreshInsights} disabled={!!action} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs">
                  {action === "refresh" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {t("refreshInsights")}
                </button>
                <button onClick={() => act("pause")} disabled={!!action} className="flex items-center gap-1 rounded-lg bg-warning px-3 py-1.5 text-xs text-white">
                  <Pause className="h-3.5 w-3.5" />{t("pause")}
                </button>
                <button onClick={() => act("resume")} disabled={!!action} className="flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-xs text-white">
                  <Play className="h-3.5 w-3.5" />{t("resume")}
                </button>
                <button onClick={() => act("stop")} disabled={!!action} className="flex items-center gap-1 rounded-lg bg-error px-3 py-1.5 text-xs text-white">
                  <Square className="h-3.5 w-3.5" />{t("stop")}
                </button>
              </div>
            </div>

            {insights && (
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <KPI label={t("impressions")} value={insights.impressions.toLocaleString()} />
                <KPI label={t("clicks")} value={insights.clicks.toLocaleString()} />
                <KPI label={t("spend")} value={`$${insights.spend.toFixed(2)}`} />
                <KPI label={t("ctr")} value={insights.ctr != null ? `${insights.ctr.toFixed(2)}%` : "—"} />
              </div>
            )}

            <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">{t("performanceHistory")}</h3>
              {chartData.length === 0 ? (
                <p className="text-sm text-text-muted">{t("noData")}</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Line type="monotone" dataKey="impressions" stroke="#FF6B00" />
                      <Line type="monotone" dataKey="clicks" stroke="#FFB800" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">{t("config")}</h3>
              <pre className="max-h-64 overflow-auto rounded-lg bg-background p-3 text-xs text-text-muted">
{JSON.stringify(campaign.config, null, 2)}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}
