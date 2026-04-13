"use client";

import { useEffect, useState, use } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
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
  Image as ImageIcon,
  Video as VideoIcon,
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
  positioning?: unknown;
  customer_journey?: unknown;
  offer?: unknown;
  funnel?: unknown;
  conversion?: unknown;
  retention?: unknown;
  growth_loops?: unknown;
  execution_roadmap?: unknown;
  budget_monthly_usd?: number | null;
  primary_goal?: string | null;
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
  period: { ar: "الفترة", en: "Period" },
  language: { ar: "اللغة", en: "Language" },
  status: { ar: "الحالة", en: "Status" },
  reasoning: { ar: "التحليل والسبب", en: "Reasoning" },
  micro_market: { ar: "السوق الدقيق", en: "Micro market" },
  market_size: { ar: "حجم السوق", en: "Market size" },
  tam_usd: { ar: "السوق الإجمالي (دولار)", en: "TAM (USD)" },
  sam_usd: { ar: "السوق المتاح (دولار)", en: "SAM (USD)" },
  som_usd: { ar: "الحصة القابلة للاستحواذ (دولار)", en: "SOM (USD)" },
  monthly_traffic_est: { ar: "حركة المرور الشهرية التقديرية", en: "Monthly traffic est" },
  underserved_segments: { ar: "الشرائح غير المخدومة", en: "Underserved segments" },
  weakness_to_exploit: { ar: "نقطة الضعف المستهدفة", en: "Weakness to exploit" },
  pricing: { ar: "التسعير", en: "Pricing" },
  positioning: { ar: "التموضع", en: "Positioning" },
  url: { ar: "الرابط", en: "URL" },
  trend: { ar: "الاتجاه", en: "Trend" },
  impact: { ar: "التأثير", en: "Impact" },
  action: { ar: "الإجراء", en: "Action" },
  job_to_be_done: { ar: "المهمة المطلوبة", en: "Job to be done" },
  current_alternative: { ar: "البديل الحالي", en: "Current alternative" },
  purchase_trigger: { ar: "محفز الشراء", en: "Purchase trigger" },
  buying_behavior: { ar: "سلوك الشراء", en: "Buying behavior" },
  channels_actual: { ar: "القنوات الفعلية", en: "Actual channels" },
  willingness_to_pay_usd_range: { ar: "الاستعداد للدفع (دولار)", en: "Willingness to pay (USD)" },
  frequency: { ar: "التكرار", en: "Frequency" },
  first_30_days_program: { ar: "برنامج أول 30 يوم", en: "First 30 days program" },
  repeat_purchase_triggers: { ar: "محفزات الشراء المتكرر", en: "Repeat purchase triggers" },
  mechanism: { ar: "الآلية", en: "Mechanism" },
  upsell_ladder: { ar: "سلّم البيع الأعلى", en: "Upsell ladder" },
  churn_prevention: { ar: "منع الانقطاع", en: "Churn prevention" },
  loyalty_mechanism: { ar: "آلية الولاء", en: "Loyalty mechanism" },
  reactivation_campaign: { ar: "حملة إعادة التنشيط", en: "Reactivation campaign" },
  value_proposition: { ar: "القيمة المقدمة", en: "Value proposition" },
  positioning_statement: { ar: "بيان التموضع", en: "Positioning statement" },
  differentiation_pillars: { ar: "ركائز التميز", en: "Differentiation pillars" },
  price_strategy: { ar: "استراتيجية السعر", en: "Price strategy" },
  brand_archetype: { ar: "النموذج الأصلي للعلامة", en: "Brand archetype" },
  tagline_options: { ar: "خيارات الشعار", en: "Tagline options" },
  pillar: { ar: "الركيزة", en: "Pillar" },
  proof: { ar: "الدليل", en: "Proof" },
  tagline: { ar: "الشعار", en: "Tagline" },
  stages: { ar: "المراحل", en: "Stages" },
  stage: { ar: "المرحلة", en: "Stage" },
  emotions: { ar: "المشاعر", en: "Emotions" },
  thoughts: { ar: "الأفكار", en: "Thoughts" },
  touchpoints: { ar: "نقاط التواصل", en: "Touchpoints" },
  decision_triggers: { ar: "محفزات القرار", en: "Decision triggers" },
  friction_points: { ar: "نقاط الاحتكاك", en: "Friction points" },
  ideal_content_for_this_stage: { ar: "المحتوى المثالي لهذه المرحلة", en: "Ideal content for this stage" },
  critical_moments: { ar: "اللحظات الحاسمة", en: "Critical moments" },
  core_offer: { ar: "العرض الأساسي", en: "Core offer" },
  includes: { ar: "يشمل", en: "Includes" },
  price_usd: { ar: "السعر (دولار)", en: "Price (USD)" },
  anchor_price_usd: { ar: "السعر المرجعي (دولار)", en: "Anchor price (USD)" },
  urgency_mechanism: { ar: "آلية الإلحاح", en: "Urgency mechanism" },
  risk_reversal: { ar: "عكس المخاطرة", en: "Risk reversal" },
  bonuses: { ar: "المكافآت", en: "Bonuses" },
  perceived_value_usd: { ar: "القيمة المدركة (دولار)", en: "Perceived value (USD)" },
  real_cost_usd: { ar: "التكلفة الفعلية (دولار)", en: "Real cost (USD)" },
  irresistible_reason: { ar: "السبب الذي لا يقاوم", en: "Irresistible reason" },
  offer_deliverability: { ar: "قابلية التنفيذ", en: "Deliverability" },
  bonus: { ar: "المكافأة", en: "Bonus" },
  acquisition: { ar: "الاستحواذ", en: "Acquisition" },
  activation: { ar: "التفعيل", en: "Activation" },
  retention: { ar: "الاحتفاظ", en: "Retention" },
  referral: { ar: "الإحالة", en: "Referral" },
  awareness: { ar: "الوعي", en: "Awareness" },
  conversion_rate: { ar: "معدل التحويل", en: "Conversion rate" },
  key_metric: { ar: "المؤشر الرئيسي", en: "Key metric" },
  leaks: { ar: "التسربات", en: "Leaks" },
  fixes: { ar: "الحلول", en: "Fixes" },
  landing_page_logic: { ar: "منطق صفحة الهبوط", en: "Landing page logic" },
  hook_above_fold: { ar: "الجملة الجاذبة أعلى الصفحة", en: "Hook above fold" },
  cta_copy: { ar: "نص دعوة العمل", en: "CTA copy" },
  proof_elements: { ar: "عناصر الإثبات", en: "Proof elements" },
  whatsapp_funnel: { ar: "قمع واتساب", en: "WhatsApp funnel" },
  welcome_message: { ar: "رسالة ترحيب", en: "Welcome message" },
  qualifying_questions: { ar: "أسئلة التأهيل", en: "Qualifying questions" },
  objection_handlers: { ar: "معالجات الاعتراضات", en: "Objection handlers" },
  closing_script: { ar: "سكريبت الإغلاق", en: "Closing script" },
  abandoned_cart_flow: { ar: "تدفق السلة المتروكة", en: "Abandoned cart flow" },
  follow_up_sequence: { ar: "سلسلة المتابعة", en: "Follow-up sequence" },
  response: { ar: "الرد", en: "Response" },
  objection: { ar: "الاعتراض", en: "Objection" },
  loop_name: { ar: "اسم الحلقة", en: "Loop name" },
  loop_steps: { ar: "خطوات الحلقة", en: "Loop steps" },
  input_required: { ar: "المدخل المطلوب", en: "Input required" },
  output_amplification: { ar: "تضخيم المخرج", en: "Output amplification" },
  measurement: { ar: "القياس", en: "Measurement" },
  expected_compounding_curve: { ar: "منحنى النمو المتوقع", en: "Expected compounding curve" },
  priority_action: { ar: "الإجراء الأولوي", en: "Priority action" },
  owner_role: { ar: "الدور المسؤول", en: "Owner role" },
  expected_outcome: { ar: "النتيجة المتوقعة", en: "Expected outcome" },
  blocker_to_watch: { ar: "العقبة المحتملة", en: "Blocker to watch" },
  platform_recommendations: { ar: "توصيات المنصات", en: "Platform recommendations" },
  recommended_monthly_budget_usd: { ar: "الميزانية الشهرية الموصى بها (دولار)", en: "Recommended monthly budget (USD)" },
  alternative_budgets: { ar: "خيارات ميزانية بديلة", en: "Alternative budgets" },
  funnel_projection: { ar: "توقعات القمع", en: "Funnel projection" },
  monthly_projections: { ar: "التوقعات الشهرية", en: "Monthly projections" },
  budget_breakdown: { ar: "تفصيل الميزانية", en: "Budget breakdown" },
  expected_roi: { ar: "العائد المتوقع", en: "Expected ROI" },
  what_to_skip_for_this_budget: { ar: "ما يجب تجاهله لهذه الميزانية", en: "What to skip for this budget" },
  cost_per_lead_usd: { ar: "تكلفة الليد (دولار)", en: "Cost per lead (USD)" },
  cost_per_customer_usd: { ar: "تكلفة العميل (دولار)", en: "Cost per customer (USD)" },
  break_even_customers: { ar: "عدد العملاء لنقطة التعادل", en: "Break-even customers" },
  month: { ar: "الشهر", en: "Month" },
  revenue_usd: { ar: "الإيرادات (دولار)", en: "Revenue (USD)" },
  budget_allocation_usd: { ar: "تخصيص الميزانية (دولار)", en: "Budget allocation (USD)" },
  expected_cpl_usd: { ar: "التكلفة المتوقعة للّيد (دولار)", en: "Expected CPL (USD)" },
  expected_leads_month: { ar: "الليدات المتوقعة شهرياً", en: "Expected leads/month" },
  tactic: { ar: "التكتيك", en: "Tactic" },
  organic_vs_paid: { ar: "عضوي مقابل مدفوع", en: "Organic vs paid" },
  total_budget_check: { ar: "التحقق من إجمالي الميزانية", en: "Total budget check" },
  channels_to_avoid: { ar: "قنوات يجب تجنبها", en: "Channels to avoid" },
  expected_monthly_revenue_usd: { ar: "الإيرادات الشهرية المتوقعة (دولار)", en: "Expected monthly revenue (USD)" },
  expected_monthly_customers: { ar: "العملاء الشهريون المتوقعون", en: "Expected monthly customers" },
  math_check: { ar: "التحقق الحسابي", en: "Math check" },
  common_leaks: { ar: "التسربات الشائعة", en: "Common leaks" },
  day: { ar: "اليوم", en: "Day" },
  date: { ar: "التاريخ", en: "Date" },
  channel: { ar: "القناة", en: "Channel" },
  format: { ar: "الصيغة", en: "Format" },
  topic: { ar: "الموضوع", en: "Topic" },
  headline: { ar: "العنوان", en: "Headline" },
  cta: { ar: "دعوة للعمل", en: "CTA" },
  goal: { ar: "الهدف", en: "Goal" },
  notes: { ar: "ملاحظات", en: "Notes" },
};

