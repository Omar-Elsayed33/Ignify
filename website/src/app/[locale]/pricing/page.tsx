"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/Button";
import { Check, ChevronDown, ChevronUp, Zap, Crown, Building2 } from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function PricingPage() {
  const t = useTranslations("pricing_page");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const plans = [
    {
      key: "starter" as const,
      icon: Zap,
      popular: false,
      color: "border-gray-200",
    },
    {
      key: "professional" as const,
      icon: Crown,
      popular: true,
      color: "border-primary",
    },
    {
      key: "enterprise" as const,
      icon: Building2,
      popular: false,
      color: "border-gray-200",
    },
  ];

  const faqKeys = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/3 start-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 end-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6"
          >
            {t("title")}{" "}
            <span className="gradient-text">{t("titleHighlight")}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
            className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto"
          >
            {t("subtitle")}
          </motion.p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {plans.map((plan) => (
              <motion.div
                key={plan.key}
                variants={fadeInUp}
                className={`relative rounded-2xl border-2 ${plan.color} p-8 lg:p-10 ${
                  plan.popular
                    ? "shadow-xl shadow-primary/10 scale-105 lg:scale-105"
                    : "hover:shadow-lg"
                } transition-shadow duration-300 bg-white`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 start-1/2 -translate-x-1/2 px-4 py-1 gradient-primary rounded-full text-white text-sm font-semibold">
                    {t("popular")}
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl ${
                      plan.popular
                        ? "gradient-primary"
                        : "bg-surface"
                    } flex items-center justify-center`}
                  >
                    <plan.icon
                      className={`w-5 h-5 ${
                        plan.popular ? "text-white" : "text-secondary"
                      }`}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-secondary">
                    {t(`${plan.key}.name`)}
                  </h3>
                </div>

                <div className="mb-4">
                  <span className="text-4xl sm:text-5xl font-extrabold text-secondary">
                    {t(`${plan.key}.price`)}
                  </span>
                  <span className="text-secondary/50 ms-1">
                    {t(`${plan.key}.period`)}
                  </span>
                </div>

                <p className="text-secondary/60 mb-8 text-sm leading-relaxed">
                  {t(`${plan.key}.description`)}
                </p>

                <Button
                  variant={plan.popular ? "primary" : "secondary"}
                  size="md"
                  className="w-full mb-8"
                >
                  {t(`${plan.key}.cta`)}
                </Button>

                <ul className="space-y-3">
                  {(t.raw(`${plan.key}.features`) as string[]).map(
                    (feature: string, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-secondary/70">
                          {feature}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-32 bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="text-3xl sm:text-4xl font-bold text-secondary"
            >
              {t("faq_title")}
            </motion.h2>
          </motion.div>

          <motion.div
            className="space-y-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {faqKeys.map((key, index) => (
              <motion.div
                key={key}
                variants={fadeInUp}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setOpenFaq(openFaq === index ? null : index)
                  }
                  className="w-full flex items-center justify-between p-6 text-start hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-secondary pe-4">
                    {t(`faq.${key}`)}
                  </span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-secondary/40 shrink-0" />
                  )}
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 text-secondary/60 leading-relaxed">
                        {t(
                          `faq.${key.replace("q", "a") as `a${string}`}`
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
