"use client";

import { useEffect, useState, use } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { api, BASE_URL, getAccessToken } from "@/lib/api";
import * as Tabs from "@radix-ui/react-tabs";
import {
  AlertCircle,
  Loader2,
  Check,
  ArrowLeft,
  Users,
  Target,
  Radio,
  Calendar as CalendarIcon,
  TrendingUp,
  FileText,
  RefreshCw,
  Download,
} from "lucide-react";
import { clsx } from "clsx";

interface Persona {
  name?: string;
  age?: string;
  description?: string;
  pain_points?: string[] | string;
  goals?: string[] | string;
  [key: string]: unknown;
}

interface CalendarEntry {
  day?: number | string;
  date?: string;
  channel?: string;
  format?: string;
  topic?: string;
  [key: string]: unknown;
}

interface MarketingPlan {
  id: string;
  title: string;
  period_days: number;
  language?: string;
  status: "draft" | "approved" | "archived";
  created_at: string;
  goals?: unknown;
  personas?: Persona[] | unknown;
  channels?: unknown;
  calendar?: CalendarEntry[] | unknown;
  kpis?: unknown;
  market_analysis?: unknown;
  competitors?: unknown;
  swot?: unknown;
  trends?: unknown;
  [key: string]: unknown;
}

function JsonBlock({ data }: { data: unknown }) {
  if (data === null || data === undefined) return null;
  if (typeof data === "string") {
    return <p className="whitespace-pre-wrap text-sm text-text-secondary">{data}</p>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    if (data.every((x) => typeof x === "string" || typeof x === "number")) {
      return (
        <ul className="list-disc space-y-1.5 ps-5 text-sm text-text-secondary">
          {data.map((item, i) => (
            <li key={i}>{String(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="rounded-lg border border-border bg-background p-3">
            <JsonBlock data={item} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <dl className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="text-sm">
            <dt className="mb-0.5 font-medium capitalize text-text-primary">
              {k.replace(/_/g, " ")}
            </dt>
            <dd className="ps-2">
              <JsonBlock data={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="text-sm text-text-secondary">{String(data)}</span>;
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-1.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("plans");
  const tr = useTranslations("plansRegenerate");
  const router = useRouter();
  const locale = useLocale();
  const [pdfLang, setPdfLang] = useState<"ar" | "en">(
    (locale === "ar" ? "ar" : "en") as "ar" | "en"
  );
  const [exporting, setExporting] = useState(false);

  async function handleExportPdf() {
    if (!plan) return;
    try {
      setExporting(true);
      const token = getAccessToken();
      const url = `${BASE_URL}/api/v1/plans/${plan.id}/export.pdf?lang=${pdfLang}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const dl = document.createElement("a");
      dl.href = URL.createObjectURL(blob);
      dl.download = `${plan.title || "plan"}-${pdfLang}.pdf`;
      document.body.appendChild(dl);
      dl.click();
      dl.remove();
      URL.revokeObjectURL(dl.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  }

  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [regenSection, setRegenSection] = useState<string | null>(null);

  async function regenerate(section: "goals" | "personas" | "channels" | "calendar" | "kpis") {
    if (!plan) return;
    if (!confirm(tr("confirm"))) return;
    try {
      setRegenSection(section);
      setError(null);
      const updated = await api.post<MarketingPlan>(
        `/api/v1/plans/${plan.id}/regenerate-section`,
        { section, language: plan.language || "ar" }
      );
      setPlan(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenSection(null);
    }
  }

  const RegenBtn = ({ section }: { section: "goals" | "personas" | "channels" | "calendar" | "kpis" }) => {
    const busy = regenSection === section;
    return (
      <button
        onClick={() => regenerate(section)}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {busy ? tr("regenerating") : tr("button")}
      </button>
    );
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<MarketingPlan>(`/api/v1/plans/${id}`);
        setPlan(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errorLoad"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  async function handleApprove() {
    if (!plan) return;
    try {
      setApproving(true);
      setError(null);
      const updated = await api.post<MarketingPlan>(`/api/v1/plans/${plan.id}/approve`);
      setPlan(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorApprove"));
    } finally {
      setApproving(false);
    }
  }

  const statusBadge = (status: MarketingPlan["status"]) => {
    const colors: Record<string, string> = {
      draft: "bg-text-muted/10 text-text-muted",
      approved: "bg-success/10 text-success",
      archived: "bg-border text-text-muted",
    };
    const labels: Record<string, string> = {
      draft: t("status.draft"),
      approved: t("status.approved"),
      archived: t("status.archived"),
    };
    return (
      <span
        className={clsx(
          "rounded-full px-2.5 py-0.5 text-xs font-medium",
          colors[status] ?? "bg-border text-text-muted"
        )}
      >
        {labels[status] ?? status}
      </span>
    );
  };

  const tabs = [
    { value: "overview", label: t("sections.overview") },
    { value: "market", label: t("sections.market") },
    { value: "audience", label: t("sections.audience") },
    { value: "channels", label: t("sections.channels") },
    { value: "calendar", label: t("sections.calendar") },
    { value: "kpis", label: t("sections.kpis") },
  ];

  const personas = Array.isArray(plan?.personas) ? (plan?.personas as Persona[]) : [];
  const calendar = Array.isArray(plan?.calendar) ? (plan?.calendar as CalendarEntry[]) : [];

  return (
    <div>
      <DashboardHeader title={plan?.title ?? t("title")} />

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/plans")}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("title")}
          </button>

          <div className="flex items-center gap-2">
            {plan && (
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPdfLang("en")}
                  className={clsx(
                    "rounded px-2 py-1",
                    pdfLang === "en" ? "bg-primary text-white" : "text-text-secondary"
                  )}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setPdfLang("ar")}
                  className={clsx(
                    "rounded px-2 py-1",
                    pdfLang === "ar" ? "bg-primary text-white" : "text-text-secondary"
                  )}
                >
                  AR
                </button>
              </div>
            )}
            {plan && (
              <button
                onClick={handleExportPdf}
                disabled={exporting}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-60"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t("actions.exportPdf")}
              </button>
            )}
          {plan && plan.status !== "approved" && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {approving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {t("actions.approve")}
            </button>
          )}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !plan ? null : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
              {statusBadge(plan.status)}
              <span className="text-sm text-text-secondary">
                {t("fields.period")}: {plan.period_days} {t("days")}
              </span>
              <span className="text-sm text-text-muted">
                {new Date(plan.created_at).toLocaleDateString()}
              </span>
            </div>

            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
              <Tabs.List className="mb-6 flex flex-wrap gap-1 rounded-lg bg-background p-1">
                {tabs.map((tab) => (
                  <Tabs.Trigger
                    key={tab.value}
                    value={tab.value}
                    className={clsx(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      activeTab === tab.value
                        ? "bg-surface text-primary shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {tab.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <Tabs.Content value="overview" className="space-y-4">
                <div className="flex justify-end">
                  <RegenBtn section="goals" />
                </div>
                <SectionCard icon={Target} title={t("fields.goals")}>
                  <JsonBlock data={plan.goals} />
                </SectionCard>
                <SectionCard icon={FileText} title={t("sections.overview")}>
                  <JsonBlock
                    data={{
                      period: `${plan.period_days} ${t("days")}`,
                      language: plan.language,
                      status: plan.status,
                    }}
                  />
                </SectionCard>
              </Tabs.Content>

              <Tabs.Content value="market" className="space-y-4">
                <SectionCard icon={TrendingUp} title={t("fields.marketAnalysis")}>
                  <JsonBlock data={plan.market_analysis} />
                </SectionCard>
                {plan.competitors !== undefined && (
                  <SectionCard icon={Users} title={t("fields.competitors")}>
                    <JsonBlock data={plan.competitors} />
                  </SectionCard>
                )}
                {plan.swot !== undefined && (
                  <SectionCard icon={FileText} title={t("fields.swot")}>
                    <JsonBlock data={plan.swot} />
                  </SectionCard>
                )}
                {plan.trends !== undefined && (
                  <SectionCard icon={TrendingUp} title={t("fields.trends")}>
                    <JsonBlock data={plan.trends} />
                  </SectionCard>
                )}
              </Tabs.Content>

              <Tabs.Content value="audience" className="space-y-4">
                <div className="flex justify-end">
                  <RegenBtn section="personas" />
                </div>
                {personas.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {personas.map((p, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border bg-surface p-5"
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <div className="rounded-full bg-primary/10 p-2">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <h4 className="text-sm font-semibold text-text-primary">
                            {p.name ?? `Persona ${i + 1}`}
                          </h4>
                        </div>
                        <JsonBlock data={p} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <SectionCard icon={Users} title={t("fields.personas")}>
                    <JsonBlock data={plan.personas} />
                  </SectionCard>
                )}
              </Tabs.Content>

              <Tabs.Content value="channels" className="space-y-4">
                <div className="flex justify-end">
                  <RegenBtn section="channels" />
                </div>
                <SectionCard icon={Radio} title={t("fields.channels")}>
                  <JsonBlock data={plan.channels} />
                </SectionCard>
              </Tabs.Content>

              <Tabs.Content value="calendar" className="space-y-4">
                <div className="flex justify-end">
                  <RegenBtn section="calendar" />
                </div>
                {calendar.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-surface">
                    <table className="w-full text-sm">
                      <thead className="bg-background text-xs uppercase text-text-muted">
                        <tr>
                          <th className="px-4 py-3 text-start font-medium">
                            {t("table.day")}
                          </th>
                          <th className="px-4 py-3 text-start font-medium">
                            {t("table.channel")}
                          </th>
                          <th className="px-4 py-3 text-start font-medium">
                            {t("table.format")}
                          </th>
                          <th className="px-4 py-3 text-start font-medium">
                            {t("table.topic")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {calendar.map((entry, i) => (
                          <tr key={i} className="hover:bg-background">
                            <td className="px-4 py-3 text-text-primary">
                              {entry.day ?? entry.date ?? i + 1}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {entry.channel ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {entry.format ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {entry.topic ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <SectionCard icon={CalendarIcon} title={t("fields.calendar")}>
                    <JsonBlock data={plan.calendar} />
                  </SectionCard>
                )}
              </Tabs.Content>

              <Tabs.Content value="kpis" className="space-y-4">
                <div className="flex justify-end">
                  <RegenBtn section="kpis" />
                </div>
                <SectionCard icon={TrendingUp} title={t("fields.kpis")}>
                  <JsonBlock data={plan.kpis} />
                </SectionCard>
              </Tabs.Content>
            </Tabs.Root>
          </>
        )}
      </div>
    </div>
  );
}
