"use client";

/**
 * PricingTable — landing-page pricing section aligned with
 * app/modules/billing/service.py::DEFAULT_PLANS.
 *
 * Keep this file in sync with the catalog. If someone edits tiers backend-
 * side without updating this, the website will advertise numbers the
 * product won't honor — that's a trust disaster.
 *
 * Every tier shows:
 *  - monthly price (USD + EGP)
 *  - plans/month, content/month, images/month (concrete numbers, not dots)
 *  - Deep-mode access (a visual gate — "not available" / "3/mo" etc.)
 *  - AI budget cap (explicit dollar ceiling)
 *  - one "who's this for?" line so the user can self-select quickly
 *
 * Offline payment is the primary CTA because online checkout isn't live yet.
 * "Subscribe by WhatsApp / bank transfer" is the honest funnel today.
 */

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Check, X, Crown } from "lucide-react";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

interface Tier {
  slug: "free" | "starter" | "growth" | "pro" | "agency";
  name_ar: string;
  name_en: string;
  price_usd: number;
  price_egp: number;
  tagline_ar: string;
  tagline_en: string;
  who_ar: string;
  who_en: string;
  limits: {
    plans: number;
    deep_plans: number;
    articles: number | "unlimited";
    images: number | "unlimited";
    ai_budget_usd: number;
  };
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    slug: "free",
    name_ar: "مجاني",
    name_en: "Free",
    price_usd: 0,
    price_egp: 0,
    tagline_ar: "جرب المنتج",
    tagline_en: "Try the product",
    who_ar: "لاستكشاف كيف تعمل الخطط قبل الدفع.",
    who_en: "For exploring how plans work before you pay.",
    limits: { plans: 1, deep_plans: 0, articles: 5, images: 10, ai_budget_usd: 0.5 },
  },
  {
    slug: "starter",
    name_ar: "المبتدئ",
    name_en: "Starter",
    price_usd: 29,
    price_egp: 1499,
    tagline_ar: "لصاحب عمل واحد",
    tagline_en: "For solo founders",
    who_ar: "لنشاط صغير يدير التسويق بنفسه (أو مع مساعد واحد).",
    who_en: "Solo operator or 2-person team getting started.",
    limits: { plans: 5, deep_plans: 0, articles: 30, images: 100, ai_budget_usd: 6 },
  },
  {
    slug: "growth",
    name_ar: "النمو",
    name_en: "Growth",
    price_usd: 59,
    price_egp: 2999,
    tagline_ar: "لنشاط يتوسع",
    tagline_en: "For scaling businesses",
    who_ar: "عندما تبدأ في تشغيل إعلانات حقيقية وتحتاج تحليلاً أعمق.",
    who_en: "Once you're running real ad spend and need deeper strategy.",
    limits: { plans: 10, deep_plans: 3, articles: 75, images: 250, ai_budget_usd: 12 },
    highlight: false,
  },
  {
    slug: "pro",
    name_ar: "احترافي",
    name_en: "Pro",
    price_usd: 99,
    price_egp: 4999,
    tagline_ar: "موصى به",
    tagline_en: "Recommended",
    who_ar: "لفريق ٣-١٠ أشخاص يريد سير عمل كامل بمراجعة احترافية.",
    who_en: "3-10 person team wanting a full workflow with pro review.",
    limits: { plans: 25, deep_plans: 8, articles: 150, images: 500, ai_budget_usd: 22 },
    highlight: true,
  },
  {
    slug: "agency",
    name_ar: "الوكالة",
    name_en: "Agency",
    price_usd: 299,
    price_egp: 14999,
    tagline_ar: "للوكالات",
    tagline_en: "For agencies",
    who_ar: "إدارة عدة عملاء بشعارك الخاص وبدون حدود ظاهرة.",
    who_en: "Reseller / multi-client with your own branding.",
    limits: {
      plans: 100,
      deep_plans: 25,
      articles: "unlimited",
      images: "unlimited",
      ai_budget_usd: 70,
    },
  },
];

