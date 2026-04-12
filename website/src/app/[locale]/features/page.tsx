"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  FileText,
  Palette,
  Megaphone,
  Search,
  Share2,
  Users,
  BarChart3,
  Mail,
  Workflow,
  ShieldCheck,
  CheckCircle,
  Compass,
  Sparkles,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function FeaturesPage() {
  const t = useTranslations("features_page");

  const modules = [
    { key: "ai_strategy", Icon: Compass },
    { key: "content_engine", Icon: FileText },
    { key: "creative_studio", Icon: Palette },
    { key: "ads_orchestrator", Icon: Megaphone },
    { key: "seo_intelligence", Icon: Search },
    { key: "social_media", Icon: Share2 },
    { key: "lead_crm", Icon: Users },
    { key: "analytics", Icon: BarChart3 },
    { key: "email_marketing", Icon: Mail },
    { key: "workflow_automation", Icon: Workflow },
    { key: "brand_manager", Icon: ShieldCheck },
  ] as const;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16 bg-background">
        <div className="absolute top-0 end-[-10%] light-leak-orange" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 text-ink leading-tight">
            {t("title")}{" "}
            <span className="brand-gradient-text">{t("titleHighlight")}</span>
          </h1>
          <p className="text-lg sm:text-xl text-on-surface-variant max-w-2xl mx-auto mb-8">
            {t("subtitle")}
          </p>
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-tertiary/10 text-on-tertiary-container text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            {t("headline_capability")}
          </span>
        </div>
      </section>

      {/* Modules */}
      <section className="pb-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20 lg:space-y-32">
          {modules.map(({ key, Icon }, index) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeUp}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center`}
            >
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <div className="inline-flex w-16 h-16 rounded-2xl brand-gradient-bg items-center justify-center mb-6">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-4">
                  {t(`modules.${key}.title`)}
                </h2>
                <p className="text-lg text-on-surface-variant mb-8 leading-relaxed">
                  {t(`modules.${key}.description`)}
                </p>
                <ul className="space-y-3">
                  {(t.raw(`modules.${key}.bullets`) as string[]).map(
                    (bullet, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary-container mt-0.5 shrink-0" />
                        <span className="text-on-surface-variant">{bullet}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>

              <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                <div className="relative aspect-[4/3] rounded-3xl bg-surface-container-lowest shadow-soft overflow-hidden p-8">
                  <div className="absolute inset-8 rounded-2xl brand-gradient-bg opacity-90" />
                  <div className="absolute top-10 end-10 w-40 h-40 rounded-full bg-white/30 blur-2xl" />
                  <div className="absolute bottom-10 start-10 w-40 h-40 rounded-full bg-tertiary/40 blur-3xl" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="w-24 h-24 text-white/80" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
}
