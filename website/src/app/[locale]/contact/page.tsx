"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Mail,
  Phone,
  MessageCircle,
  Clock,
  MapPin,
  Send,
  CheckCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Topic = "sales" | "support" | "partnership";

export default function ContactPage() {
  const t = useTranslations("contact");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    topic: "sales" as Topic,
    message: "",
  });
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(`${API_URL}/api/v1/leads/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "website" }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
      setForm({
        name: "",
        email: "",
        phone: "",
        company: "",
        topic: "sales",
        message: "",
      });
    } catch {
      setStatus("error");
    }
  };

  const inputClass =
    "w-full bg-surface-container-lowest px-4 pt-3 pb-3 rounded-xl border-b-2 border-outline-variant/30 focus:border-primary-container outline-none transition-colors";

  return (
    <>
      <section className="relative overflow-hidden pt-20 pb-12 bg-background">
        <div className="absolute top-0 end-[-10%] light-leak-orange" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 text-ink leading-tight">
            {t("title")}
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <form
              onSubmit={handleSubmit}
              className="bg-surface-container-lowest rounded-3xl p-8 shadow-soft space-y-5"
            >
              {status === "success" && (
                <div className="flex items-center gap-2 p-4 bg-primary-container/10 text-on-primary-container rounded-xl">
                  <CheckCircle className="w-5 h-5" />
                  <span>{t("form.success")}</span>
                </div>
              )}
              {status === "error" && (
                <div className="p-4 bg-error-container text-error rounded-xl">
                  {t("form.error")}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    {t("form.name")}
                  </label>
                  <input
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    {t("form.email")}
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    {t("form.phone")}
                  </label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    {t("form.company")}
                  </label>
                  <input
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  {t("form.topic")}
                </label>
                <select
                  name="topic"
                  value={form.topic}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="sales">{t("form.topics.sales")}</option>
                  <option value="support">{t("form.topics.support")}</option>
                  <option value="partnership">
                    {t("form.topics.partnership")}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  {t("form.message")}
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={handleChange}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex items-center gap-2 brand-gradient-bg text-white font-semibold px-8 py-4 rounded-xl shadow-soft hover:scale-[1.02] transition-transform disabled:opacity-60"
              >
                {status === "sending" ? t("form.sending") : t("form.submit")}
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          <aside className="space-y-6">
            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-soft">
              <h3 className="font-bold text-ink mb-4">{t("info.title")}</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary-container mt-0.5" />
                  <a
                    href={`mailto:${t("info.email")}`}
                    className="text-on-surface-variant hover:text-primary"
                  >
                    {t("info.email")}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary-container mt-0.5" />
                  <span className="text-on-surface-variant">
                    {t("info.phone")}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary-container mt-0.5" />
                  <span className="text-on-surface-variant">
                    {t("info.hours")}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary-container mt-0.5" />
                  <span className="text-on-surface-variant">
                    {t("info.address")}
                  </span>
                </li>
              </ul>
              <a
                href="https://wa.me/15551234567"
                target="_blank"
                rel="noreferrer"
                className="mt-6 flex items-center justify-center gap-2 w-full brand-gradient-bg text-white py-3 rounded-xl font-semibold transition"
              >
                <MessageCircle className="w-5 h-5" />
                {t("info.whatsapp")}
              </a>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
