"use client";

/**
 * OfflinePayCTA — honest "how do I actually pay?" section.
 *
 * Online checkout isn't live yet (Stripe / Paymob KYC pending). Instead of
 * pretending, this section explains the 3-step offline flow clearly so
 * visitors know exactly what happens after they click "subscribe":
 *
 *   1. Sign up + pick a tier in the dashboard
 *   2. Transfer via bank / Fawry / WhatsApp — submit reference
 *   3. We approve within 24h and unlock your plan
 *
 * WhatsApp CTA is the dominant path for MENA SMB buyers — front it.
 */

import { useLocale } from "next-intl";
import { motion } from "framer-motion";
import { Banknote, MessageCircle, CheckCircle2 } from "lucide-react";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "+201000000000";

export default function OfflinePayCTA() {
  const locale = useLocale();
  const isAr = locale === "ar";

  const steps = [
    {
      num: 1,
      ar: { t: "سجّل واختر باقتك", b: "بعد تسجيلك في لوحة التحكم، اختر الباقة المناسبة." },
      en: { t: "Sign up + pick a tier", b: "After registering, choose the tier that fits from the dashboard." },
    },
    {
      num: 2,
      ar: {
        t: "حوّل بنكياً أو عبر واتساب",
        b: "استخدم التحويل البنكي أو فوري — وأرسل لنا رقم المرجع. أو راسلنا على واتساب مباشرة.",
      },
      en: {
        t: "Pay by bank transfer or WhatsApp",
        b: "Use bank transfer or Fawry — send us the reference. Or message us on WhatsApp directly.",
      },
    },
    {
      num: 3,
      ar: { t: "نفعّل خلال ٢٤ ساعة", b: "يراجع الأدمن طلبك ويفعّل الباقة ومعها حد إنفاق الذكاء الاصطناعي المناسب." },
      en: { t: "We activate within 24h", b: "Admin reviews, activates your plan, and syncs the AI spend cap to your tier." },
    },
  ];

  const waHref = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(
    isAr ? "مرحباً، أريد الاشتراك في Ignify" : "Hi, I'd like to subscribe to Ignify"
  )}`;

  return (
    <section
      id="offline-pay"
      className="bg-surface-container-lowest py-20"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-10 max-w-2xl text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Banknote size={12} />
            {isAr ? "الاشتراك بالتحويل البنكي" : "Bank-transfer subscription"}
          </div>
          <h2 className="text-3xl font-bold text-on-surface sm:text-4xl">
            {isAr
              ? "الدفع الأونلاين قريباً. حالياً ندير الاشتراكات يدوياً."
              : "Online payment is coming. For now we onboard manually."}
          </h2>
          <p className="mt-4 text-on-surface-variant">
            {isAr
              ? "٣ خطوات بسيطة، ٢٤ ساعة من أول تحويل إلى تفعيل الحساب بالكامل."
              : "3 simple steps, 24 hours from the first transfer to a fully activated account."}
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => {
            const copy = isAr ? s.ar : s.en;
            return (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                className="flex flex-col rounded-2xl border border-border bg-surface p-5"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary font-bold">
                  {s.num}
                </div>
                <h3 className="mb-1 font-bold text-on-surface">{copy.t}</h3>
                <p className="text-sm leading-relaxed text-on-surface-variant">{copy.b}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02]"
          >
            <MessageCircle size={16} />
            {isAr ? "راسلنا على واتساب" : "Contact us on WhatsApp"}
          </a>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-primary px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            <CheckCircle2 size={16} />
            {isAr ? "اختر باقتك أولاً" : "Pick your plan first"}
          </a>
        </div>
      </div>
    </section>
  );
}
