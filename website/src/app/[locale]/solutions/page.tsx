"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import {
  ShoppingBag,
  UtensilsCrossed,
  Stethoscope,
  Building2,
  ArrowRight,
  Check,
} from "lucide-react";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function SolutionsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const register = `${DASHBOARD_URL}/${locale}/register`;

  const verticals = [
    { key: "ecommerce", Icon: ShoppingBag, id: "ecommerce" },
    { key: "restaurants", Icon: UtensilsCrossed, id: "restaurants" },
    { key: "clinics", Icon: Stethoscope, id: "clinics" },
    { key: "realestate", Icon: Building2, id: "realestate" },
  ] as const;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-20 bg-background">
        <div className="absolute top-0 end-[-10%] light-leak-orange" />
        <div className="absolute bottom-0 start-[-10%] light-leak-violet opacity-40" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 text-ink leading-tight">
            {locale === "ar" ? "حلول تسويقية" : "Marketing playbooks"}{" "}
            <span className="brand-gradient-text">
              {locale === "ar" ? "لكل مجال" : "for every industry"}
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-on-surface-variant max-w-2xl mx-auto">
            {locale === "ar"
              ? "Ignify يأتي مع استراتيجيات جاهزة، قوالب محتوى، ووصفات إعلانية مصمّمة خصيصاً لطريقة نمو مجالك."
              : "Ignify ships with pre-built strategies, content templates, and ad recipes tailored to how your industry actually grows."}
          </p>
        </div>
      </section>

      {/* Vertical sections */}
      <section className="pb-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 lg:space-y-32">
          {verticals.map(({ key, Icon, id }, idx) => {
            const benefits = t.raw(`solutions.${key}.benefits`) as string[];
            const reverse = idx % 2 === 1;
            return (
              <motion.div
                key={key}
                id={id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeUp}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center scroll-mt-24 ${
                  reverse ? "lg:[direction:rtl]" : ""
                }`}
              >
                <div className={reverse ? "lg:[direction:ltr] rtl:lg:[direction:rtl]" : ""}>
                  <div className="inline-flex w-16 h-16 rounded-2xl brand-gradient-bg items-center justify-center mb-6">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-4xl sm:text-5xl font-bold text-ink mb-4 leading-tight">
                    {t(`solutions.${key}.title`)}
                  </h2>
                  <p className="text-lg text-on-surface-variant mb-8 leading-relaxed">
                    {t(`solutions.${key}.tagline`)}
                  </p>
                  <ul className="space-y-3 mb-8">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="shrink-0 w-6 h-6 rounded-full brand-gradient-bg flex items-center justify-center mt-0.5">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </span>
                        <span className="text-on-surface-variant leading-relaxed">
                          {b}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={register}
                    className="inline-flex items-center gap-2 brand-gradient-bg text-white px-8 py-4 rounded-xl font-semibold shadow-soft hover:scale-[1.02] transition-transform"
                  >
                    {t(`solutions.${key}.cta`)}
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </a>
                </div>

                <div className={reverse ? "lg:[direction:ltr] rtl:lg:[direction:rtl]" : ""}>
                  <div className="relative aspect-[4/5] bg-surface-container-lowest rounded-3xl shadow-soft overflow-hidden p-6">
                    <div className="absolute inset-6 rounded-2xl brand-gradient-bg opacity-90" />
                    <div className="absolute top-10 end-10 w-40 h-40 rounded-full bg-white/30 blur-2xl" />
                    <div className="absolute bottom-16 start-10 w-48 h-48 rounded-full bg-tertiary/40 blur-3xl" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Icon className="w-32 h-32 text-white/80" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-surface-container-low">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-ink mb-6">
            {locale === "ar"
              ? "مجالك هو التالي"
              : "Your industry is next"}
          </h2>
          <p className="text-lg text-on-surface-variant mb-8">
            {locale === "ar"
              ? "تحدّث معنا عن دليل تسويقي مخصّص لنشاطك."
              : "Talk to us about a tailored playbook for your business."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={register}
              className="brand-gradient-bg text-white px-10 py-5 rounded-2xl font-bold text-lg shadow-soft hover:scale-105 transition-transform"
            >
              {t("nav.register")}
            </a>
            <Link
              href="/contact"
              className="bg-surface-container-lowest text-ink border border-outline-variant/30 px-10 py-5 rounded-2xl font-bold text-lg hover:bg-white transition-all"
            >
              {t("nav.contact")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
