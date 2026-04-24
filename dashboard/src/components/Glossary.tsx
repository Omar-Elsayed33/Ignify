"use client";

/**
 * Glossary — hover/tap tooltip for marketing + business jargon.
 *
 * The marketing plan UI is studded with acronyms (TAM, SAM, SOM, CAC, LTV,
 * AARRR, CTR, ROAS, etc.) and consulting nouns ("growth loop", "upsell
 * ladder", "positioning statement"). A SMB owner who didn't go to business
 * school sees this and feels stupid. Shipping glossary tooltips converts
 * that "I don't understand this" feeling into a 2-second lookup.
 *
 * Design:
 * - Both EN and AR definitions included; locale picks one.
 * - Unknown terms render children without a tooltip (no crash).
 * - Uses a native `<abbr title>` for accessibility (screen readers read it)
 *   layered under a visible custom tooltip on hover/focus.
 */

import { ReactNode, useId } from "react";
import { useLocale } from "next-intl";
import { HelpCircle } from "lucide-react";

/**
 * Glossary data. Keep definitions SHORT (one sentence max) — this is a
 * tooltip, not a Wikipedia page. If a term needs more explanation, link
 * out to /help/[topic] via the docsSlug field (rendered as a "learn more"
 * affordance in the future).
 */
const GLOSSARY: Record<
  string,
  { label_en: string; def_en: string; label_ar?: string; def_ar: string }
> = {
  TAM: {
    label_en: "TAM",
    def_en: "Total Addressable Market — the total revenue opportunity if you sold to every possible buyer.",
    label_ar: "السوق الكلي المتاح",
    def_ar: "إجمالي حجم السوق لو بعت لكل عميل ممكن.",
  },
  SAM: {
    label_en: "SAM",
    def_en: "Serviceable Addressable Market — the portion of TAM you can realistically reach with your channels.",
    label_ar: "السوق الممكن خدمته",
    def_ar: "الجزء من السوق الكلي الذي تستطيع الوصول إليه بقنواتك الحالية.",
  },
  SOM: {
    label_en: "SOM",
    def_en: "Serviceable Obtainable Market — the share of SAM you can capture in the short term given your budget.",
    label_ar: "السوق الذي يمكن الفوز به",
    def_ar: "الحصة الواقعية من السوق خلال ميزانيتك الحالية.",
  },
  CAC: {
    label_en: "CAC",
    def_en: "Customer Acquisition Cost — the average cost to get one paying customer.",
    label_ar: "تكلفة اكتساب العميل",
    def_ar: "متوسط التكلفة للحصول على عميل دافع واحد.",
  },
  LTV: {
    label_en: "LTV",
    def_en: "Lifetime Value — the total revenue a single customer generates over time.",
    label_ar: "قيمة العميل مدى الحياة",
    def_ar: "إجمالي ما يدفعه العميل طوال فترة تعامله معك.",
  },
  "LTV:CAC": {
    label_en: "LTV:CAC",
    def_en: "Ratio of lifetime value to acquisition cost. Healthy SaaS: ≥ 3:1.",
    label_ar: "نسبة LTV إلى CAC",
    def_ar: "مقياس صحة نموذج العمل. المستهدف ٣:١ فأعلى.",
  },
  CPL: {
    label_en: "CPL",
    def_en: "Cost Per Lead — how much each lead costs on average through a given channel.",
    label_ar: "تكلفة الليد",
    def_ar: "متوسط تكلفة الحصول على عميل محتمل من قناة معينة.",
  },
  CPM: {
    label_en: "CPM",
    def_en: "Cost Per Mille — cost to show your ad to 1,000 people.",
    label_ar: "تكلفة الألف مشاهدة",
    def_ar: "كم تدفع لعرض إعلانك لألف شخص.",
  },
  CTR: {
    label_en: "CTR",
    def_en: "Click-Through Rate — percentage of viewers who clicked your ad/post.",
    label_ar: "معدل النقر",
    def_ar: "نسبة من شاهدوا إعلانك ونقروا عليه.",
  },
  ROAS: {
    label_en: "ROAS",
    def_en: "Return On Ad Spend — revenue generated for every dollar spent on ads.",
    label_ar: "عائد الإنفاق الإعلاني",
    def_ar: "كم يولد كل دولار تنفقه على الإعلان من إيرادات.",
  },
  AARRR: {
    label_en: "AARRR",
    def_en: "Awareness → Acquisition → Activation → Retention → Referral. A 5-stage funnel framework.",
    label_ar: "AARRR",
    def_ar: "إطار القمع المكون من ٥ مراحل: الوعي ← الاكتساب ← التفعيل ← الاحتفاظ ← الإحالة.",
  },
  SWOT: {
    label_en: "SWOT",
    def_en: "Strengths, Weaknesses, Opportunities, Threats — a quick strategic snapshot.",
    label_ar: "SWOT",
    def_ar: "نقاط القوة والضعف والفرص والتهديدات — لقطة استراتيجية سريعة.",
  },
  "growth loop": {
    label_en: "growth loop",
    def_en: "A self-reinforcing cycle where customers bring more customers (e.g. referrals, content, reviews).",
    label_ar: "دورة النمو",
    def_ar: "دورة ذاتية التغذية: كل عميل يجلب عميلاً جديداً (إحالات، محتوى، تقييمات).",
  },
  "upsell ladder": {
    label_en: "upsell ladder",
    def_en: "The sequence of higher-priced offers you present after the initial purchase.",
    label_ar: "سلم البيع الإضافي",
    def_ar: "تسلسل العروض الأغلى التي تقدمها للعميل بعد أول عملية شراء.",
  },
  "positioning statement": {
    label_en: "positioning statement",
    def_en: "One sentence describing who you're for, what you offer, and why you're different.",
    label_ar: "بيان التموضع",
    def_ar: "جملة واحدة تجيب: لمن؟ تقدم ماذا؟ ولماذا أنت مختلف؟",
  },
  NPS: {
    label_en: "NPS",
    def_en: "Net Promoter Score — a -100 to +100 satisfaction metric based on 'would you recommend us'.",
    label_ar: "مؤشر صافي المروجين",
    def_ar: "مقياس من -١٠٠ إلى +١٠٠ يقيس احتمالية ترشيحك للخدمة.",
  },
  MRR: {
    label_en: "MRR",
    def_en: "Monthly Recurring Revenue — income you can count on each month from subscriptions.",
    label_ar: "الإيرادات الشهرية المتكررة",
    def_ar: "الدخل الشهري الثابت من اشتراكات العملاء.",
  },
};

