"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { api, BASE_URL, getAccessToken } from "@/lib/api";
import { AlertCircle, Check, Loader2, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";

interface GenerateForm {
  title: string;
  period_days: 30 | 60 | 90;
  language: "ar" | "en" | "both";
}

interface MarketingPlan {
  id: string;
  title: string;
  [key: string]: unknown;
}

type NodeKey = "market" | "audience" | "channels" | "calendar" | "kpis";
type NodeStatus = "pending" | "running" | "done" | "failed";

const NODE_KEYS: readonly NodeKey[] = [
  "market",
  "audience",
  "channels",
  "calendar",
  "kpis",
] as const;

interface NodeState {
  status: NodeStatus;
  startedAt: number | null;
  durationMs: number | null;
  summary: Record<string, unknown> | string | null;
}

function initialNodes(): Record<NodeKey, NodeState> {
  return NODE_KEYS.reduce((acc, k) => {
    acc[k] = { status: "pending", startedAt: null, durationMs: null, summary: null };
    return acc;
  }, {} as Record<NodeKey, NodeState>);
}

interface SSEEvent {
  type: "run_started" | "node_start" | "node_end" | "complete" | "error";
  run_id?: string;
  node?: NodeKey;
  summary?: Record<string, unknown> | string;
  duration_ms?: number | null;
  plan_id?: string;
  message?: string;
}

export default function NewPlanPage() {
  const t = useTranslations("plans");
  const router = useRouter();

  const [form, setForm] = useState<GenerateForm>({
    title: "",
    period_days: 30,
    language: "en",
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [nodes, setNodes] = useState<Record<NodeKey, NodeState>>(initialNodes);
  const [tickMs, setTickMs] = useState(0);
  const [globalStart, setGlobalStart] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Cancel stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Timer tick while generating
  useEffect(() => {
    if (!generating || globalStart === null) return;
    const id = setInterval(() => setTickMs(Date.now() - globalStart), 200);
    return () => clearInterval(id);
  }, [generating, globalStart]);

  function handleEvent(ev: SSEEvent) {
    if (ev.type === "node_start" && ev.node) {
      const node = ev.node;
      setNodes((prev) => ({
        ...prev,
        [node]: { ...prev[node], status: "running", startedAt: Date.now() },
      }));
    } else if (ev.type === "node_end" && ev.node) {
      const node = ev.node;
      setNodes((prev) => ({
        ...prev,
        [node]: {
          status: "done",
          startedAt: prev[node].startedAt,
          durationMs: ev.duration_ms ?? null,
          summary: ev.summary ?? null,
        },
      }));
    } else if (ev.type === "complete" && ev.plan_id) {
      router.push(`/plans/${ev.plan_id}`);
    } else if (ev.type === "error") {
      setError(ev.message || t("errorGenerate"));
      setGenerating(false);
      // Mark any running node as failed
      setNodes((prev) => {
        const next = { ...prev };
        for (const k of NODE_KEYS) {
          if (next[k].status === "running") {
            next[k] = { ...next[k], status: "failed" };
          }
        }
        return next;
      });
    }
  }

  async function runStream(token: string): Promise<boolean> {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let resp: Response;
    try {
      resp = await fetch(`${BASE_URL}/api/v1/plans/generate/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          title: form.title,
          period_days: form.period_days,
          language: form.language,
        }),
        signal: ctrl.signal,
      });
    } catch {
      return false;
    }
    if (!resp.ok || !resp.body) return false;

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE event frames are separated by blank line
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const frame of parts) {
          for (const line of frame.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const ev = JSON.parse(line.slice(6)) as SSEEvent;
                handleEvent(ev);
              } catch {
                // ignore malformed line
              }
            }
          }
        }
      }
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return true;
      return false;
    }
  }

  async function runFallback() {
    setUsingFallback(true);
    // Animate pseudo-steps since no stream
    NODE_KEYS.forEach((k, i) => {
      setTimeout(() => {
        setNodes((prev) => ({
          ...prev,
          [k]: { ...prev[k], status: "running", startedAt: Date.now() },
        }));
      }, i * 1500);
    });
    try {
      const plan = await api.post<MarketingPlan>("/api/v1/plans/generate", {
        title: form.title,
        period_days: form.period_days,
        language: form.language,
      });
      setNodes((prev) => {
        const next = { ...prev };
        for (const k of NODE_KEYS) next[k] = { ...next[k], status: "done" };
        return next;
      });
      router.push(`/plans/${plan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGenerate"));
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    setGenerating(true);
    setError(null);
    setUsingFallback(false);
    setNodes(initialNodes());
    setGlobalStart(Date.now());
    setTickMs(0);

    const token = getAccessToken();
    if (!token) {
      setError(t("errorGenerate"));
      setGenerating(false);
      return;
    }

    const ok = await runStream(token);
    if (!ok) {
      await runFallback();
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setGenerating(false);
    setNodes(initialNodes());
  }

  return (
    <div>
      <DashboardHeader title={t("form.title")} />

      <div className="p-6">
        <div className="mx-auto max-w-2xl">
          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {generating ? (
            <div className="rounded-xl border border-border bg-surface p-8">
              <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-4 rounded-full bg-primary/10 p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {t("form.generating")}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{form.title}</p>
                <p className="mt-2 text-xs text-text-muted">
                  {t("generating.elapsed")}: {(tickMs / 1000).toFixed(1)}
                  {t("generating.seconds")}
                </p>
                {usingFallback && (
                  <p className="mt-2 text-xs text-warning">
                    {t("generating.stream.fallback")}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {NODE_KEYS.map((key) => {
                  const n = nodes[key];
                  const elapsedSec =
                    n.status === "running" && n.startedAt
                      ? ((Date.now() - n.startedAt) / 1000).toFixed(1)
                      : n.durationMs != null
                      ? (n.durationMs / 1000).toFixed(1)
                      : null;
                  return (
                    <div
                      key={key}
                      className={clsx(
                        "rounded-lg border px-4 py-3 text-sm transition-colors",
                        n.status === "done" &&
                          "border-success/30 bg-success/5 text-success",
                        n.status === "running" &&
                          "border-primary/30 bg-primary/5 text-primary",
                        n.status === "failed" &&
                          "border-error/30 bg-error/5 text-error",
                        n.status === "pending" &&
                          "border-border bg-background text-text-muted"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                            n.status === "done" && "bg-success text-white",
                            n.status === "running" && "bg-primary text-white",
                            n.status === "failed" && "bg-error text-white",
                            n.status === "pending" && "bg-border text-text-muted"
                          )}
                        >
                          {n.status === "done" ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : n.status === "running" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : n.status === "failed" ? (
                            <X className="h-3.5 w-3.5" />
                          ) : (
                            <span className="text-xs font-medium">
                              {NODE_KEYS.indexOf(key) + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {t(`generating.nodes.${key}`)}
                            </span>
                            {elapsedSec && (
                              <span className="text-xs opacity-70">
                                {elapsedSec}
                                {t("generating.seconds")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted">
                            {t(`generating.nodes.${key}Desc`)}
                          </p>
                          {n.status === "done" && n.summary && (
                            <p className="mt-1 text-xs opacity-80">
                              {typeof n.summary === "string"
                                ? n.summary
                                : Object.entries(n.summary)
                                    .map(([k, v]) => `${k}: ${String(v)}`)
                                    .join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  {t("actions.view")}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-xl border border-border bg-surface p-6"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  {t("form.titleLabel")}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("form.titlePlaceholder")}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  {t("form.periodDays")}
                </label>
                <select
                  value={form.period_days}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      period_days: Number(e.target.value) as 30 | 60 | 90,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={30}>{t("form.period30")}</option>
                  <option value={60}>{t("form.period60")}</option>
                  <option value={90}>{t("form.period90")}</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  {t("form.language")}
                </label>
                <select
                  value={form.language}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      language: e.target.value as GenerateForm["language"],
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ar">{t("form.languageAr")}</option>
                  <option value="en">{t("form.languageEn")}</option>
                  <option value="both">{t("form.languageBoth")}</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/plans")}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  {t("actions.view")}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  <Sparkles className="h-4 w-4" />
                  {t("form.submit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
