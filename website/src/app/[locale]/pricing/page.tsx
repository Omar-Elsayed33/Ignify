"use client";

import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Check, ChevronDown, ArrowRight, Sparkles } from "lucide-react";
import { useAutoCurrency } from "@/lib/useAutoCurrency";

type Currency = "usd" | "egp" | "sar" | "aed";
type Billing = "monthly" | "yearly";

const RATES: Record<Currency, { rate: number; symbol: string }> = {
  usd: { rate: 1, symbol: "$" },
  egp: { rate: 48, symbol: "E£" },
  sar: { rate: 3.75, symbol: "﷼" },
  aed: { rate: 3.67, symbol: "AED " },
};

interface ApiPlan {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  price_usd: number;
  prices?: Record<string, { monthly: number; yearly: number }>;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function PricingPage() {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const [billing, setBilling] = useState<Billing>("monthly");
  const { currency: autoCurrency, setCurrency: setAutoCurrency } =
    useAutoCurrency("USD");
  const currency = autoCurrency.toLowerCase() as Currency;
  const setCurrency = (c: Currency) => setAutoCurrency(c.toUpperCase());
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [apiPlans, setApiPlans] = useState<Record<string, ApiPlan>>({});

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/billing/plans`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: ApiPlan[]) => {
        const byCode: Record<string, ApiPlan> = {};
        for (const p of rows) byCode[p.code] = p;
        setApiPlans(byCode);
      })
      .catch(() => {});
  }, []);

  const plans = ["free", "starter", "pro", "agency"] as const;

  const formatPrice = (usdFallback: number, code: string) => {
    const apiPlan = apiPlans[code];
    const curUpper = currency.toUpperCase();
    const entry = apiPlan?.prices?.[curUpper];
    const yearly = billing === "yearly";
    if (entry) {
      const amount = yearly ? entry.yearly : entry.monthly;
      const { symbol } = RATES[currency];
      return `${symbol}${Math.round(amount).toLocaleString()}`;
    }
    // fallback to legacy FX conversion
    const base = yearly ? usdFallback * 12 * 0.8 : usdFallback;
    const { rate, symbol } = RATES[currency];
    const amount = Math.round(base * rate);
    return `${symbol}${amount.toLocaleString()}`;
  };

  const featureKeys = [
    "articles",
    "images",
    "videos",
    "aiTokens",
    "teamMembers",
    "socialAccounts",
    "leads",
    "analytics",
    "support",
  ] as const;

  const faqItems = t.raw("faq.items") as { q: string; a: string }[];
  const registerHref = `${DASHBOARD_URL}/${locale}/register`;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16 bg-background">
        <div className="absolute -top-20 end-[-10%] light-leak-orange" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 text-ink leading-tight">
            <span className="brand-gradient-text">{t("title")}</span>
          </h1>
          <p className="text-lg sm:text-xl text-on-surface-variant max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>
      </section>

      {/* Toggles */}
      <section className="pb-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="inline-flex items-center bg-surface-container-low rounded-full p-1">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                  billing === "monthly"
                    ? "bg-surface-container-lowest shadow-soft text-ink"
                    : "text-on-surface-variant"
                }`}
              >
                {t("monthly")}
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2 ${
                  billing === "yearly"
                    ? "bg-surface-container-lowest shadow-soft text-ink"
                    : "text-on-surface-variant"
                }`}
              >
                {t("yearly")}
                <span className="inline-block text-xs brand-gradient-bg text-white rounded-full px-2 py-0.5">
                  {t("save20")}
                </span>
              </button>
            </div>

            <div className="inline-flex items-center bg-surface-container-low rounded-full p-1">
              {(["usd", "egp", "sar", "aed"] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold uppercase transition ${
                    currency === c
                      ? "bg-surface-container-lowest shadow-soft text-ink"
                      : "text-on-surface-variant"
                  }`}
                >
                  {t(`currency.${c}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {plans.map((plan) => {
              const usd = parseFloat(t(`plans.${plan}.price`)) || 0;
              const popular = plan === "pro";
              return (
                <motion.div
                  key={plan}
                  variants={fadeUp}
                  className={`relative rounded-3xl p-8 transition-all ${
                    popular
                      ? "brand-gradient-border shadow-soft"
                      : "bg-surface-container-lowest hover:bg-white shadow-soft"
                  }`}
                >
                  {popular && (
                    <span className="absolute -top-3 start-6 brand-gradient-bg text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {t("popular")}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-ink mb-2">
                    {t(`plans.${plan}.name`)}
                  </h3>
                  <p className="text-sm text-on-surface-variant mb-6 min-h-[3rem]">
                    {t(`plans.${plan}.tagline`)}
                  </p>
                  <div className="mb-6">
                    <span className="text-5xl font-extrabold text-ink">
                      {formatPrice(usd, plan)}
                    </span>
                    <span className="text-sm text-on-surface-variant ms-1">
                      {billing === "monthly" ? t("perMonth") : t("perYear")}
                    </span>
                  </div>
                  <a
                    href={registerHref}
                    className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition ${
                      popular
                        ? "brand-gradient-bg text-white hover:opacity-95"
                        : "bg-surface-container-low text-ink hover:bg-surface-container"
                    }`}
                  >
                    {t(`plans.${plan}.cta`)}
                  </a>
                  <ul className="mt-6 space-y-2.5">
                    {featureKeys.slice(0, 6).map((fk) => (
                      <li
                        key={fk}
                        className="flex items-start gap-2 text-sm text-on-surface-variant"
                      >
                        <Check className="w-4 h-4 text-primary-container mt-0.5 shrink-0" />
                        <span>
                          <strong className="text-ink">
                            {t(`comparison.values.${plan}.${fk}`)}
                          </strong>{" "}
                          {t(`comparison.features.${fk}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 bg-surface-container-low">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-ink mb-12">
            {t("comparison.title")}
          </h2>
          <div className="overflow-x-auto bg-surface-container-lowest rounded-3xl shadow-soft">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-start p-4 font-semibold text-ink">
                    {t("comparison.feature")}
                  </th>
                  {plans.map((p) => (
                    <th
                      key={p}
                      className="text-center p-4 font-semibold text-ink"
                    >
                      {t(`plans.${p}.name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureKeys.map((fk, i) => (
                  <tr
                    key={fk}
                    className={i % 2 === 0 ? "bg-surface-container-low/40" : ""}
                  >
                    <td className="p-4 text-on-surface-variant">
                      {t(`comparison.features.${fk}`)}
                    </td>
                    {plans.map((p) => (
                      <td
                        key={p}
                        className="p-4 text-center text-on-surface-variant"
                      >
                        {t(`comparison.values.${p}.${fk}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-ink mb-12">
            {t("faq.title")}
          </h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl bg-surface-container-lowest shadow-soft overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-start"
                >
                  <span className="font-semibold text-ink">{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-on-surface-variant transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-on-surface-variant leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-background">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="rounded-3xl p-12 lg:p-16 bg-inverse-surface relative overflow-hidden">
            <div className="absolute -top-1/2 -start-1/2 w-full h-full brand-gradient-bg blur-[120px] opacity-30 pointer-events-none" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-8">
                {t("cta.title")}
              </h2>
              <a
                href={registerHref}
                className="inline-flex items-center gap-2 brand-gradient-bg text-white font-semibold px-10 py-4 rounded-2xl hover:scale-105 transition-transform"
              >
                {t("cta.button")}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
