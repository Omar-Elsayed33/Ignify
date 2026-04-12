"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Loader2, AlertCircle, Trophy, Play, CheckCircle2 } from "lucide-react";

interface Variant {
  id: string;
  variant_label: string;
  content_post_id: string | null;
  model_override: string | null;
  prompt_override: string | null;
  status: string;
  error: string | null;
  impressions: number;
  clicks: number;
  engagements: number;
  conversions: number;
}

interface ExperimentDetail {
  id: string;
  name: string;
  brief: string;
  target: string;
  channel: string | null;
  language: string;
  status: "draft" | "running" | "completed";
  winner_variant_id: string | null;
  variants: Variant[];
}

interface ContentPost {
  id: string;
  title: string;
  body: string | null;
}

function rate(v: Variant): number {
  if (v.impressions > 0) return (v.engagements + v.clicks + v.conversions * 3) / v.impressions;
  return v.engagements + v.clicks + v.conversions * 3;
}

export default function ExperimentDetailPage() {
  const t = useTranslations("experiments");
  const params = useParams();
  const id = params?.id as string;

  const [exp, setExp] = useState<ExperimentDetail | null>(null);
  const [posts, setPosts] = useState<Record<string, ContentPost | null>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<ExperimentDetail>(`/api/v1/experiments/${id}`);
      setExp(data);

      const postMap: Record<string, ContentPost | null> = {};
      await Promise.all(
        data.variants.map(async (v) => {
          if (v.content_post_id) {
            try {
              const p = await api.get<ContentPost>(`/api/v1/content/posts/${v.content_post_id}`);
              postMap[v.id] = p;
            } catch {
              postMap[v.id] = null;
            }
          }
        })
      );
      setPosts(postMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function startExp() {
    setBusy(true);
    try {
      await api.post(`/api/v1/experiments/${id}/start`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start failed");
    } finally {
      setBusy(false);
    }
  }

  async function completeExp() {
    setBusy(true);
    try {
      await api.post(`/api/v1/experiments/${id}/complete`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Complete failed");
    } finally {
      setBusy(false);
    }
  }

  async function bumpMetric(variantId: string, metric: string) {
    try {
      await api.post(`/api/v1/experiments/${id}/track`, { variant_id: variantId, metric, value: 1 });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Track failed");
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!exp) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
          {error || "Not found"}
        </div>
      </div>
    );
  }

  const maxRate = Math.max(1, ...exp.variants.map(rate));

  return (
    <div>
      <DashboardHeader title={exp.name} />
      <div className="p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="mb-4 rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">{t("brief")}</p>
              <p className="mt-1 text-sm text-text-secondary">{exp.brief}</p>
            </div>
            <div className="flex gap-2">
              {exp.status === "draft" && (
                <button
                  onClick={startExp}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  <Play className="h-3 w-3" />
                  {t("actions.start")}
                </button>
              )}
              {exp.status === "running" && (
                <button
                  onClick={completeExp}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  <Trophy className="h-3 w-3" />
                  {t("actions.declareWinner")}
                </button>
              )}
              {exp.status === "completed" && (
                <span className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("status.completed")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {exp.variants.map((v) => {
            const post = posts[v.id];
            const r = rate(v);
            const pct = maxRate ? Math.round((r / maxRate) * 100) : 0;
            const isWinner = exp.winner_variant_id === v.id;
            return (
              <div
                key={v.id}
                className={`rounded-xl border bg-surface p-4 ${
                  isWinner ? "border-emerald-500 shadow-lg shadow-emerald-500/10" : "border-border"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {v.variant_label}
                    </span>
                    <div>
                      <p className="text-xs font-medium">{v.model_override || t("defaultModel")}</p>
                      <p className="text-[10px] text-text-muted">{v.status}</p>
                    </div>
                  </div>
                  {isWinner && <Trophy className="h-5 w-5 text-emerald-500" />}
                </div>

                {v.status === "failed" && (
                  <div className="mb-2 rounded-md bg-error/10 p-2 text-xs text-error">
                    {v.error || "Generation failed"}
                  </div>
                )}

                {post ? (
                  <div className="mb-3 max-h-40 overflow-y-auto rounded-md border border-border bg-background p-2 text-xs text-text-secondary">
                    <div className="mb-1 font-semibold text-text-primary">{post.title}</div>
                    <div className="whitespace-pre-wrap">{post.body?.slice(0, 500)}</div>
                  </div>
                ) : v.status === "generating" ? (
                  <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("generating")}
                  </div>
                ) : null}

                <div className="mb-2">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-text-muted">{t("metrics.rate")}</span>
                    <span className="font-semibold">{r.toFixed(3)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full ${isWinner ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
                  {(["impressions", "clicks", "engagements", "conversions"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => bumpMetric(v.id, m)}
                      disabled={exp.status === "completed"}
                      className="rounded-md border border-border bg-background p-1 hover:bg-surface-hover disabled:opacity-60"
                    >
                      <div className="font-semibold">{(v as unknown as Record<string, number>)[m]}</div>
                      <div className="text-text-muted">{t(`metrics.${m}`)}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
