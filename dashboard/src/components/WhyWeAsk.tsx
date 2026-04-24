"use client";

/**
 * WhyWeAsk — a small "why we ask this" explainer for onboarding forms.
 *
 * Business owners are skeptical when a SaaS asks for their business
 * description, target audience, or competitor list during onboarding.
 * Without explanation, it feels like data-collection for its own sake and
 * onboarding completion rates drop. This component gives the one-sentence
 * honest reason the AI needs each field.
 *
 * We put it INLINE with the field (not in a separate "learn more" modal)
 * because modals are skipped. Visible copy — next to the field — gets read.
 */

import { Info } from "lucide-react";

interface Props {
  reason: string;
  /** Optional override icon color. Default: primary tone. */
  tone?: "info" | "warning";
}

export default function WhyWeAsk({ reason, tone = "info" }: Props) {
  const toneClasses =
    tone === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-100"
      : "bg-primary/5 border-primary/15 text-on-surface";
  return (
    <div
      className={`mt-1.5 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] leading-snug ${toneClasses}`}
    >
      <Info className="mt-[1px] h-3 w-3 shrink-0 opacity-70" />
      <span>{reason}</span>
    </div>
  );
}


/**
 * Canonical "why we ask" copy per onboarding field.
 * Keep each string ≤ 120 chars — this is inline help text, not a paragraph.
 *
 * Rules we follow in the copy:
 * - Start with the concrete benefit to the user, not what we do with the data.
 * - Never use "data", "information", "insights" — those words are noise.
 * - If the field is optional, say so.
 */
export const WHY_WE_ASK = {
  // Business-profile step
  industry: {
    ar: "يساعدنا على اختيار أمثلة ومنافسين من مجالك، وتحديد الميزانية الواقعية للإعلانات.",
    en: "Lets us pick examples and competitors from your industry and set realistic ad benchmarks.",
  },
  country: {
    ar: "أسعار الإعلانات وسلوك العملاء تختلف بين الأسواق — نحتاج بلدك لتقدير التكلفة بدقة.",
    en: "Ad costs and buyer behavior vary by market — we need your country to estimate costs accurately.",
  },
  description: {
    ar: "كل ما يعرفه الذكاء الاصطناعي عن عملك يأتي من هنا. اكتب كأنك تشرح لصديق.",
    en: "Everything the AI knows about your business starts here. Write it like you're explaining to a friend.",
  },
  target_audience: {
    ar: "بدون جمهور محدد، يصير المحتوى عاماً. كلما زاد التخصيص، زادت جودة الخطة.",
    en: "Without a specific audience, content becomes generic. The more specific, the better the plan.",
  },
  products: {
    ar: "حتى يتمكن الذكاء الاصطناعي من اقتراح إعلانات لمنتجاتك الفعلية، وليس افتراضات.",
    en: "So the AI can pitch your actual products and services — not guess at them.",
  },
  competitors: {
    ar: "نحلل مواقعهم لنرى ما يُروّجون له وأين توجد فجوات يمكنك استغلالها (اختياري).",
    en: "We scan their sites to see what they push and where gaps exist you can exploit (optional).",
  },
  website: {
    ar: "إن توفر، سنقرأ موقعك مرة واحدة لملء الحقول تلقائياً — وفر عليك الكتابة (اختياري).",
    en: "If you have one, we'll read it once and auto-fill fields for you — saves typing (optional).",
  },

  // Brand-voice step
  tone: {
    ar: "نبرة صوتك توجّه كتابة كل منشور. المحتوى الاحترافي يختلف عن الودود أو الجريء.",
    en: "Your voice shapes every generated post. Professional reads very differently from playful.",
  },
  colors: {
    ar: "نحاول توجيه الصور نحو ألوان علامتك — لكن Flux لا يضمن لون دقيق ١٠٠٪.",
    en: "We steer images toward your palette — but Flux can't guarantee exact color match.",
  },
  logo: {
    ar: "شعارك يظهر كطبقة فوق الصور قبل النشر. اختياري لكنه يرفع احترافية المنشور.",
    en: "Your logo overlays each generated image pre-publish. Optional but bumps post polish.",
  },

  // Channels step
  channels: {
    ar: "اختر فقط القنوات التي تنوي النشر فيها. سننشئ محتوى لكل واحدة فقط (لا هدر).",
    en: "Pick only the channels you'll actually publish to. We'll generate content just for those — no waste.",
  },

  // Plan generation
  budget_monthly_usd: {
    ar: "ميزانيتك تحدد القنوات المناسبة. ميزانية صغيرة؟ نذهب للعضوي والواتساب بدل إعلانات مكلفة.",
    en: "Your budget picks the right channels. Small budget? We focus on organic + WhatsApp, not expensive ads.",
  },
  primary_goal: {
    ar: "هدف واحد يوجه كل شيء — زيادة المبيعات أو بناء الوعي أو توليد عملاء محتملين.",
    en: "One goal guides everything — more sales vs. awareness vs. lead capture produce very different plans.",
  },
  plan_mode: {
    ar: "«سريع» للاستكشاف، «متوازن» للاستخدام اليومي، «متميز» قبل الإنفاق الحقيقي على الإعلانات.",
    en: "'Fast' to explore; 'Balanced' for daily use; 'Premium' before committing real ad spend.",
  },
  period_days: {
    ar: "طول الخطة. 30 يوم للاختبار السريع، 60-90 لأنشطة مستقرة.",
    en: "Plan length. 30 days for quick iteration, 60-90 for established businesses.",
  },
};

/**
 * Convenience: render the WhyWeAsk for a field by key.
 *
 *   <WhyWeAskField fieldKey="industry" locale="ar" />
 */
export function WhyWeAskField({
  fieldKey,
  locale,
}: {
  fieldKey: keyof typeof WHY_WE_ASK;
  locale: "ar" | "en" | string;
}) {
  const entry = WHY_WE_ASK[fieldKey];
  if (!entry) return null;
  const text = locale === "ar" ? entry.ar : entry.en;
  return <WhyWeAsk reason={text} />;
}
