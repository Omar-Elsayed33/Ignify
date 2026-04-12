"use client";

import { useEffect, useState, use } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import InsightChip from "@/components/InsightChip";
import Avatar from "@/components/Avatar";
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

const FIELD_LABELS: Record<string, { ar: string; en: string }> = {
  metric: { ar: "المؤشر", en: "Metric" },
  target: { ar: "الهدف", en: "Target" },
  unit: { ar: "الوحدة", en: "Unit" },
  timeframe_days: { ar: "الإطار الزمني (أيام)", en: "Timeframe (days)" },
  channel: { ar: "القناة", en: "Channel" },
  channels: { ar: "القنوات", en: "Channels" },
  name: { ar: "الاسم", en: "Name" },
  age_range: { ar: "الفئة العمرية", en: "Age range" },
  role: { ar: "الدور", en: "Role" },
  goals: { ar: "الأهداف", en: "Goals" },
  pains: { ar: "التحديات", en: "Pains" },
  objections: { ar: "الاعتراضات", en: "Objections" },
  priority: { ar: "الأولوية", en: "Priority" },
  rationale: { ar: "المبرر", en: "Rationale" },
  posting_frequency_per_week: { ar: "تكرار النشر أسبوعياً", en: "Posts per week" },
  budget_share_pct: { ar: "حصة الميزانية (%)", en: "Budget share (%)" },
  day: { ar: "اليوم", en: "Day" },
  format: { ar: "النوع", en: "Format" },
  topic: { ar: "الموضوع", en: "Topic" },
  hook: { ar: "الجملة الجاذبة", en: "Hook" },
  cta: { ar: "الدعوة للعمل", en: "CTA" },
  hashtags: { ar: "الوسوم", en: "Hashtags" },
  summary: { ar: "الملخص", en: "Summary" },
  competitors: { ar: "المنافسون", en: "Competitors" },
  trends: { ar: "الاتجاهات", en: "Trends" },
  swot: { ar: "تحليل SWOT", en: "SWOT" },
  strengths: { ar: "نقاط القوة", en: "Strengths" },
  weaknesses: { ar: "نقاط الضعف", en: "Weaknesses" },
  opportunities: { ar: "الفرص", en: "Opportunities" },
  threats: { ar: "التهديدات", en: "Threats" },
  platform: { ar: "المنصة", en: "Platform" },
  score: { ar: "التقييم", en: "Score" },
  reason: { ar: "السبب", en: "Reason" },
  impressions: { ar: "المشاهدات", en: "Impressions" },
  clicks: { ar: "النقرات", en: "Clicks" },
  leads: { ar: "العملاء المحتملون", en: "Leads" },
  customers: { ar: "العملاء", en: "Customers" },
};

function labelFor(key: string, lang: "ar" | "en"): string {
  const entry = FIELD_LABELS[key];
  if (entry) return entry[lang];
  return key.replace(/_/g, " ");
}