interface GlossaryProps {
  /** The term to look up. Case-insensitive. */
  term: string;
  /** Optional custom child — defaults to the term itself with dotted underline. */
  children?: ReactNode;
  /** Hide the little (?) icon — use when the term itself is self-styled. */
  hideIcon?: boolean;
}

/**
 * Wrap any jargon term to give it a tooltip.
 *
 * <Glossary term="CAC" />  →  "CAC (?)" with hover tooltip
 * <Glossary term="growth loop">دورة النمو</Glossary>  → custom child text
 */
export default function Glossary({ term, children, hideIcon }: GlossaryProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const id = useId();

  // Lookup is case-insensitive, but the keys in GLOSSARY are stored in the
  // casing the UI typically shows (uppercase acronyms, lowercase phrases).
  const lookupKey =
    Object.keys(GLOSSARY).find((k) => k.toLowerCase() === term.toLowerCase()) || null;
  const entry = lookupKey ? GLOSSARY[lookupKey] : null;

  if (!entry) {
    // Unknown term — render child/term plain, no tooltip, no icon. Safer
    // than showing a tooltip that says "no definition available".
    return <>{children ?? term}</>;
  }

  const definition = isAr ? entry.def_ar : entry.def_en;
  const label = isAr && entry.label_ar ? entry.label_ar : entry.label_en;

  return (
    <span className="group relative inline-flex items-center gap-0.5">
      <abbr
        title={definition}
        aria-describedby={id}
        className="cursor-help decoration-dotted decoration-on-surface-variant underline-offset-2 [text-decoration-line:underline]"
      >
        {children ?? label}
      </abbr>
      {!hideIcon && (
        <HelpCircle
          size={11}
          className="inline text-on-surface-variant opacity-70 group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-inverse-surface px-3 py-2 text-xs leading-snug text-inverse-on-surface shadow-lg group-hover:block group-focus-within:block"
      >
        <span className="mb-1 block font-semibold">{label}</span>
        <span className="block opacity-90">{definition}</span>
      </span>
    </span>
  );
}

/**
 * Programmatic lookup for places that can't render JSX (e.g., table headers
 * rendered via config objects).
 */
export function glossaryDefinition(term: string, locale: "ar" | "en"): string | null {
  const key = Object.keys(GLOSSARY).find((k) => k.toLowerCase() === term.toLowerCase());
  if (!key) return null;
  const entry = GLOSSARY[key];
  return locale === "ar" ? entry.def_ar : entry.def_en;
}
