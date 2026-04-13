"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  FileText,
  Palette,
  Megaphone,
  Search,
  Share2,
  Compass,
  ShoppingBag,
  UtensilsCrossed,
  Stethoscope,
  Building2,
  UserPlus,
  Briefcase,
  Wand2,
  TrendingUp,
  Star,
  TrendingUp as Trending,
} from "lucide-react";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const register = `${DASHBOARD_URL}/${locale}/register`;

  const features = [
    { key: "ai_strategy", Icon: Compass, span: "md:col-span-2" },
    { key: "content_engine", Icon: FileText, span: "" },
    { key: "creative_studio", Icon: Palette, span: "" },
    { key: "ads_orchestrator", Icon: Megaphone, span: "" },
    { key: "seo_intelligence", Icon: Search, span: "" },
    { key: "social_media", Icon: Share2, span: "md:col-span-2" },
  ] as const;

  const solutions = [
    { key: "ecommerce", Icon: ShoppingBag },
    { key: "restaurants", Icon: UtensilsCrossed },
    { key: "clinics", Icon: Stethoscope },
    { key: "realestate", Icon: Building2 },
  ] as const;

  const journeySteps = t.raw("journey.steps") as Array<{
    number: string;
    title: string;
    description: string;
  }>;
  const journeyIcons = [UserPlus, Briefcase, Sparkles, Wand2, TrendingUp];

  const testimonialItems =
    (t.raw("testimonials.items") as Array<{
      quote: string;
      name: string;
      role: string;
      company: string;
    }>) || [];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32 bg-background">
        <div className="absolute -top-20 end-[-10%] light-leak-orange" />
        <div className="absolute bottom-[-10%] start-[-10%] light-leak-violet" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="lg:col-span-7"
          >
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-tertiary/10 text-on-tertiary-container text-xs font-bold tracking-wider mb-6"
            >
              <span className="w-2 h-2 rounded-full brand-gradient-bg" />
              {t("hero.badge")}
            </motion.span>

            <motion.h1
              variants={fadeUp}
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-ink leading-[1.05] mb-8"
              style={{ letterSpacing: "-0.02em" }}
            >
              {t("hero.title")}{" "}
              <span className="brand-gradient-text">
                {t("hero.titleHighlight")}
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg md:text-xl text-on-surface-variant max-w-xl leading-relaxed mb-10"
            >
              {t("hero.subtitle")}
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
              <a
                href={register}
                className="brand-gradient-bg text-white px-8 py-4 rounded-xl font-bold text-lg shadow-soft hover:scale-[1.02] transition-transform inline-flex items-center gap-2"
              >
                {t("hero.cta_primary")}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </a>
              <Link
                href="/contact"
                className="border border-outline-variant/40 text-on-surface px-8 py-4 rounded-xl font-bold text-lg hover:bg-surface-container-low transition-colors"
              >
                {t("hero.cta_secondary")}
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-5 relative"
          >
            {/* Ambient glow */}
            <div className="absolute -inset-6 brand-gradient-bg opacity-20 blur-3xl rounded-[3rem]" />

            {/* Main product card */}
            <div className="relative bg-surface-container-lowest rounded-3xl p-6 shadow-soft border border-outline-variant/30">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg brand-gradient-bg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-ink">Ignify AI</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-outline-variant/60" />
                  <span className="w-2 h-2 rounded-full bg-outline-variant/60" />
                  <span className="w-2 h-2 rounded-full bg-tertiary" />
                </div>
              </div>

              {/* Generated campaign preview */}
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] brand-gradient-bg mb-4">
                <div className="absolute top-6 end-6 w-28 h-28 rounded-full bg-white/25 blur-2xl" />
                <div className="absolute bottom-4 start-6 w-32 h-32 rounded-full bg-tertiary/50 blur-3xl" />
                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  <span className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/25 backdrop-blur-sm text-white text-[10px] font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    {locale === "ar" ? "تم التوليد" : "GENERATED"}
                  </span>
                  <div>
                    <div className="h-2 w-3/4 bg-white/70 rounded-full mb-2" />
                    <div className="h-2 w-1/2 bg-white/40 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Channel chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                {["Instagram", "TikTok", "Meta Ads", "SEO"].map((ch) => (
                  <span
                    key={ch}
                    className="px-2.5 py-1 rounded-md bg-surface-container-high text-on-surface-variant text-[11px] font-semibold"
                  >
                    {ch}
                  </span>
                ))}
              </div>

              {/* Metric rows */}
              <div className="space-y-2.5">
                {[
                  { label: locale === "ar" ? "الوصول" : "Reach", pct: 82 },
                  { label: locale === "ar" ? "التفاعل" : "Engagement", pct: 64 },
                  { label: locale === "ar" ? "التحويل" : "Conversion", pct: 48 },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-on-surface-variant w-20">
                      {m.label}
                    </span>
                    <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${m.pct}%` }}
                        transition={{ duration: 1.2, delay: 0.4 }}
                        className="h-full brand-gradient-bg"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-ink w-8 text-end">
                      {m.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating stat card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="absolute -bottom-6 -end-4 sm:-end-8 bg-surface-container-lowest p-4 rounded-2xl shadow-soft border border-outline-variant/30 max-w-[220px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg brand-gradient-bg flex items-center justify-center">
                  <Trending className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[11px] text-on-surface-variant">
                    {locale === "ar" ? "معدل النمو" : "Growth rate"}
                  </div>
                  <div className="font-bold text-lg text-ink leading-none mt-0.5">
                    +124%
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Floating time-saved chip */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="absolute -top-4 -start-4 sm:-start-6 bg-surface-container-lowest px-4 py-2.5 rounded-2xl shadow-soft border border-outline-variant/30 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-tertiary" />
              <div>
                <div className="text-[10px] text-on-surface-variant leading-none">
                  {locale === "ar" ? "وفّرت" : "Saved"}
                </div>
                <div className="text-sm font-bold text-ink leading-tight">
                  {locale === "ar" ? "15 ساعة/أسبوع" : "15 hrs / week"}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section className="py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16 max-w-2xl mx-auto"
          >
            <motion.h2
              variants={fadeUp}
              className="text-4xl sm:text-5xl font-bold mb-4 text-ink"
            >
              {t("features.title")}{" "}
              <span className="brand-gradient-text">
                {t("features.titleHighlight")}
              </span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-on-surface-variant"
            >
              {t("features.subtitle")}
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {features.map(({ key, Icon, span }) => (
              <motion.div
                key={key}
                variants={fadeUp}
                className={`bg-surface-container-lowest p-8 rounded-[2rem] hover:bg-white transition-all group ${span}`}
              >
                <div className="w-12 h-12 rounded-xl brand-gradient-bg flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-ink">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="text-on-surface-variant leading-relaxed">
                  {t(`features.${key}.description`)}
                </p>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-12 text-center">
            <Link
              href="/features"
              className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all"
            >
              {locale === "ar" ? "كل المزايا" : "See all features"}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </section>

      {/* SOLUTIONS PREVIEW */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-ink">
              {locale === "ar" ? "حلول مصمّمة" : "Built for"}{" "}
              <span className="brand-gradient-text">
                {locale === "ar" ? "لمجال عملك" : "your industry"}
              </span>
            </h2>
            <p className="text-lg text-on-surface-variant">
              {locale === "ar"
                ? "كل نشاط له طريقة تسويق مختلفة. اختر مجالك وشوف كيف يساعدك Ignify."
                : "Every industry grows differently. Pick yours and see how Ignify builds a playbook just for you."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {solutions.map(({ key, Icon }) => (
              <Link
                key={key}
                href="/solutions"
                className="group p-8 rounded-3xl bg-surface-container-lowest hover:bg-white transition-all shadow-soft"
              >
                <div className="w-14 h-14 rounded-2xl brand-gradient-bg flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-ink">
                  {t(`solutions.${key}.title`)}
                </h3>
                <p className="text-on-surface-variant leading-relaxed mb-4 text-sm">
                  {t(`solutions.${key}.tagline`)}
                </p>
                <span className="inline-flex items-center gap-2 text-primary text-sm font-semibold">
                  {locale === "ar" ? "اعرف أكثر" : "Learn more"}
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CUSTOMER JOURNEY — 5 steps, BIG and OBVIOUS */}
      <section className="py-24 lg:py-32 bg-surface-container-low relative overflow-hidden">
        <div className="absolute top-[40%] end-[-15%] light-leak-orange opacity-50" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <span className="label-sm text-primary mb-4 block">
              {t("journey.title")}
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-ink leading-tight">
              {t("journey.subtitle")}
            </h2>
          </div>

          {/* Desktop: horizontal flow with connecting line */}
          <div className="hidden lg:block relative">
            <div className="absolute top-[72px] start-0 end-0 h-0.5 bg-gradient-to-r from-primary-container via-secondary to-tertiary opacity-30" />
            <div className="grid grid-cols-5 gap-6 relative">
              {journeySteps.map((step, i) => {
                const Icon = journeyIcons[i];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="relative mb-6">
                      <div className="w-36 h-36 rounded-3xl bg-surface-container-lowest flex items-center justify-center shadow-soft">
                        <Icon className="w-14 h-14 text-primary-container" />
                      </div>
                      <div className="absolute -top-2 -end-2 w-12 h-12 rounded-2xl brand-gradient-bg text-white font-bold flex items-center justify-center text-lg shadow-soft">
                        {step.number}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-ink mb-2 leading-tight">
                      {step.title}
                    </h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {step.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Mobile: vertical flow */}
          <div className="lg:hidden space-y-6 max-w-md mx-auto">
            {journeySteps.map((step, i) => {
              const Icon = journeyIcons[i];
              const isLast = i === journeySteps.length - 1;
              return (
                <div key={i} className="relative">
                  {!isLast && (
                    <div className="absolute top-28 start-14 w-0.5 h-16 bg-gradient-to-b from-primary-container to-tertiary opacity-30" />
                  )}
                  <div className="flex gap-5">
                    <div className="relative shrink-0">
                      <div className="w-28 h-28 rounded-3xl bg-surface-container-lowest flex items-center justify-center shadow-soft">
                        <Icon className="w-10 h-10 text-primary-container" />
                      </div>
                      <div className="absolute -top-1 -end-1 w-10 h-10 rounded-xl brand-gradient-bg text-white font-bold flex items-center justify-center text-sm shadow-soft">
                        {step.number}
                      </div>
                    </div>
                    <div className="flex-1 pt-3">
                      <h3 className="text-lg font-bold text-ink mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center">
            <p className="text-lg text-on-surface-variant mb-6">
              {t("journey.cta.title")}
            </p>
            <a
              href={register}
              className="inline-flex items-center gap-2 brand-gradient-bg text-white px-10 py-5 rounded-2xl font-bold text-lg shadow-soft hover:scale-[1.02] transition-transform"
            >
              {t("journey.cta.button")}
              <ArrowRight className="w-5 h-5 rtl:rotate-180" />
            </a>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonialItems.length > 0 && (
        <section className="py-24 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-ink">
                {t("testimonials.title")}{" "}
                <span className="brand-gradient-text">
                  {t("testimonials.titleHighlight")}
                </span>
              </h2>
              <p className="text-lg text-on-surface-variant">
                {t("testimonials.subtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonialItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-surface-container-lowest p-8 rounded-3xl shadow-soft"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4 fill-primary-container text-primary-container"
                      />
                    ))}
                  </div>
                  <p className="text-on-surface-variant leading-relaxed mb-6 italic">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full brand-gradient-bg flex items-center justify-center text-white font-bold">
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-sm text-on-surface-variant">
                        {item.role} · {item.company}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] p-12 lg:p-20 bg-inverse-surface text-center">
            <div className="absolute inset-0 opacity-30 pointer-events-none">
              <div className="absolute -top-1/2 -start-1/2 w-full h-full brand-gradient-bg blur-[150px]" />
            </div>
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                {t("finalCta.title")}
              </h2>
              <p className="text-white/70 text-lg mb-10 max-w-2xl mx-auto">
                {t("finalCta.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href={register}
                  className="brand-gradient-bg text-white px-10 py-5 rounded-2xl font-bold text-lg hover:scale-105 transition-transform"
                >
                  {t("finalCta.primaryButton")}
                </a>
                <Link
                  href="/contact"
                  className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-10 py-5 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all"
                >
                  {t("finalCta.secondaryButton")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