function JsonBlock({ data, lang = "en" }: { data: unknown; lang?: "ar" | "en" }) {
  if (data === null || data === undefined) return null;
  if (typeof data === "string") {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">{data}</p>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    if (data.every((x) => typeof x === "string" || typeof x === "number")) {
      return (
        <ul className="list-disc space-y-2 ps-5 text-sm leading-relaxed text-on-surface-variant">
          {data.map((item, i) => (
            <li key={i}>{String(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="rounded-xl bg-surface-container-low p-4">
            <JsonBlock data={item} lang={lang} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <dl className="space-y-3">
        {entries.map(([k, v]) => (
          <div key={k} className="text-sm">
            <dt className="mb-1 font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              {labelFor(k, lang)}
            </dt>
            <dd className="ps-2">
              <JsonBlock data={v} lang={lang} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="text-sm text-on-surface-variant">{String(data)}</span>;
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
    <Card padding="lg">
      <div className="mb-4 flex items-center gap-3">
        <div className="brand-gradient-bg flex h-10 w-10 items-center justify-center rounded-xl shadow-soft">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <h3 className="font-headline text-base font-bold tracking-tight text-on-surface">
          {title}
        </h3>
      </div>
      <div>{children}</div>
    </Card>
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
      <Button
        variant="secondary"
        size="sm"
        onClick={() => regenerate(section)}
        disabled={busy}
        leadingIcon={
          busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )
        }
      >
        {busy ? tr("regenerating") : tr("button")}
      </Button>
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

  const statusTone = (status: MarketingPlan["status"]) => {
    if (status === "approved") return "success" as const;
    if (status === "draft") return "primary" as const;
    return "neutral" as const;
  };

  const statusLabel = (status: MarketingPlan["status"]) => {
    const labels: Record<string, string> = {
      draft: t("status.draft"),
      approved: t("status.approved"),
      archived: t("status.archived"),
    };
    return labels[status] ?? status;
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

      <div className="p-8">
        <div className="space-y-8">
          <button
            onClick={() => router.push("/plans")}
            className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("title")}
          </button>

          {error && (
            <Card padding="sm" className="flex items-center gap-3 !bg-error-container">
              <AlertCircle className="h-4 w-4 shrink-0 text-on-error-container" />
              <span className="text-sm font-medium text-on-error-container">{error}</span>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !plan ? null : (
            <>
              {/* Editorial hero */}
              <div className="space-y-4">
                <div className="brand-gradient-bg h-1 w-24 rounded-full" />
                <PageHeader
                  eyebrow="MARKETING PLAN"
                  title={plan.title}
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full bg-surface-container-low p-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setPdfLang("en")}
                          className={clsx(
                            "rounded-full px-3 py-1 font-bold",
                            pdfLang === "en" ? "brand-gradient-bg text-white" : "text-on-surface-variant"
                          )}
                        >
                          EN
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfLang("ar")}
                          className={clsx(
                            "rounded-full px-3 py-1 font-bold",
                            pdfLang === "ar" ? "brand-gradient-bg text-white" : "text-on-surface-variant"
                          )}
                        >
                          AR
                        </button>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={handleExportPdf}
                        disabled={exporting}
                        leadingIcon={
                          exporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )
                        }
                      >
                        {t("actions.exportPdf")}
                      </Button>
                      {plan.status !== "approved" && (
                        <Button
                          variant="primary"
                          onClick={handleApprove}
                          disabled={approving}
                          leadingIcon={
                            approving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )
                          }
                        >
                          {t("actions.approve")}
                        </Button>
                      )}
                    </div>
                  }
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={statusTone(plan.status)}>{statusLabel(plan.status)}</Badge>
                  <InsightChip icon={CalendarIcon}>
                    {plan.period_days} {t("days")}
                  </InsightChip>
                  <span className="text-sm font-medium text-on-surface-variant">
                    {new Date(plan.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
                {/* Pills tab nav */}
                <Tabs.List className="mb-8 flex flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <Tabs.Trigger
                      key={tab.value}
                      value={tab.value}
                      className={clsx(
                        "rounded-full px-4 py-2 font-headline text-xs font-bold uppercase tracking-widest transition-all",
                        activeTab === tab.value
                          ? "brand-gradient-bg text-white shadow-soft"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
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
                    <JsonBlock data={plan.goals} lang={lang} />
                  </SectionCard>
                  <SectionCard icon={FileText} title={t("sections.overview")}>
                    <JsonBlock lang={lang}
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
                    <JsonBlock data={plan.market_analysis} lang={lang} />
                  </SectionCard>
                  {plan.competitors !== undefined && (
                    <SectionCard icon={Users} title={t("fields.competitors")}>
                      <JsonBlock data={plan.competitors} lang={lang} />
                    </SectionCard>
                  )}
                  {plan.swot !== undefined && (
                    <SectionCard icon={FileText} title={t("fields.swot")}>
                      <JsonBlock data={plan.swot} lang={lang} />
                    </SectionCard>
                  )}
                  {plan.trends !== undefined && (
                    <SectionCard icon={TrendingUp} title={t("fields.trends")}>
                      <JsonBlock data={plan.trends} lang={lang} />
                    </SectionCard>
                  )}
                </Tabs.Content>

                <Tabs.Content value="audience" className="space-y-4">
                  <div className="flex justify-end">
                    <RegenBtn section="personas" />
                  </div>
                  {personas.length > 0 ? (
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                      {personas.map((p, i) => (
                        <Card key={i} padding="lg">
                          <div className="mb-4 flex items-center gap-3">
                            <Avatar name={p.name ?? `P${i + 1}`} premium size="md" />
                            <div>
                              <h4 className="font-headline text-base font-bold tracking-tight text-on-surface">
                                {p.name ?? `Persona ${i + 1}`}
                              </h4>
                              {p.age && (
                                <p className="text-xs font-medium text-on-surface-variant">
                                  {p.age}
                                </p>
                              )}
                            </div>
                          </div>
                          <JsonBlock data={p} lang={lang} />
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <SectionCard icon={Users} title={t("fields.personas")}>
                      <JsonBlock data={plan.personas} lang={lang} />
                    </SectionCard>
                  )}
                </Tabs.Content>

                <Tabs.Content value="channels" className="space-y-4">
                  <div className="flex justify-end">
                    <RegenBtn section="channels" />
                  </div>
                  <SectionCard icon={Radio} title={t("fields.channels")}>
                    <JsonBlock data={plan.channels} lang={lang} />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="calendar" className="space-y-4">
                  <div className="flex justify-end">
                    <RegenBtn section="calendar" />
                  </div>
                  {calendar.length > 0 ? (
                    <Card padding="none" className="overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-surface-container-low">
                          <tr>
                            <th className="px-5 py-4 text-start font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                              {t("table.day")}
                            </th>
                            <th className="px-5 py-4 text-start font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                              {t("table.channel")}
                            </th>
                            <th className="px-5 py-4 text-start font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                              {t("table.format")}
                            </th>
                            <th className="px-5 py-4 text-start font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                              {t("table.topic")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {calendar.map((entry, i) => (
                            <tr
                              key={i}
                              className={clsx(
                                "transition-colors",
                                i % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low/40"
                              )}
                            >
                              <td className="px-5 py-4 font-headline font-bold text-on-surface">
                                {entry.day ?? entry.date ?? i + 1}
                              </td>
                              <td className="px-5 py-4 text-on-surface-variant">
                                {entry.channel ?? "—"}
                              </td>
                              <td className="px-5 py-4 text-on-surface-variant">
                                {entry.format ?? "—"}
                              </td>
                              <td className="px-5 py-4 text-on-surface-variant">
                                {entry.topic ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  ) : (
                    <SectionCard icon={CalendarIcon} title={t("fields.calendar")}>
                      <JsonBlock data={plan.calendar} lang={lang} />
                    </SectionCard>
                  )}
                </Tabs.Content>

                <Tabs.Content value="kpis" className="space-y-4">
                  <div className="flex justify-end">
                    <RegenBtn section="kpis" />
                  </div>
                  <SectionCard icon={TrendingUp} title={t("fields.kpis")}>
                    <JsonBlock data={plan.kpis} lang={lang} />
                  </SectionCard>
                </Tabs.Content>
              </Tabs.Root>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
