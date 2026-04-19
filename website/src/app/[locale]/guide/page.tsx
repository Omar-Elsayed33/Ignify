"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Rocket,
  Compass,
  Sparkles,
  Share2,
  BarChart3,
  CreditCard,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

const STEPS = [
  { icon: Rocket, key: "register" },
  { icon: Compass, key: "onboarding" },
  { icon: Compass, key: "plan" },
  { icon: Sparkles, key: "content" },
  { icon: Share2, key: "schedule" },
  { icon: BarChart3, key: "analytics" },
] as const;

export default function GuidePage() {
  const t = useTranslations("guide");
  const locale = useLocale();
  const registerHref = `${DASHBOARD_URL}/${locale}/register`;

  return (
    <main className="min-h-screen bg-background text-on-surface" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4 text-center">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
        <div className="relative mx-auto max-w-3xl">
          <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            {t("badge")}
          </span>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-on-surface/70">
            {t("subtitle")}
          </p>
          <a
            href={registerHref}
            className="mt-8 inline-flex items-center gap-2 rounded-xl brand-gradient-bg px-7 py-3.5 text-base font-semibold text-white shadow-soft hover:scale-[1.02] transition-transform"
          >
            {t("cta")}
            <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          </a>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-4xl px-4 pb-20">
        <h2 className="mb-10 text-center text-2xl font-bold">{t("stepsTitle")}</h2>
        <div className="space-y-6">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.key}
                className="flex gap-5 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <span className="text-lg font-bold text-primary">{idx + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1.5 text-lg font-semibold">
                    {t(`steps.${step.key}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-on-surface/70">
                    {t(`steps.${step.key}.body`)}
                  </p>
                </div>
                <Icon className="mt-1 h-6 w-6 shrink-0 text-primary/40" />
              </div>
            );
          })}
        </div>
      </section>

      {/* What you get */}
      <section className="bg-surface-container-low py-16 px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-2xl font-bold">{t("benefitsTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(t.raw("benefits") as string[]).map((benefit: string, i: number) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-surface p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm text-on-surface/80">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans quick look */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold">{t("plansTitle")}</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {(["starter", "pro", "agency"] as const).map((plan) => (
            <div
              key={plan}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
            >
              <CreditCard className="mb-3 h-6 w-6 text-primary" />
              <h3 className="mb-1 text-lg font-bold">{t(`plans.${plan}.name`)}</h3>
              <p className="mb-3 text-2xl font-extrabold text-primary">
                {t(`plans.${plan}.price`)}
              </p>
              <p className="text-sm text-on-surface/70">{t(`plans.${plan}.desc`)}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-on-surface/60">{t("plansNote")}</p>
      </section>

      {/* Bottom CTA */}
      <section className="bg-surface-container-low py-16 px-4 text-center">
        <h2 className="mb-4 text-2xl font-bold">{t("bottomTitle")}</h2>
        <p className="mb-8 text-on-surface/70">{t("bottomSubtitle")}</p>
        <a
          href={registerHref}
          className="inline-flex items-center gap-2 rounded-xl brand-gradient-bg px-8 py-4 text-lg font-semibold text-white shadow-soft hover:scale-[1.02] transition-transform"
        >
          {t("cta")}
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </a>
      </section>
    </main>
  );
}