const LANGUAGE_LABELS: Record<string, { ar: string; en: string }> = {
  ar: { ar: "العربية", en: "Arabic" },
  en: { ar: "الإنجليزية", en: "English" },
  both: { ar: "العربية + English", en: "Arabic + English" },
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  approved: { ar: "معتمدة", en: "Approved" },
  archived: { ar: "مؤرشفة", en: "Archived" },
};

function labelFor(key: string, lang: "ar" | "en"): string {
  const entry = FIELD_LABELS[key];
  if (entry) return entry[lang];
  return key.replace(/_/g, " ");
}

function JsonBlock({ data, lang = "en" }: { data: unknown; lang?: "ar" | "en" }) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  if (data === null || data === undefined) return null;
  if (typeof data === "string") {
    return (
      <p
        className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant"
        dir={dir}
      >
        {data}
      </p>
    );
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    if (data.every((x) => typeof x === "string" || typeof x === "number")) {
      return (
        <ul
          className="list-disc space-y-2 ps-5 text-sm leading-relaxed text-on-surface-variant"
          dir={dir}
        >
          {data.map((item, i) => (
            <li key={i} dir={dir}>
              {String(item)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-3" dir={dir}>
        {data.map((item, i) => (
          <div key={i} className="rounded-xl bg-surface-container-low p-4" dir={dir}>
            <JsonBlock data={item} lang={lang} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <dl className="space-y-3" dir={dir}>
        {entries.map(([k, v]) => (
          <div key={k} className="text-sm" dir={dir}>
            <dt
              className="mb-1 font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant"
              dir={dir}
            >
              {labelFor(k, lang)}
            </dt>
            <dd className="ps-2" dir={dir}>
              <JsonBlock data={v} lang={lang} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <span className="text-sm text-on-surface-variant" dir={dir}>
      {String(data)}
    </span>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
  lang,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  lang?: "ar" | "en";
}) {
  const dir = lang === "ar" ? "rtl" : undefined;
  return (
    <Card padding="lg" className="transition-shadow hover:shadow-md">
      <div
        className="mb-5 flex items-center gap-3 border-b border-outline/10 pb-4"
        dir={dir}
      >
        <div className="brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-soft">
          <Icon className="h-[18px] w-[18px] text-white" />
        </div>
        <h3
          className="flex-1 font-headline text-base font-bold tracking-tight text-on-surface"
          dir={dir}
          style={{ textAlign: lang === "ar" ? "right" : undefined }}
        >
          {title}
        </h3>
      </div>
      <div dir={dir}>{children}</div>
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
  const lang: "ar" | "en" = locale === "ar" ? "ar" : "en";
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
    const note = window.prompt(
      lang === "ar"
        ? "أضف ملاحظة اختيارية للذكاء الاصطناعي (مثل: استهدف الشركات لا الأفراد). اتركه فارغاً للتوليد بدون تغييرات."
        : "Optional note for the AI (e.g., 'target companies not individuals'). Leave empty to regenerate as-is.",
      ""
    );
    if (note === null) return; // user cancelled
    try {
      setRegenSection(section);
      setError(null);
      const updated = await api.post<MarketingPlan>(
        `/api/v1/plans/${plan.id}/regenerate-section`,
        { section, language: plan.language || "ar", note: note.trim() }
      );
      setPlan(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenSection(null);
    }
  }

  async function regenerateFullPlan() {
    if (!plan) return;
    const note = window.prompt(
      lang === "ar"
        ? "أضف ملاحظة للذكاء الاصطناعي لإعادة توليد الخطة كاملة (مثل: استهدف الشركات لا الأفراد).\n\nسيتم استخدام: معلومات الشركة + الخطة الحالية + ملاحظتك."
        : "Feedback note to regenerate the entire plan (e.g., 'target companies not individuals').\n\nContext used: business profile + current plan + your note.",
      ""
    );
    if (note === null) return;
    try {
      setRegenSection("__full__");
      setError(null);
      const updated = await api.post<MarketingPlan>(
        `/api/v1/plans/${plan.id}/regenerate`,
        { language: plan.language || "ar", note: note.trim() }
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
    { value: "positioning", label: t("sections.positioning") },
    { value: "journey", label: t("sections.journey") },
    { value: "offer", label: t("sections.offer") },
    { value: "funnel", label: t("sections.funnel") },
    { value: "channels", label: t("sections.channels") },
    { value: "conversion", label: t("sections.conversion") },
    { value: "retention", label: t("sections.retention") },
    { value: "growthLoops", label: t("sections.growthLoops") },
    { value: "calendar", label: t("sections.calendar") },
    { value: "kpis", label: t("sections.kpis") },
    { value: "roadmap", label: t("sections.roadmap") },
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
                <div className="brand-gradient h-1 w-24 rounded-full" />
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
                            pdfLang === "en" ? "brand-gradient text-white" : "text-on-surface-variant"
                          )}
                        >
                          EN
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfLang("ar")}
                          className={clsx(
                            "rounded-full px-3 py-1 font-bold",
                            pdfLang === "ar" ? "brand-gradient text-white" : "text-on-surface-variant"
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
                      <Button
                        variant="secondary"
                        onClick={regenerateFullPlan}
                        disabled={regenSection === "__full__"}
                        leadingIcon={
                          regenSection === "__full__" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )
                        }
                      >
                        {lang === "ar" ? "إعادة توليد الخطة" : "Regenerate plan"}
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
                  {typeof plan.period_days === "number" && !Number.isNaN(plan.period_days) && (
                    <InsightChip icon={CalendarIcon}>
                      {plan.period_days} {t("days")}
                    </InsightChip>
                  )}
                  <span className="text-sm font-medium text-on-surface-variant">
                    {new Date(plan.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Approval-gated content actions */}
                {plan.status === "approved" && (
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 shadow-soft">
                    <div className="mb-3 flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="font-headline text-xs font-bold uppercase tracking-widest text-emerald-700">
                        {lang === "ar" ? "الخطة معتمدة — أنشئ المحتوى الآن" : "Plan approved — create content now"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Link
                        href={`/content-gen?plan_id=${plan.id}`}
                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-on-surface shadow-soft transition-all hover:-translate-y-0.5"
                      >
                        <FileText className="h-4 w-4 text-primary" />
                        {lang === "ar" ? "إنشاء مقالات" : "Generate articles"}
                      </Link>
                      <Link
                        href={`/creative/generate?plan_id=${plan.id}`}
                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-on-surface shadow-soft transition-all hover:-translate-y-0.5"
                      >
                        <ImageIcon className="h-4 w-4 text-primary" />
                        {lang === "ar" ? "إنشاء صور" : "Generate images"}
                      </Link>
                      <Link
                        href={`/video/generate?plan_id=${plan.id}`}
                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-on-surface shadow-soft transition-all hover:-translate-y-0.5"
                      >
                        <VideoIcon className="h-4 w-4 text-primary" />
                        {lang === "ar" ? "إنشاء فيديوهات" : "Generate videos"}
                      </Link>
                    </div>
                  </div>
                )}
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
                          ? "brand-gradient text-white shadow-soft ring-2 ring-primary/30 scale-[1.02]"
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
                  <SectionCard icon={Target} title={t("fields.goals")} lang={lang}>
                    <JsonBlock data={plan.goals} lang={lang} />
                  </SectionCard>
                  <SectionCard icon={FileText} title={t("sections.overview")} lang={lang}>
                    <JsonBlock lang={lang}
                      data={{
                        period:
                          typeof plan.period_days === "number" && !Number.isNaN(plan.period_days)
                            ? `${plan.period_days} ${t("days")}`
                            : "—",
                        language: plan.language
                          ? LANGUAGE_LABELS[plan.language]?.[lang] ?? plan.language
                          : "—",
                        status: STATUS_LABELS[plan.status]?.[lang] ?? plan.status,
                      }}
                    />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="market" className="space-y-4">
                  {/* SWOT — colorful grid at the top */}
                  {plan.swot !== undefined && (() => {
                    const swot = plan.swot as Record<string, unknown> | null | undefined;
                    const keys: Array<{ key: string; ar: string; en: string; color: string; bg: string; border: string }> = [
                      { key: "strengths",    ar: "نقاط القوة",  en: "Strengths",     color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
                      { key: "weaknesses",   ar: "نقاط الضعف", en: "Weaknesses",    color: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200"    },
                      { key: "opportunities",ar: "الفرص",       en: "Opportunities", color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200"    },
                      { key: "threats",      ar: "التهديدات",   en: "Threats",       color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200"   },
                    ];
                    return (
                      <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft">
                        <h3 className="mb-4 font-headline text-base font-bold text-on-surface">
                          {lang === "ar" ? "تحليل SWOT" : "SWOT Analysis"}
                        </h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {keys.map(({ key, ar, en, color, bg, border }) => {
                            const val = swot?.[key];
                            if (!val) return null;
                            const items: string[] = Array.isArray(val)
                              ? (val as string[])
                              : typeof val === "string"
                              ? val.split(/\n|،|,/).map((s) => s.trim()).filter(Boolean)
                              : [];
                            return (
                              <div key={key} className={clsx("rounded-xl border p-4", bg, border)}>
                                <p className={clsx("mb-2 font-headline text-xs font-bold uppercase tracking-widest", color)}>
                                  {lang === "ar" ? ar : en}
                                </p>
                                <ul className="space-y-1">
                                  {items.length > 0
                                    ? items.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                                          <span className={clsx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", color.replace("text-", "bg-"))} />
                                          {item}
                                        </li>
                                      ))
                                    : <p className="text-sm text-on-surface-variant">{String(val)}</p>}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <SectionCard icon={TrendingUp} title={t("fields.marketAnalysis")} lang={lang}>
                    <JsonBlock data={plan.market_analysis} lang={lang} />
                  </SectionCard>
                  {plan.competitors !== undefined && (
                    <SectionCard icon={Users} title={t("fields.competitors")} lang={lang}>
                      <JsonBlock data={plan.competitors} lang={lang} />
                    </SectionCard>
                  )}
                  {plan.trends !== undefined && (
                    <SectionCard icon={TrendingUp} title={t("fields.trends")} lang={lang}>
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
                    <SectionCard icon={Users} title={t("fields.personas")} lang={lang}>
                      <JsonBlock data={plan.personas} lang={lang} />
                    </SectionCard>
                  )}
                </Tabs.Content>

                <Tabs.Content value="channels" className="space-y-4">
                  <div className="flex justify-end">
                    <RegenBtn section="channels" />
                  </div>
                  <SectionCard icon={Radio} title={t("fields.channels")} lang={lang}>
                    <JsonBlock data={plan.channels} lang={lang} />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="calendar" className="space-y-4">
                  <div className="flex justify-end">
                    <RegenBtn section="calendar" />
                  </div>
                  {calendar.length > 0 ? (
                    <Card padding="none" className="overflow-hidden">
                      <table
                        className="w-full text-sm"
                        dir={lang === "ar" ? "rtl" : "ltr"}
                      >
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
                    <SectionCard icon={CalendarIcon} title={t("fields.calendar")} lang={lang}>
                      <JsonBlock data={plan.calendar} lang={lang} />
                    </SectionCard>
                  )}
                </Tabs.Content>

                <Tabs.Content value="positioning" className="space-y-4">
                  <SectionCard icon={Target} title={t("sections.positioning")} lang={lang}>
                    <JsonBlock data={plan.positioning} lang={lang} />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="journey" className="space-y-4">
                  <SectionCard icon={Users} title={t("sections.journey")} lang={lang}>
                    <JsonBlock data={plan.customer_journey} lang={lang} />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="offer" className="space-y-4">
                  <SectionCard icon={FileText} title={t("sections.offer")} lang={lang}>
                    <JsonBlock data={plan.offer} lang={lang} />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="funnel" className="space-y-5">
                  <Card padding="lg" className="transition-shadow hover:shadow-md">
                    <div
                      className="mb-5 flex items-center gap-3 border-b border-outline/10 pb-4"
                      dir={lang === "ar" ? "rtl" : undefined}
                    >
                      <div className="brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-soft">
                        <TrendingUp className="h-[18px] w-[18px] text-white" />
                      </div>
                      <div
                        className="flex-1"
                        dir={lang === "ar" ? "rtl" : undefined}
                        style={{ textAlign: lang === "ar" ? "right" : undefined }}
                      >
                        <h3 className="font-headline text-base font-bold tracking-tight text-on-surface">
                          {lang === "ar" ? "قمع AARRR — رحلة نمو العميل" : "AARRR Growth Funnel"}
                        </h3>
                        <p className="mt-1 text-sm text-on-surface-variant" dir={lang === "ar" ? "rtl" : "ltr"}>
                          {lang === "ar"
                            ? "قمع من 5 مراحل (الاستحواذ ← التفعيل ← الاحتفاظ ← الإحالة ← الإيرادات) لتتبع نمو العميل من أول لقاء حتى التحول إلى سفير للعلامة."
                            : "5-stage funnel (Acquisition → Activation → Retention → Referral → Revenue) tracking customer growth from first touch to brand advocate."}
                        </p>
                      </div>
                    </div>
                    {Array.isArray(plan.funnel) && plan.funnel.length > 0 ? (
                      <div className="space-y-3">
                        {(plan.funnel as Record<string, unknown>[]).map((s, i) => {
                          const stageName =
                            (s.stage as string) ||
                            (s.name as string) ||
                            `${lang === "ar" ? "المرحلة" : "Stage"} ${i + 1}`;
                          return (
                            <div
                              key={i}
                              className="brand-gradient-border rounded-xl bg-surface-container-lowest p-5"
                            >
                              <div className="mb-3 flex items-center gap-3" dir={lang === "ar" ? "rtl" : "ltr"}>
                                <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-soft">
                                  {String.fromCharCode(0x41 + i)}
                                </div>
                                <h4 className="font-headline text-sm font-bold text-on-surface">
                                  {labelFor(stageName, lang)}
                                </h4>
                              </div>
                              <JsonBlock data={s} lang={lang} />
                            </div>
                          );
                        })}
                      </div>
                    ) : plan.funnel && typeof plan.funnel === "object" ? (
                      <div className="space-y-3">
                        {Object.entries(plan.funnel as Record<string, unknown>).map(([k, v], i) => (
                          <div
                            key={k}
                            className="brand-gradient-border rounded-xl bg-surface-container-lowest p-5"
                          >
                            <div className="mb-3 flex items-center gap-3" dir={lang === "ar" ? "rtl" : "ltr"}>
                              <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-soft">
                                {String.fromCharCode(0x41 + i)}
                              </div>
                              <h4 className="font-headline text-sm font-bold text-on-surface">
                                {labelFor(k, lang)}
                              </h4>
                            </div>
                            <JsonBlock data={v} lang={lang} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <JsonBlock data={plan.funnel} lang={lang} />
                    )}
                  </Card>
                </Tabs.Content>

                <Tabs.Content value="conversion" className="space-y-4">
                  <SectionCard icon={Radio} title={t("sections.conversion")} lang={lang}>
                    <JsonBlock data={plan.conversion} lang={lang} />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="retention" className="space-y-4">
                  <SectionCard icon={Users} title={t("sections.retention")} lang={lang}>
                    <JsonBlock data={plan.retention} lang={lang} />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="growthLoops" className="space-y-4">
                  <SectionCard icon={TrendingUp} title={t("sections.growthLoops")} lang={lang}>
                    <JsonBlock data={plan.growth_loops} lang={lang} />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="roadmap" className="space-y-4">
                  <SectionCard icon={CalendarIcon} title={t("sections.roadmap")} lang={lang}>
                    <JsonBlock data={plan.execution_roadmap} lang={lang} />
                  </SectionCard>
                </Tabs.Content>

                <Tabs.Content value="kpis" className="space-y-4">
                  <div className="flex justify-end">
                    <RegenBtn section="kpis" />
                  </div>
                  <SectionCard icon={TrendingUp} title={t("fields.kpis")} lang={lang}>
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
