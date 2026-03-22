"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import Button from "@/components/Button";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Calendar,
  ArrowRight,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function ContactPage() {
  const t = useTranslations("contact_page");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    interest: "general",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic would go here
    alert("Thank you! We'll be in touch soon.");
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const contactInfo = [
    { icon: Mail, label: t("email"), href: `mailto:${t("email")}` },
    { icon: Phone, label: t("phone"), href: `tel:${t("phone")}` },
    { icon: MapPin, label: t("address"), href: "#" },
    { icon: Clock, label: t("hours"), href: "#" },
  ];

  const interestKeys = [
    "general",
    "demo",
    "pricing",
    "support",
    "partnership",
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

      {/* Contact Form & Info */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {/* Form */}
            <motion.div variants={fadeInUp} className="lg:col-span-3">
              <h2 className="text-2xl font-bold text-secondary mb-8">
                {t("form_title")}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      {t("name_label")}
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder={t("name_placeholder")}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      {t("email_label")}
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t("email_placeholder")}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-secondary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      {t("company_label")}
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      placeholder={t("company_placeholder")}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">
                      {t("interest_label")}
                    </label>
                    <select
                      name="interest"
                      value={formData.interest}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-secondary bg-white"
                    >
                      {interestKeys.map((key) => (
                        <option key={key} value={key}>
                          {t(`interest_options.${key}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    {t("message_label")}
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={t("message_placeholder")}
                    rows={5}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-secondary resize-none"
                  />
                </div>

                <Button variant="primary" size="lg" type="submit">
                  <Send className="w-5 h-5 me-2" />
                  {t("submit")}
                </Button>
              </form>
            </motion.div>

            {/* Sidebar */}
            <motion.div variants={fadeInUp} className="lg:col-span-2 space-y-8">
              {/* Contact info */}
              <div>
                <h3 className="text-xl font-bold text-secondary mb-6">
                  {t("info_title")}
                </h3>
                <div className="space-y-4">
                  {contactInfo.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-start gap-4 p-4 rounded-xl hover:bg-surface transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-secondary/70 text-sm leading-relaxed pt-2">
                        {item.label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Demo CTA */}
              <div className="gradient-primary rounded-2xl p-8 text-white">
                <Calendar className="w-10 h-10 mb-4 text-white/90" />
                <h3 className="text-xl font-bold mb-3">{t("demo_title")}</h3>
                <p className="text-white/80 text-sm leading-relaxed mb-6">
                  {t("demo_text")}
                </p>
                <button className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-semibold rounded-xl hover:bg-white/90 transition-colors">
                  {t("demo_cta")}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
