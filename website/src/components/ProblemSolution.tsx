"use client";

/**
 * Landing-page problem/solution block.
 *
 * Why this design
 * ---------------
 * SMB owners in MENA who land on this page are NOT AI enthusiasts — they're
 * people who've been burned by agencies (expensive, slow, opaque) or
 * freelancers (inconsistent, no follow-through). Leading with an AI pitch
 * misses them. Leading with their PAIN gets attention.
 *
 * Structure:
 *   Problem row (4 concrete frustrations, stated in their own language)
 *        ↓
 *   Solution flow (7-step visual: site analysis → report)
 *        ↓
 *   Implicit CTA tie-in in the parent page
 */

import { useLocale } from "next-intl";
import {
  DollarSign,
  Clock,
  HelpCircle,
  TrendingDown,
  Globe,
  FileText,
  PenSquare,
  Image as ImageIcon,
  CheckCircle2,
  Send,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";

const PROBLEMS = [
  {
    icon: DollarSign,
    ar: { title: "الوكالات مكلفة", body: "٥٠٠٠–١٥,٠٠٠ ريال شهرياً لا تستطيع تحمّلها مع بداية مشروعك." },
    en: { title: "Agencies cost a fortune", body: "$1k–$4k/mo is not something a new business can afford on day one." },
  },
  {
    icon: Clock,
    ar: { title: "التسويق بطيء", body: "تنتظر أسبوعين لخطة ثم أسبوعاً آخر للمحتوى. السوق لا ينتظر." },
    en: { title: "Marketing is painfully slow", body: "Two weeks for a plan, another week for content. Your market won't wait." },
  },
  {
    icon: HelpCircle,
    ar: { title: "لا تعرف ماذا تفعل غداً", body: "عندك خطة ضخمة لكن لا إجراء واضح يجيب «ماذا أفعل اليوم؟»" },
    en: { title: "You don't know what to do tomorrow", body: "You have a 50-page plan but no answer to 'what do I actually do today?'" },
  },
  {
    icon: TrendingDown,
    ar: { title: "النتائج مبهمة", body: "تنفق وتنشر لكن لا تعرف ما الذي يعمل فعلاً وما الذي يهدر أموالك." },
    en: { title: "Results are a black box", body: "You spend and post — but can't tell what's actually working vs. wasting money." },
  },
];

const SOLUTION_STEPS = [
  {
    icon: Globe,
    ar: "تحليل موقعك",
    en: "Site analysis",
  },
  {
    icon: FileText,
    ar: "خطة تسويقية",
    en: "Marketing plan",
  },
  {
    icon: PenSquare,
    ar: "محتوى",
    en: "Content",
  },
  {
    icon: ImageIcon,
    ar: "صور وتصاميم",
    en: "Creatives",
  },
  {
    icon: CheckCircle2,
    ar: "موافقتك",
    en: "Your approval",
  },
  {
    icon: Send,
    ar: "النشر",
    en: "Publishing",
  },
  {
    icon: BarChart3,
    ar: "تقارير",
    en: "Reports",
  },
];

export default function ProblemSolution() {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <>
      {/* ── PROBLEM ─────────────────────────────────────────────────── */}
      <section
        id="problem"
        className="border-y border-border/50 bg-surface-container-lowest py-20"
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <h2 className="text-3xl font-bold text-on-surface sm:text-4xl">
              {isAr
                ? "التسويق لصاحب العمل الصغير مكسور."
                : "Marketing for small business owners is broken."}
            </h2>
            <p className="mt-4 text-on-surface-variant">
              {isAr
                ? "لست وحدك. هذه الأربع مشاكل نسمعها كل يوم من أصحاب أعمال مثلك."
                : "You're not alone. These four pains are what we hear every day from owners like you."}
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((p, i) => {
              const Icon = p.icon;
              const copy = isAr ? p.ar : p.en;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  className="flex flex-col rounded-2xl border border-border bg-surface p-5"
                >
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-error-container text-on-error-container">
                    <Icon size={18} />
                  </div>
                  <h3 className="mb-1 font-bold text-on-surface">{copy.title}</h3>
                  <p className="text-sm leading-relaxed text-on-surface-variant">
                    {copy.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SOLUTION FLOW ───────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="bg-background py-20"
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <h2 className="text-3xl font-bold text-on-surface sm:text-4xl">
              {isAr
                ? "كيف يشتغل Ignify — ٧ خطوات بسيطة"
                : "How Ignify works — 7 simple steps"}
            </h2>
            <p className="mt-4 text-on-surface-variant">
              {isAr
                ? "من دخول موقعك لأول مرة حتى رؤية التقارير الأسبوعية. لا مصطلحات. لا انتظار."
                : "From the moment you sign up to weekly reports. No jargon. No waiting."}
            </p>
          </motion.div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOLUTION_STEPS.map((step, i) => {
              const Icon = step.icon;
              const label = isAr ? step.ar : step.en;
              const isLast = i === SOLUTION_STEPS.length - 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.08 }}
                    className="flex min-w-28 flex-col items-center gap-2 rounded-xl border border-border bg-surface-container p-4 text-center"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon size={18} />
                    </div>
                    <span className="text-xs font-semibold text-on-surface">
                      {label}
                    </span>
                  </motion.div>
                  {!isLast && (
                    <ArrowRight
                      size={18}
                      className="text-on-surface-variant rtl:rotate-180"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mx-auto mt-8 max-w-xl text-center text-sm italic text-on-surface-variant">
            {isAr
              ? "الذكاء الاصطناعي يقترح — أنت توافق قبل النشر. لا يُنشر شيء دون قرارك."
              : "The AI suggests — you approve before anything publishes. Nothing goes live without your call."}
          </p>
        </div>
      </section>
    </>
  );
}
