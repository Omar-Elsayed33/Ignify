"use client";

/**
 * TrustSection — "No fake promises" messaging block.
 *
 * Phase 6 P1 + P6: the landing page needs to explicitly counter the AI-hype
 * category. Competitors promise "10x growth guaranteed" and "rank #1 in 30
 * days." Ignify's differentiator, now that Phase 2.5 guardrails actually
 * enforce realism, is honesty. This component is where we state it visibly.
 *
 * Design principles:
 * - Stated as what we WON'T do, not what we will — more credible.
 * - 4 concrete commitments, each with a short justification.
 * - Not a footer — placed prominently between "what we do" and "pricing".
 */

import { useLocale } from "next-intl";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, XCircle, Users } from "lucide-react";

interface Promise {
  icon: typeof Shield;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
}

const PROMISES: Promise[] = [
  {
    icon: XCircle,
    title_ar: "لا وعود مضمونة",
    title_en: "No guaranteed outcomes",
    body_ar:
      "التسويق لا يُضمن. نعطيك نطاقات واقعية (متحفظ / متوقع / متفائل) مع الفرضيات التي بنى عليها الذكاء الاصطناعي تقديراته، وتراجع أنت قبل التنفيذ.",
    body_en:
      "Marketing outcomes are never guaranteed. We give you conservative / expected / optimistic ranges with the assumptions the AI used, so you can sanity-check before acting.",
  },
  {
    icon: CheckCircle2,
    title_ar: "الذكاء الاصطناعي يقترح، أنت توافق",
    title_en: "AI suggests, humans approve",
    body_ar:
      "كل محتوى يمر بدورة مراجعة قبل النشر. تستطيع تفعيل «نمط الموافقة الإلزامية» بنقرة واحدة، ولن يصل أي منشور إلى حساباتك قبل موافقة شخص حقيقي.",
    body_en:
      "Every generated post goes through a review cycle before publishing. One toggle enables mandatory approval — nothing reaches your accounts until a human signs off.",
  },
  {
    icon: Shield,
    title_ar: "حدود إنفاق شفافة",
    title_en: "Transparent spending caps",
    body_ar:
      "كل باقة لها سقف محدد لاستخدام الذكاء الاصطناعي بالدولار. لن نفاجئك بفاتورة مضاعفة — عند بلوغ الحد، نوقف الإنفاق ونخبرك.",
    body_en:
      "Every tier has an explicit dollar cap on AI usage. We won't surprise you with overage bills — when you hit the cap, we stop spending and tell you.",
  },
  {
    icon: Users,
    title_ar: "بياناتك ملكك",
    title_en: "Your data stays yours",
    body_ar:
      "نعزل بيانات كل مشترك في قاعدة بياناتنا. لا نستخدمها لتدريب نماذج، ولا نشاركها، ونوفر تصدير بياناتك أو حذفها نهائياً وقت ما تشاء.",
    body_en:
      "Every tenant's data is isolated in our database. We don't train models on it, we don't share it, and you can export or delete it permanently at any time.",
  },
];

export default function TrustSection() {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <section
      id="trust"
      className="relative overflow-hidden border-y border-border/50 bg-surface-container-lowest py-20"
    >
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Shield size={12} />
            {isAr ? "وعودنا لك" : "Our commitments"}
          </div>
          <h2 className="text-3xl font-bold text-on-surface sm:text-4xl">
            {isAr
              ? "لا وعود وهمية. لا نتائج مضمونة. شفافية فقط."
              : "No fake promises. No guaranteed results. Just transparency."}
          </h2>
          <p className="mt-4 text-on-surface-variant">
            {isAr
              ? "نؤمن أن أدوات التسويق الذكي تفشل عندما تعد بالمستحيل. إليك ما نلتزم به بدلاً من ذلك."
              : "We believe AI marketing tools fail when they promise the impossible. Here's what we commit to instead."}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {PROMISES.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex gap-4 rounded-2xl border border-border bg-surface p-6"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">
                    {isAr ? p.title_ar : p.title_en}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                    {isAr ? p.body_ar : p.body_en}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 rounded-xl bg-primary/5 p-4 text-center text-sm text-on-surface-variant"
        >
          {isAr
            ? "الذكاء الاصطناعي يصنع مسودات قوية. أنت تصنع القرارات. هذا التقسيم يجعله يعمل."
            : "AI drafts good starting points. Humans make the calls. That division is what makes this work."}
        </motion.div>
      </div>
    </section>
  );
}