export default function PricingTable() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const register = `${DASHBOARD_URL}/${locale}/register`;

  return (
    <section
      id="pricing"
      className="border-y border-border/50 bg-background py-20"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold text-on-surface sm:text-4xl">
            {isAr ? "اختر الباقة المناسبة لك" : "Pick the plan that fits you"}
          </h2>
          <p className="mt-4 text-on-surface-variant">
            {isAr
              ? "كل باقة لها سقف إنفاق واضح على الذكاء الاصطناعي. لن تتفاجأ بفاتورة."
              : "Every tier has a clear AI spending cap. No surprise bills."}
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {TIERS.map((tier, i) => {
            const name = isAr ? tier.name_ar : tier.name_en;
            const tagline = isAr ? tier.tagline_ar : tier.tagline_en;
            const who = isAr ? tier.who_ar : tier.who_en;
            const priceDisplay = tier.price_usd === 0
              ? (isAr ? "مجاناً" : "Free")
              : isAr ? `${tier.price_egp.toLocaleString()} ج.م` : `$${tier.price_usd}`;
            const priceSub = tier.price_usd === 0
              ? ""
              : isAr
                ? `(~$${tier.price_usd} / شهر)`
                : `${tier.price_egp.toLocaleString()} EGP / mo`;
            return (
              <motion.div
                key={tier.slug}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className={`relative flex flex-col rounded-2xl border p-5 ${
                  tier.highlight
                    ? "border-primary bg-primary/5 shadow-lg"
                    : "border-border bg-surface"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-on-primary">
                    <Crown size={10} />
                    {isAr ? "الأكثر اختياراً" : "Most popular"}
                  </div>
                )}

                <h3 className="mb-1 text-lg font-bold text-on-surface">{name}</h3>
                <p className="mb-4 text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
                  {tagline}
                </p>

                <div className="mb-4">
                  <div className="text-3xl font-bold text-on-surface">
                    {priceDisplay}
                  </div>
                  {priceSub && (
                    <div className="text-xs text-on-surface-variant">{priceSub}</div>
                  )}
                </div>

                <p className="mb-4 text-xs leading-relaxed text-on-surface-variant">
                  {who}
                </p>

                <ul className="mb-5 space-y-2 text-sm">
                  <LimitRow
                    label_ar="خطط تسويقية / شهر"
                    label_en="Marketing plans / mo"
                    value={String(tier.limits.plans)}
                    isAr={isAr}
                  />
                  <LimitRow
                    label_ar="وضع Deep"
                    label_en="Deep mode"
                    value={
                      tier.limits.deep_plans === 0
                        ? "—"
                        : isAr
                          ? `${tier.limits.deep_plans} / شهر`
                          : `${tier.limits.deep_plans} / mo`
                    }
                    disabled={tier.limits.deep_plans === 0}
                    isAr={isAr}
                  />
                  <LimitRow
                    label_ar="مقالات / شهر"
                    label_en="Content / mo"
                    value={
                      tier.limits.articles === "unlimited"
                        ? isAr ? "غير محدود" : "Unlimited"
                        : String(tier.limits.articles)
                    }
                    isAr={isAr}
                  />
                  <LimitRow
                    label_ar="صور / شهر"
                    label_en="Images / mo"
                    value={
                      tier.limits.images === "unlimited"
                        ? isAr ? "غير محدود" : "Unlimited"
                        : String(tier.limits.images)
                    }
                    isAr={isAr}
                  />
                  <LimitRow
                    label_ar="سقف الذكاء الاصطناعي"
                    label_en="AI budget cap"
                    value={`$${tier.limits.ai_budget_usd}`}
                    isAr={isAr}
                  />
                </ul>

                <div className="mt-auto">
                  <Link
                    href={`${register}?plan=${tier.slug}`}
                    className={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all ${
                      tier.highlight
                        ? "bg-primary text-on-primary hover:brightness-110"
                        : "border border-primary text-primary hover:bg-primary/5"
                    }`}
                  >
                    {tier.slug === "free"
                      ? isAr ? "ابدأ مجاناً" : "Start free"
                      : isAr ? "اشترك بتحويل بنكي" : "Subscribe by bank transfer"}
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-on-surface-variant">
          {isAr
            ? "توليد الفيديو قيد التطوير — غير مدرج في الأسعار حتى يصبح جاهزاً."
            : "Video generation is in development — not included in any tier until it ships."}
        </p>
      </div>
    </section>
  );
}

function LimitRow({
  label_ar,
  label_en,
  value,
  disabled = false,
  isAr,
}: {
  label_ar: string;
  label_en: string;
  value: string;
  disabled?: boolean;
  isAr: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 text-xs">
      <span className="inline-flex items-center gap-1.5 text-on-surface-variant">
        {disabled ? (
          <X size={12} className="text-on-surface-variant opacity-50" />
        ) : (
          <Check size={12} className="text-emerald-600" />
        )}
        {isAr ? label_ar : label_en}
      </span>
      <span
        className={`font-semibold tabular-nums ${
          disabled ? "text-on-surface-variant opacity-60" : "text-on-surface"
        }`}
      >
        {value}
      </span>
    </li>
  );
}
