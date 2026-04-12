"use client";

import React from "react";
import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("legal.privacy");
  const sections = t.raw("sections") as { heading: string; body: string }[];

  return (
    <section className="pt-20 pb-20 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-ink mb-3">
          {t("title")}
        </h1>
        <p className="text-sm text-on-surface-variant/70 mb-12">{t("updated")}</p>
        <div className="space-y-10">
          {sections.map((s, i) => (
            <div key={i}>
              <h2 className="text-xl font-bold text-ink mb-3">{s.heading}</h2>
              <p className="text-on-surface-variant leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
