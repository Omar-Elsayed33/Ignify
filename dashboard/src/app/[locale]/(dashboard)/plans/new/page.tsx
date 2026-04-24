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
import { AlertCircle, Check, Loader2, RefreshCw, Sparkles, Zap, BarChart2, Brain, X } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";

type PlanMode = "fast" | "medium" | "deep";

interface GenerateForm {
  title: string;
  period_days: 30 | 60 | 90;
  language: "ar" | "en" | "both";
  plan_mode: PlanMode;
  budget_monthly_usd: number | null;
  budget_currency: "usd" | "egp" | "sar" | "aed" | "kwd";
  primary_goal: string;
  urgency_days: 30 | 60 | 90;
}

// null = AI will recommend best budget based on business profile
const BUDGET_TIERS = [null, 0, 100, 300, 500, 1000, 2000, 5000] as const;

// 1 USD ≈ these (approximate — used only for display suggestions)
const FX: Record<string, { rate: number; symbol: string; code: string; label_ar: string; label_en: string }> = {
  usd: { rate: 1, symbol: "$", code: "USD", label_ar: "دولار أمريكي", label_en: "US Dollar" },
  egp: { rate: 48, symbol: "ج.م", code: "EGP", label_ar: "جنيه مصري", label_en: "Egyptian Pound" },
  sar: { rate: 3.75, symbol: "ر.س", code: "SAR", label_ar: "ريال سعودي", label_en: "Saudi Riyal" },
  aed: { rate: 3.67, symbol: "د.إ", code: "AED", label_ar: "درهم إماراتي", label_en: "UAE Dirham" },
  kwd: { rate: 0.31, symbol: "د.ك", code: "KWD", label_ar: "دينار كويتي", label_en: "Kuwaiti Dinar" },
};

// Round to nice-looking local amounts (e.g. 500 USD = 1875 SAR ≈ round to 2000)
function toLocal(usd: number, currency: string): number {
  if (usd === 0) return 0;
  const rate = FX[currency]?.rate ?? 1;
  const local = usd * rate;
  if (currency === "kwd") return Math.round(local * 10) / 10; // KWD: 1 decimal
  if (local < 500) return Math.round(local / 10) * 10;
  if (local < 5000) return Math.round(local / 50) * 50;
  return Math.round(local / 100) * 100;
}

const COUNTRY_CURRENCY: Record<string, "usd" | "egp" | "sar" | "aed" | "kwd"> = {
  EG: "egp", SA: "sar", AE: "aed", KW: "kwd",
  QA: "aed", BH: "aed", OM: "aed",
};

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

type NodeKey =
  | "market"
  | "audience"
  | "positioning"
  | "customer_journey"
  | "offer"
  | "funnel"
  | "channels"
  | "conversion"
  | "retention"
  | "growth_loops"
  | "calendar"
  | "kpis"
  | "ads"
  | "execution_roadmap";
type NodeStatus = "pending" | "running" | "done" | "failed";

