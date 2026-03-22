"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import Button from "@/components/Button";
import {
  FileText,
  Palette,
  Megaphone,
  Search,
  Share2,
  Users,
  ArrowRight,
  Play,
  Zap,
  TrendingUp,
  Shield,
  Star,
  CheckCircle,
  Link as LinkIcon,
  Sparkles,
  Rocket,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function HomePage() {
  const t = useTranslations();

  const features = [
    {
      icon: FileText,
      key: "content_engine" as const,
      color: "from-orange-500 to-amber-500",
    },
    {
      icon: Palette,
      key: "creative_studio" as const,
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: Megaphone,
      key: "ads_orchestrator" as const,
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Search,
      key: "seo_intelligence" as const,
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: Share2,
      key: "social_media" as const,
      color: "from-pink-500 to-rose-500",
    },
    {
      icon: Users,
      key: "lead_crm" as const,
      color: "from-indigo-500 to-violet-500",
    },
  ];

  const stats = [
    { value: t("stats.businesses"), label: t("stats.businesses_label"), icon: Users },
    { value: t("stats.content"), label: t("stats.content_label"), icon: FileText },
    { value: t("stats.impressions"), label: t("stats.impressions_label"), icon: TrendingUp },
    { value: t("stats.uptime"), label: t("stats.uptime_label"), icon: Shield },
  ];

  const steps = [
    { key: "step1" as const, icon: LinkIcon, color: "from-orange-500 to-amber-500" },
    { key: "step2" as const, icon: Sparkles, color: "from-purple-500 to-pink-500" },
    { key: "step3" as const, icon: Rocket, color: "from-green-500 to-emerald-500" },
  ];

  const testimonials = ["t1", "t2", "t3"] as const;

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center gradient-hero overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 start-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 end-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/80 text-sm border border-white/10">
                <Zap className="w-4 h-4 text-accent" />
                {t("hero.badge")}
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6"
            >
              {t("hero.title")}{" "}
              <span className="gradient-text">{t("hero.titleHighlight")}</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              {t("hero.subtitle")}
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button variant="primary" size="lg">
                {t("hero.cta_primary")}
                <ArrowRight className="w-5 h-5 ms-2" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                <Play className="w-5 h-5 me-2" />
                {t("hero.cta_secondary")}
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 start-0 end-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-secondary mb-4"
            >
              {t("features.title")}{" "}
              <span className="gradient-text">{t("features.titleHighlight")}</span>
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-secondary/60 max-w-2xl mx-auto"
            >
              {t("features.subtitle")}
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {features.map((feature) => (
              <motion.div
                key={feature.key}
                variants={fadeInUp}
                className="group p-8 rounded-2xl border border-gray-100 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 bg-white"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-secondary mb-3">
                  {t(`features.${feature.key}.title`)}
                </h3>
                <p className="text-secondary/60 leading-relaxed">
                  {t(`features.${feature.key}.description`)}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 lg:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeInUp}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold gradient-text mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-secondary/60 font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-secondary mb-4"
            >
              {t("how_it_works.title")}{" "}
              <span className="gradient-text">{t("how_it_works.titleHighlight")}</span>
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-secondary/60 max-w-2xl mx-auto"
            >
              {t("how_it_works.subtitle")}
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {steps.map((step, index) => (
              <motion.div key={step.key} variants={fadeInUp} className="relative">
                <div className="text-center p-8">
                  <div className="relative inline-block mb-6">
                    <div
                      className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center`}
                    >
                      <step.icon className="w-10 h-10 text-white" />
                    </div>
                    <span className="absolute -top-3 -end-3 w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {t(`how_it_works.${step.key}.number`)}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-secondary mb-3">
                    {t(`how_it_works.${step.key}.title`)}
                  </h3>
                  <p className="text-secondary/60 leading-relaxed">
                    {t(`how_it_works.${step.key}.description`)}
                  </p>
                </div>
                {index < 2 && (
                  <div className="hidden lg:block absolute top-1/3 -end-6 text-primary/30">
                    <ArrowRight className="w-12 h-12" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-32 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-secondary mb-4"
            >
              {t("testimonials.title")}{" "}
              <span className="gradient-text">
                {t("testimonials.titleHighlight")}
              </span>
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-secondary/60 max-w-2xl mx-auto"
            >
              {t("testimonials.subtitle")}
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {testimonials.map((key) => (
              <motion.div
                key={key}
                variants={fadeInUp}
                className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow duration-300 border border-gray-100"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 text-accent fill-accent"
                    />
                  ))}
                </div>
                <p className="text-secondary/70 leading-relaxed mb-6 italic">
                  &ldquo;{t(`testimonials.${key}.quote`)}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-lg">
                    {t(`testimonials.${key}.name`).charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-secondary">
                      {t(`testimonials.${key}.name`)}
                    </p>
                    <p className="text-sm text-secondary/50">
                      {t(`testimonials.${key}.role`)},{" "}
                      {t(`testimonials.${key}.company`)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 start-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 end-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"
            >
              {t("cta.title")}{" "}
              <span className="gradient-text">{t("cta.titleHighlight")}</span>
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-white/70 max-w-2xl mx-auto mb-10"
            >
              {t("cta.subtitle")}
            </motion.p>
            <motion.div variants={fadeInUp}>
              <Button variant="primary" size="lg">
                {t("cta.button")}
                <ArrowRight className="w-5 h-5 ms-2" />
              </Button>
              <p className="text-white/50 text-sm mt-4">{t("cta.note")}</p>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
