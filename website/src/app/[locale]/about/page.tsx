"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Lightbulb,
  Heart,
  Eye,
  Target,
  Rocket,
  Shield,
  Users,
  Sparkles,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function AboutPage() {
  const t = useTranslations("about_page");

  const values = [
    { key: "innovation" as const, icon: Rocket, color: "from-orange-500 to-amber-500" },
    { key: "simplicity" as const, icon: Sparkles, color: "from-purple-500 to-pink-500" },
    { key: "transparency" as const, icon: Eye, color: "from-blue-500 to-cyan-500" },
    { key: "customer" as const, icon: Heart, color: "from-red-500 to-rose-500" },
  ];

  const team = [
    { name: "Alex Rivera", role: "CEO & Co-Founder", initials: "AR" },
    { name: "Lina Ahmad", role: "CTO & Co-Founder", initials: "LA" },
    { name: "James Park", role: "VP of Product", initials: "JP" },
    { name: "Maya Johnson", role: "VP of Marketing", initials: "MJ" },
    { name: "Omar Hassan", role: "Head of AI Research", initials: "OH" },
    { name: "Sofia Martinez", role: "Head of Design", initials: "SM" },
  ];

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

      {/* Story */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeInUp}
              className="text-3xl sm:text-4xl font-bold text-secondary mb-8"
            >
              {t("story_title")}
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-secondary/70 leading-relaxed mb-6"
            >
              {t("story_p1")}
            </motion.p>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-secondary/70 leading-relaxed mb-6"
            >
              {t("story_p2")}
            </motion.p>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-secondary/70 leading-relaxed"
            >
              {t("story_p3")}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 lg:py-32 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div
              variants={fadeInUp}
              className="bg-white rounded-2xl p-8 lg:p-12 border border-gray-100"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-secondary mb-4">
                {t("mission_title")}
              </h3>
              <p className="text-secondary/60 leading-relaxed text-lg">
                {t("mission_text")}
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-white rounded-2xl p-8 lg:p-12 border border-gray-100"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6">
                <Lightbulb className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-secondary mb-4">
                {t("vision_title")}
              </h3>
              <p className="text-secondary/60 leading-relaxed text-lg">
                {t("vision_text")}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
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
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-secondary"
            >
              {t("values_title")}
            </motion.h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {values.map((value) => (
              <motion.div
                key={value.key}
                variants={fadeInUp}
                className="group p-8 rounded-2xl border border-gray-100 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${value.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <value.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-secondary mb-3">
                  {t(`values.${value.key}.title`)}
                </h3>
                <p className="text-secondary/60 leading-relaxed">
                  {t(`values.${value.key}.description`)}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Team */}
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
              {t("team_title")}{" "}
              <span className="gradient-text">{t("team_titleHighlight")}</span>
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg text-secondary/60 max-w-2xl mx-auto"
            >
              {t("team_subtitle")}
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {team.map((member) => (
              <motion.div
                key={member.name}
                variants={fadeInUp}
                className="bg-white rounded-2xl p-8 text-center border border-gray-100 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                  {member.initials}
                </div>
                <h3 className="text-lg font-bold text-secondary mb-1">
                  {member.name}
                </h3>
                <p className="text-sm text-secondary/50">{member.role}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
