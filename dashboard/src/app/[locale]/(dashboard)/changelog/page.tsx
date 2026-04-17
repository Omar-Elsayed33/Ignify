"use client";

import DashboardHeader from "@/components/DashboardHeader";
import { useLocale } from "next-intl";
import { Sparkles, Wrench, Rocket } from "lucide-react";

interface Entry {
  version: string;
  date: string;
  category: "feature" | "fix" | "improvement";
  title_ar: string;
  title_en: string;
  description_ar?: string;
  description_en?: string;
}

const ENTRIES: Entry[] = [
  {
    version: "0.4.2",
    date: "2026-04-17",
    category: "improvement",
    title_ar: "تجربة مستخدم أنظف",
    title_en: "Cleaner UX foundation",
    description_ar:
      "نظام إشعارات موحّد، حوار تأكيد جديد، صفحات خطأ، ومؤشّرات تحميل أفضل عبر المنصة.",
    description_en:
      "New unified toast system, confirm dialog, error boundaries, and skeleton loaders across the app.",
  },
  {
    version: "0.4.1",
    date: "2026-04-16",
    category: "feature",
    title_ar: "تكامل Google Search Console و Analytics 4",
    title_en: "Google Search Console + Analytics 4 integration",
    description_ar:
      "اربط موقعك وشاهد الكلمات المفتاحية والصفحات الأكثر ترافيكاً مباشرةً من لوحة SEO.",
    description_en:
      "Connect your site and see top keywords + top pages directly from the SEO dashboard.",
  },
  {
    version: "0.4.0",
    date: "2026-04-14",
    category: "feature",
    title_ar: "استيراد خطط تسويقية من PDF",
    title_en: "Import marketing plans from PDF",
    description_ar:
      "ارفع خطة جاهزة بصيغة PDF، واحصل على تحليل نقاط القوة والضعف، واقتراحات للتحسين.",
    description_en:
      "Upload an existing plan PDF to get AI analysis of strengths/weaknesses + improvement suggestions.",
  },
  {
    version: "0.4.0",
    date: "2026-04-14",
    category: "feature",
    title_ar: "جدولة يدوية + تلقائية",
    title_en: "Manual + auto publish modes",
    description_ar:
      "اختر بين النشر التلقائي أو اليدوي لكل منشور. ربط مباشر بين مولِّد المحتوى والجدولة.",
    description_en:
      "Pick auto or manual publish mode per post. Direct link between content generator and scheduler.",
  },
  {
    version: "0.3.9",
    date: "2026-04-13",
    category: "feature",
    title_ar: "تدقيق SEO عميق مع توصيات AI",
    title_en: "Deep SEO audit with AI recommendations",
    description_ar:
      "زحف متعدد الصفحات + فحص robots.txt/sitemap.xml + توصيات مخصّصة للعمل بدلاً من النصائح العامة.",
    description_en:
      "Multi-page crawl + robots/sitemap checks + business-tailored recommendations instead of generic tips.",
  },
];

const categoryMeta = {
  feature: {
    icon: Rocket,
    label_ar: "ميزة جديدة",
    label_en: "Feature",
    ring: "ring-primary/30 bg-primary-fixed/30",
    text: "text-primary",
  },
  fix: {
    icon: Wrench,
    label_ar: "إصلاح",
    label_en: "Fix",
    ring: "ring-amber-500/30 bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600 dark:text-amber-400",
  },
  improvement: {
    icon: Sparkles,
    label_ar: "تحسين",
    label_en: "Improvement",
    ring: "ring-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
};

export default function ChangelogPage() {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <div>
      <DashboardHeader title={isAr ? "سجل التحديثات" : "Changelog"} />

      <div className="px-8 pb-12 pt-2">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm text-on-surface-variant">
            {isAr
              ? "كل ما هو جديد ومحسّن في Ignify — نضيف ميزات جديدة بشكل متواصل."
              : "Everything new and improved in Ignify — we ship continuously."}
          </p>

          <div className="space-y-3">
            {ENTRIES.map((entry, i) => {
              const meta = categoryMeta[entry.category];
              const Icon = meta.icon;
              return (
                <div
                  key={i}
                  className="rounded-3xl bg-surface-container-lowest p-5 shadow-soft ring-1 ring-outline/10"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${meta.ring}`}
                    >
                      <Icon className={`h-4 w-4 ${meta.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-semibold ${meta.text}`}>
                          {isAr ? meta.label_ar : meta.label_en}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                          v{entry.version} · {entry.date}
                        </span>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-on-surface">
                        {isAr ? entry.title_ar : entry.title_en}
                      </h3>
                      {(isAr ? entry.description_ar : entry.description_en) && (
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {isAr ? entry.description_ar : entry.description_en}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
