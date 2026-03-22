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
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function FeaturesPage() {
  const t = useTranslations("features_page");

  const modules = [
    { key: "content_engine", icon: FileText, color: "from-orange-500 to-amber-500" },
    { key: "creative_studio", icon: Palette, color: "from-purple-500 to-pink-500" },
    { key: "ads_orchestrator", icon: Megaphone, color: "from-blue-500 to-cyan-500" },
    { key: "seo_intelligence", icon: Search, color: "from-green-500 to-emerald-500" },
    { key: "social_media", icon: Share2, color: "from-pink-500 to-rose-500" },
    { key: "lead_crm", icon: Users, color: "from-indigo-500 to-violet-500" },
    { key: "analytics", icon: BarChart3, color: "from-teal-500 to-cyan-500" },
    { key: "email_marketing", icon: Mail, color: "from-red-500 to-orange-500" },
    { key: "workflow_automation", icon: Workflow, color: "from-amber-500 to-yellow-500" },
    { key: "brand_manager", icon: ShieldCheck, color: "from-slate-500 to-gray-600" },
  ] as const;

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

      {/* Modules */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-20 lg:space-y-32">
            {modules.map((mod, index) => (
              <motion.div
                key={mod.key}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={stagger}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
                  index % 2 === 1 ? "lg:direction-reverse" : ""
                }`}
              >
                {/* Content side */}
                <motion.div
                  variants={fadeInUp}
                  className={index % 2 === 1 ? "lg:order-2" : ""}
                >
                  <div
                    className={`inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br ${mod.color} items-center justify-center mb-6`}
                  >
                    <mod.icon className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-bold text-secondary mb-4">
                    {t(`modules.${mod.key}.title`)}
                  </h2>
                  <p className="text-lg text-secondary/60 mb-8 leading-relaxed">
                    {t(`modules.${mod.key}.description`)}
                  </p>
                  <ul className="space-y-3">
                    {(
                      t.raw(`modules.${mod.key}.bullets`) as string[]
                    ).map((bullet: string, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-secondary/70">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>

                {/* Visual side */}
                <motion.div
                  variants={fadeInUp}
                  className={index % 2 === 1 ? "lg:order-1" : ""}
                >
                  <div
                    className={`rounded-2xl bg-gradient-to-br ${mod.color} p-[1px]`}
                  >
                    <div className="bg-surface rounded-2xl p-8 lg:p-12">
                      <div className="aspect-video rounded-xl bg-white shadow-sm flex items-center justify-center">
                        <mod.icon className="w-20 h-20 text-gray-200" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