const NODE_KEYS: readonly NodeKey[] = [
  "market",
  "audience",
  "positioning",
  "customer_journey",
  "offer",
  "funnel",
  "channels",
  "conversion",
  "retention",
  "growth_loops",
  "calendar",
  "kpis",
  "ads",
  "execution_roadmap",
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

  // Auto-detect currency by country once (cached in localStorage)
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ignify_currency") : null;
    if (stored && FX[stored.toLowerCase()]) {
      setForm((f) => ({ ...f, budget_currency: stored.toLowerCase() as "usd" | "egp" | "sar" | "aed" | "kwd" }));
      return;
    }
    fetch(`${BASE_URL}/api/v1/geo/detect`)
      .then((r) => r.json())
      .then((d) => {
        const cur = COUNTRY_CURRENCY[String(d.country || "").toUpperCase()] || "usd";
        setForm((f) => ({ ...f, budget_currency: cur }));
        localStorage.setItem("ignify_currency", cur.toUpperCase());
      })
      .catch(() => {});
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
    plan_mode: "fast",
    budget_monthly_usd: null,
    budget_currency: "usd",
    primary_goal: "",
    urgency_days: 30,
  });

  // One-shot prefill from business profile. Only fills fields that are currently empty.
  useEffect(() => {
    (async () => {
      try {
        const bp = await api.get<{
          industry?: string | null;
          description?: string | null;
          target_audience?: string | null;
          business_name?: string | null;
          main_goal?: string | null;
          goals?: string | string[] | null;
          competitors?: string[] | null;
        }>("/api/v1/tenant-settings/business-profile");
        if (!bp) return;
        setForm((f) => {
          const next = { ...f };
          if (!next.title && bp.business_name) {
            next.title = bp.business_name;
          }
          if (!next.primary_goal) {
            const goal =
              bp.main_goal ||
              (Array.isArray(bp.goals) ? bp.goals.join(", ") : bp.goals) ||
              bp.target_audience ||
              bp.description ||
              "";
            if (goal) next.primary_goal = String(goal);
          }
          return next;
        });
      } catch {
        // silent: prefill is a convenience, not critical
      }
    })();
  }, []);
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
          plan_mode: form.plan_mode,
          budget_monthly_usd: form.budget_monthly_usd,
          budget_currency: form.budget_currency,
          primary_goal: form.primary_goal || null,
          urgency_days: form.urgency_days,
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
        plan_mode: form.plan_mode,
        budget_monthly_usd: form.budget_monthly_usd,
        budget_currency: form.budget_currency,
        primary_goal: form.primary_goal || null,
        urgency_days: form.urgency_days,
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
                {/* ── Plan Mode Selector ── */}
                <div className="space-y-3">
                  <span className="font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    {t("form.planMode")}
                  </span>
                  {/*
                    Phase 5 P5: plan-mode cards rewritten to explain what
                    actually differs across modes. Previously all 3 cards
                    showed "~3 min · $X" which made the 59× price delta
                    look arbitrary. Now each card surfaces:
                     - the model stack used (different models = real quality
                       difference, not just marketing copy)
                     - a concrete use case so the user knows which is right
                       for their situation
                     - the cost and time as a secondary line, not the hook
                  */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(
                      [
                        {
                          mode: "fast" as PlanMode,
                          icon: <Zap className="h-5 w-5" />,
                          color: "text-amber-500",
                          name_ar: "مسودة سريعة",
                          name_en: "Quick Draft",
                          models_ar: "GPT-4o لكل الأقسام",
                          models_en: "GPT-4o for all sections",
                          use_ar: "للتجربة والاستكشاف السريع",
                          use_en: "For exploring options quickly",
                          sub_ar: "~3 دقائق · $0.01",
                          sub_en: "~3 min · $0.01",
                        },
                        {
                          mode: "medium" as PlanMode,
                          icon: <BarChart2 className="h-5 w-5" />,
                          color: "text-blue-500",
                          name_ar: "متوازن",
                          name_en: "Balanced",
                          models_ar: "Gemini لتحليل السوق + GPT-4o للتنفيذ",
                          models_en: "Gemini for analysis + GPT-4o for execution",
                          use_ar: "الخيار الموصى به لأغلب الأنشطة",
                          use_en: "Recommended for most businesses",
                          sub_ar: "~3 دقائق · $0.38",
                          sub_en: "~3 min · $0.38",
                        },
                        {
                          mode: "deep" as PlanMode,
                          icon: <Brain className="h-5 w-5" />,
                          color: "text-purple-500",
                          name_ar: "متميز",
                          name_en: "Premium",
                          models_ar: "Claude للاستراتيجية + Gemini + GPT-4o",
                          models_en: "Claude for strategy + Gemini + GPT-4o",
                          use_ar: "لخطط تطلق حقاً وتستخدمها مع فريقك",
                          use_en: "When the plan will actually drive real spend",
                          sub_ar: "~3 دقائق · $0.59",
                          sub_en: "~3 min · $0.59",
                        },
                      ] as const
                    ).map(({ mode, icon, color, name_ar, name_en, models_ar, models_en, use_ar, use_en, sub_ar, sub_en }) => {
                      const active = form.plan_mode === mode;
                      const isAr = locale === "ar";
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, plan_mode: mode }))}
                          className={clsx(
                            "flex flex-col gap-2 rounded-2xl border-2 p-4 text-start transition-all",
                            active
                              ? "border-primary bg-primary/5 shadow-soft"
                              : "border-transparent bg-surface-container-low hover:bg-surface-container"
                          )}
                        >
                          <div className={clsx("flex items-center gap-2 font-headline font-bold text-on-surface", color)}>
                            {icon}
                            <span className="text-sm">{isAr ? name_ar : name_en}</span>
                          </div>
                          {/* Model stack — the real reason the price differs. */}
                          <p className="text-[11px] font-medium text-on-surface leading-snug">
                            {isAr ? models_ar : models_en}
                          </p>
                          {/* Concrete use case, in plain language. */}
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            {isAr ? use_ar : use_en}
                          </p>
                          {/* Cost + time as a footer, no longer the headline. */}
                          <p className="text-[11px] text-on-surface-variant opacity-75">
                            {isAr ? sub_ar : sub_en}
                          </p>
                          {active && (
                            <div className="flex items-center gap-1 mt-1">
                              <Check className="h-3 w-3 text-primary" />
                              <span className="text-[11px] font-bold text-primary">{t("form.mode.selected")}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* Per-mode disclaimer: no "X is always best" vibe. */}
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    {locale === "ar"
                      ? "الوضع لا يغير وقت الإنجاز، لكنه يغير جودة التحليل وعمق الاستراتيجية. ابدأ بالسريع لاستكشاف الأفكار، واستخدم المتميز قبل الإنفاق على الإعلانات."
                      : "Mode doesn't change generation time, but it changes analysis depth and strategic reasoning. Start with Quick Draft to explore, use Premium before committing ad spend."}
                  </p>
                </div>

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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                      {t("form.budget")}
                    </span>
                    {/* Currency pills */}
                    <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
                      {(["sar", "aed", "egp", "kwd", "usd"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, budget_currency: c }));
                            localStorage.setItem("ignify_currency", c.toUpperCase());
                          }}
                          className={clsx(
                            "rounded-full px-3 py-1 text-[11px] font-bold uppercase transition-all",
                            form.budget_currency === c
                              ? "brand-gradient-bg text-white shadow-soft"
                              : "text-on-surface-variant hover:bg-surface-container"
                          )}
                        >
                          {FX[c].code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Budget tier cards */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8">
                    {BUDGET_TIERS.map((tier) => {
                      const isActive = form.budget_monthly_usd === tier;
                      const local = tier !== null ? toLocal(tier, form.budget_currency) : 0;
                      const fx = FX[form.budget_currency];
                      return (
                        <button
                          key={tier ?? "ai"}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, budget_monthly_usd: tier }))}
                          className={clsx(
                            "flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all",
                            isActive
                              ? "border-primary bg-primary/5 shadow-soft"
                              : "border-transparent bg-surface-container-low hover:bg-surface-container",
                            tier === null && "col-span-2 sm:col-span-1"
                          )}
                        >
                          {tier === null ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <Sparkles className={clsx("h-4 w-4", isActive ? "text-primary" : "text-amber-500")} />
                              <span className="font-headline text-xs font-bold text-on-surface text-center leading-tight">
                                {locale === "ar" ? "AI يختار" : "AI picks"}
                              </span>
                              <span className="text-[9px] text-on-surface-variant text-center">
                                {locale === "ar" ? "الأنسب لنشاطك" : "best for you"}
                              </span>
                            </div>
                          ) : tier === 0 ? (
                            <span className="font-headline text-xs font-bold text-on-surface">
                              {locale === "ar" ? "عضوي فقط" : "Organic"}
                            </span>
                          ) : (
                            <>
                              <span className="font-headline text-base font-bold text-on-surface">
                                {fx.symbol} {local.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
                              </span>
                              <span className="text-[10px] text-on-surface-variant">
                                {locale === "ar" ? "شهرياً" : "/month"}
                              </span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-on-surface-variant">
                    {locale === "ar"
                      ? `العملة المختارة: ${FX[form.budget_currency].label_ar}. القيم معروضة بما يعادل الدولار للعمليات الداخلية.`
                      : `Selected currency: ${FX[form.budget_currency].label_en}. Values stored in USD equivalent.`}
                  </p>
                </div>

                <StyledSelect
                  label={t("form.urgency")}
                  value={form.urgency_days}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, urgency_days: Number(v) as 30 | 60 | 90 }))
                  }
                >
                  <option value={30}>{t("form.urgency30")}</option>
                  <option value={60}>{t("form.urgency60")}</option>
                  <option value={90}>{t("form.urgency90")}</option>
                </StyledSelect>

                <p className="text-xs text-on-surface-variant">{t("form.budgetHelp")}</p>

                <label className="block space-y-1.5">
                  <span className="font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    {t("form.primaryGoal")}
                  </span>
                  <textarea
                    value={form.primary_goal}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, primary_goal: e.target.value }))
                    }
                    placeholder={t("form.primaryGoalPlaceholder")}
                    rows={3}
                    className="w-full resize-none rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/30"
                  />
                </label>

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
                    disabled={generating || !form.title.trim()}
                    leadingIcon={
                      generating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )
                    }
                  >
                    {generating ? (locale === "ar" ? "جارٍ الإرسال…" : "Submitting…") : t("form.submit")}
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
