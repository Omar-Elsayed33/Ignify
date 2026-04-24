"use client";

/**
 * FAQ — landing-page objection-handling.
 *
 * Question set is curated from the actual concerns a MENA SMB owner brings
 * to a marketing SaaS:
 *  1. Are the numbers guaranteed? (trust)
 *  2. Does content auto-publish? (control)
 *  3. Do I need marketing experience? (accessibility)
 *  4. Is there online payment? (practical)
 *  5. Does it support Arabic? (market fit)
 *  6. Can agencies use it for multiple clients? (tier fit)
 */

import { useState } from "react";
import { useLocale } from "next-intl";
import { motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const QUESTIONS = [
  {
    q_ar: "هل الأرقام والنتائج مضمونة؟",
    q_en: "Are the numbers and results guaranteed?",
    a_ar:
      "لا. أي أداة تسويق تعدك بضمان نتائج فهي كاذبة. Ignify يعطيك نطاقات واقعية (متحفظ / متوقع / متفائل) مع الفرضيات التي بنى عليها الذكاء الاصطناعي تقديراته، وتراجع أنت قبل التنفيذ. هذا جوهر التمييز عند الصدق.",
    a_en:
      "No. Any marketing tool that guarantees results is lying. Ignify gives you ranges (conservative / expected / optimistic) with the assumptions the AI used, so you can sanity-check before acting. Honest numbers is the whole point.",
  },
  {
    q_ar: "هل المحتوى يُنشر تلقائياً دون موافقتي؟",
    q_en: "Does content auto-publish without my approval?",
    a_ar:
      "لا تلقائياً. كل منشور يمر بدورة مراجعة قبل أن يصل لحساباتك. تستطيع تفعيل «وضع الموافقة الإلزامية» بنقرة، وبعدها لا يُنشر شيء إلا بعد موافقة شخص حقيقي من فريقك.",
    a_en:
      "Not by default. Every generated post goes through a review cycle before publishing. One toggle enables mandatory approval — nothing reaches your accounts until a human on your team signs off.",
  },
  {
    q_ar: "هل أحتاج خبرة في التسويق لاستخدامه؟",
    q_en: "Do I need marketing experience to use it?",
    a_ar:
      "لا. صمّمنا الواجهة لصاحب عمل صغير، ليس لخبير تسويق. المصطلحات الصعبة مشروحة عند التمرير بالماوس، وتبدأ كل خطة بـ«ماذا تفعل هذا الأسبوع» قبل الدخول في التفاصيل. إن أردت العمق — موجود. وإن أردت فقط قائمة بالمهام — موجودة أيضاً.",
    a_en:
      "No. The UI is built for a small-business owner, not a marketing consultant. Jargon has hover-to-explain, every plan opens with a 'What to do this week' list, and the complex tabs are there if — and only if — you want them.",
  },
  {
    q_ar: "هل يوجد دفع أونلاين ببطاقة الائتمان؟",
    q_en: "Is there online credit-card payment?",
    a_ar:
      "لا حالياً. نحن في انتظار إكمال إجراءات Stripe و Paymob الرسمية (KYC). في هذه الأثناء، الاشتراك يتم بالتحويل البنكي أو Fawry أو عبر واتساب مباشرة — تفعيل خلال ٢٤ ساعة. سنعلن عن الدفع الأونلاين فور اكتماله.",
    a_en:
      "Not yet. We're pending Stripe + Paymob KYC. Meanwhile subscriptions work via bank transfer / Fawry / WhatsApp with 24-hour activation. We'll announce online payment the moment it's live.",
  },
  {
    q_ar: "هل يدعم اللغة العربية بشكل كامل؟",
    q_en: "Does it fully support Arabic?",
    a_ar:
      "نعم — العربية هي اللغة الرئيسية، ليست مجرد ترجمة. الواجهة، المحتوى، التقارير، وحتى مراجعة الذكاء الاصطناعي — كل شيء بالعربية الفصحى والعامية حسب نبرة علامتك. الاتجاه من اليمين لليسار مدعوم في كل صفحة.",
    a_en:
      "Yes — Arabic is the primary language, not an afterthought. UI, content, reports, and AI review — all in MSA or dialect depending on your brand voice. RTL layout works on every page.",
  },
  {
    q_ar: "هل يمكن لوكالة تسويق استخدامه لعدة عملاء؟",
    q_en: "Can a marketing agency use it across multiple clients?",
    a_ar:
      "نعم. باقة «الوكالة» ($299/شهر) تتضمن حتى ٥٠ مساحة عمل منفصلة، علامة تجارية مخصصة (White-label) بدومينك وشعارك، و٢٥ خطة تفصيلية Deep شهرياً. مصممة خصيصاً للوكالات التي تبيع التسويق كخدمة.",
    a_en:
      "Yes. The Agency tier ($299/mo) includes up to 50 separate workspaces, full white-label (your domain + logo), and 25 Deep-mode plans per month. Built specifically for agencies reselling marketing as a service.",
  },
];

export default function FAQ() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="border-y border-border/50 bg-background py-20"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-3xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <h2 className="text-3xl font-bold text-on-surface sm:text-4xl">
            {isAr ? "أسئلة يسألها كل صاحب عمل" : "Questions every owner asks"}
          </h2>
          <p className="mt-3 text-on-surface-variant">
            {isAr
              ? "إجابات صريحة. لو عندك سؤال مختلف، راسلنا على واتساب."
              : "Straight answers. Got something else? Message us on WhatsApp."}
          </p>
        </motion.div>

        <div className="space-y-2">
          {QUESTIONS.map((q, i) => {
            const open = openIndex === i;
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
                >
                  <span className="text-sm font-semibold text-on-surface">
                    {isAr ? q.q_ar : q.q_en}
                  </span>
                  <span className="shrink-0 text-primary">
                    {open ? <Minus size={18} /> : <Plus size={18} />}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-border/50 bg-surface-container-lowest px-5 py-4 text-sm leading-relaxed text-on-surface-variant">
                    {isAr ? q.a_ar : q.a_en}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
