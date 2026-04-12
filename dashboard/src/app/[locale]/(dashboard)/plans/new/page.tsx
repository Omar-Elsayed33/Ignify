"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import InsightChip from "@/components/InsightChip";
import Badge from "@/components/Badge";
import { Input } from "@/components/FormField";
import { api, BASE_URL, getAccessToken } from "@/lib/api";
import { AlertCircle, Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";

interface GenerateForm {
  title: string;
  period_days: 30 | 60 | 90;
  language: "ar" | "en" | "both";
}

interface ReadinessField {
  key: string;
  label_en: string;
  label_ar: string;
  severity: "required" | "recommended";
}

interface ReadinessResponse {
  ok: boolean;
  missing: ReadinessField[];
  warnings: ReadinessField[];
  onboarding_url: string;
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

// Select styled to match FormField aesthetic.
function StyledSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/30"
      >
        {children}
      </select>
    </label>
  );
}

export default function NewPlanPage() {
  const t = useTranslations("plans");
  const tR = useTranslations("plansReadiness");
  const router = useRouter();

  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [locale, setLocale] = useState<"ar" | "en">("en");

  useEffect(() => {
    if (typeof document !== "undefined") {
      const l = document.documentElement.lang;
      setLocale(l === "ar" ? "ar" : "en");
    }
  }, []);

  const loadReadiness = async () => {
    setReadinessLoading(true);
    try {
      const r = await api.get<ReadinessResponse>("/api/v1/plans/readiness");
      setReadiness(r);
    } catch {
      setReadiness({ ok: true, missing: [], warnings: [], onboarding_url: "/onboarding/business" });
    } finally {
      setReadinessLoading(false);
    }
  };

  useEffect(() => {
    loadReadiness();
  }, []);

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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const frame of parts) {
          for (const line of frame.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const ev = JSON.parse(line.slice(6)) as SSEEvent;
                handleEvent(ev);
              } catch {
                // ignore
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
      const anyErr = err as { status?: number; data?: { detail?: { missing?: ReadinessField[]; warnings?: ReadinessField[]; onboarding_url?: string } } };
      if (anyErr?.status === 422 && anyErr?.data?.detail?.missing) {
        setReadiness({
          ok: false,
          missing: anyErr.data.detail.missing,
          warnings: anyErr.data.detail.warnings || [],
          onboarding_url: anyErr.data.detail.onboarding_url || "/onboarding/business",
        });
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : t("errorGenerate"));
      }
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

      <div className="p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <PageHeader
            eyebrow="AI · STRATEGY"
            title={t("form.title")}
            description={t("subtitle")}
          />

          {error && (
            <Card padding="sm" className="flex items-center gap-3 !bg-error-container">
              <AlertCircle className="h-4 w-4 shrink-0 text-on-error-container" />
              <span className="text-sm font-medium text-on-error-container">{error}</span>
            </Card>
          )}

          {readinessLoading ? (
            <Card padding="lg" className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </Card>
          ) : readiness && !readiness.ok && !generating ? (
            <Card padding="lg" className="space-y-5">
              <div className="space-y-2">
                <InsightChip icon={AlertCircle}>{tR("title")}</InsightChip>
                <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
                  {tR("title")}
                </h2>
                <p className="text-sm text-on-surface-variant">{tR("subtitle")}</p>
              </div>

              <div>
                <h3 className="mb-3 font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  {tR("requiredSection")}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {readiness.missing.map((f) => (
                    <div
                      key={`m-${f.key}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-error-container px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4 shrink-0 text-on-error-container" />
                        <span className="font-medium text-on-error-container">
                          {locale === "ar" ? f.label_ar : f.label_en}
                        </span>
                      </div>
                      <Link
                        href={readiness.onboarding_url}
                        className="brand-gradient-bg rounded-full px-3 py-1 text-xs font-bold text-white shadow-soft"
                      >
                        {tR("fillThis")}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              {readiness.warnings.length > 0 && (
                <div>
                  <h3 className="mb-3 font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    {tR("optionalSection")}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {readiness.warnings.map((f) => (
                      <div
                        key={`w-${f.key}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                          <span className="font-medium text-on-surface">
                            {locale === "ar" ? f.label_ar : f.label_en}
                          </span>
                        </div>
                        <Link
                          href={readiness.onboarding_url}
                          className="rounded-full bg-surface-container-highest px-3 py-1 text-xs font-bold text-on-surface-variant"
                        >
                          {tR("fillThis")}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={loadReadiness}
                  leadingIcon={<RefreshCw className="h-4 w-4" />}
                >
                  {tR("refresh")}
                </Button>
              </div>
            </Card>
          ) : generating ? (
            <Card padding="lg" className="space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="brand-gradient-bg mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-soft">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
                <h3 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                  {t("form.generating")}
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">{form.title}</p>
                <p className="mt-3 font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  {t("generating.elapsed")}: {(tickMs / 1000).toFixed(1)}
                  {t("generating.seconds")}
                </p>
                {usingFallback && (
                  <Badge tone="warning" className="mt-3">
                    {t("generating.stream.fallback")}
                  </Badge>
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
                        "rounded-2xl bg-surface-container-lowest p-4 shadow-soft transition-all",
                        n.status === "running" && "ring-2 ring-primary/30"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={clsx(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-headline text-sm font-bold",
                            n.status === "done" && "bg-emerald-100 text-emerald-600",
                            n.status === "running" && "brand-gradient-bg text-white",
                            n.status === "failed" && "bg-error-container text-on-error-container",
                            n.status === "pending" && "bg-surface-container-high text-on-surface-variant"
                          )}
                        >
                          {n.status === "done" ? (
                            <Check className="h-5 w-5" />
                          ) : n.status === "running" ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : n.status === "failed" ? (
                            <X className="h-5 w-5" />
                          ) : (
                            NODE_KEYS.indexOf(key) + 1
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-headline text-sm font-bold text-on-surface">
                              {t(`generating.nodes.${key}`)}
                            </span>
                            {elapsedSec && (
                              <span className="text-xs font-semibold text-on-surface-variant">
                                {elapsedSec}
                                {t("generating.seconds")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant">
                            {t(`generating.nodes.${key}Desc`)}
                          </p>
                          {n.status === "done" && n.summary && (
                            <p className="mt-2 text-xs text-on-surface-variant/80">
                              {typeof n.summary === "string"
                                ? n.summary
                                : Object.entries(n.summary)
                                    .map(([k, v]) => `${k}: ${String(v)}`)
                                    .join(" · ")}
                            </p>
                          )}
                          {/* gradient progress bar when running */}
                          {n.status === "running" && (
                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-container-high">
                              <div className="brand-gradient-bg h-full w-1/2 animate-pulse rounded-full" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  {t("actions.view")}
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding="lg">
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label={t("form.titleLabel")}
                  required
                  placeholder={t("form.titlePlaceholder")}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <StyledSelect
                    label={t("form.periodDays")}
                    value={form.period_days}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, period_days: Number(v) as 30 | 60 | 90 }))
                    }
                  >
                    <option value={30}>{t("form.period30")}</option>
                    <option value={60}>{t("form.period60")}</option>
                    <option value={90}>{t("form.period90")}</option>
                  </StyledSelect>

                  <StyledSelect
                    label={t("form.language")}
                    value={form.language}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, language: v as GenerateForm["language"] }))
                    }
                  >
                    <option value="ar">{t("form.languageAr")}</option>
                    <option value="en">{t("form.languageEn")}</option>
                    <option value="both">{t("form.languageBoth")}</option>
                  </StyledSelect>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push("/plans")}
                  >
                    {t("actions.view")}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    leadingIcon={<Sparkles className="h-4 w-4" />}
                  >
                    {t("form.submit")}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
