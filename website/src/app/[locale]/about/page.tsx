"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Target, Eye, Users, Globe, Sparkles } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function AboutPage() {
  const t = useTranslations("about");

  const members = t.raw("team.members") as {
    name: string;
    role: string;
    bio: string;
  }[];
  const milestones = t.raw("milestones.items") as {
    year: string;
    title: string;
    body: string;
  }[];

  return (
    <>
      <section className="relative overflow-hidden pt-20 pb-16 bg-background">
        <div className="absolute top-0 end-[-10%] light-leak-orange" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 text-ink leading-tight">
            {t("title")}
          </h1>
          <p className="text-lg text-on-surface-variant max-w-3xl mx-auto">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="p-10 rounded-3xl bg-surface-container-lowest shadow-soft"
          >
            <div className="w-14 h-14 rounded-2xl brand-gradient-bg flex items-center justify-center mb-5">
              <Target className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-ink mb-3">
              {t("mission.title")}
            </h2>
            <p className="text-on-surface-variant leading-relaxed">
              {t("mission.body")}
            </p>
          </motion.div>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="p-10 rounded-3xl bg-surface-container-lowest shadow-soft"
          >
            <div className="w-14 h-14 rounded-2xl brand-gradient-bg flex items-center justify-center mb-5">
              <Eye className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-ink mb-3">
              {t("vision.title")}
            </h2>
            <p className="text-on-surface-variant leading-relaxed">
              {t("vision.body")}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 bg-surface-container-low">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { Icon: Users, value: t("stats.customers") },
            { Icon: Globe, value: t("stats.countries") },
            { Icon: Sparkles, value: t("stats.plans") },
          ].map(({ Icon, value }, i) => (
            <div key={i} className="p-6">
              <div className="inline-flex w-14 h-14 rounded-2xl brand-gradient-bg items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div className="text-3xl font-extrabold text-ink">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-ink mb-12">
            {t("team.title")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {members.map((m, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="p-6 rounded-3xl bg-surface-container-lowest shadow-soft text-center"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full brand-gradient-bg flex items-center justify-center text-white text-2xl font-bold">
                  {m.name.charAt(0)}
                </div>
                <h3 className="font-bold text-ink">{m.name}</h3>
                <p className="text-sm text-primary mb-2">{m.role}</p>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {m.bio}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-surface-container-low">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-ink mb-12">
            {t("milestones.title")}
          </h2>
          <div className="relative">
            <div className="absolute top-0 bottom-0 start-4 w-0.5 bg-gradient-to-b from-primary-container via-secondary to-tertiary opacity-40" />
            <div className="space-y-8">
              {milestones.map((m, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="relative ps-16"
                >
                  <div className="absolute start-0 top-0 w-8 h-8 rounded-full brand-gradient-bg flex items-center justify-center text-white text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-soft">
                    <span className="inline-block text-xs font-bold text-primary mb-1">
                      {m.year}
                    </span>
                    <h3 className="text-lg font-bold text-ink mb-2">
                      {m.title}
                    </h3>
                    <p className="text-on-surface-variant leading-relaxed">
                      {m.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
