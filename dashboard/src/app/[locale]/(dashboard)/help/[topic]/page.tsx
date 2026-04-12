"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

const SLUG_TO_KEY: Record<string, string> = {
  "getting-started": "gettingStarted",
  "first-plan": "firstPlan",
  "ai-content": "aiContent",
  "ai-images": "aiImages",
  "social-accounts": "socialAccounts",
  team: "team",
  billing: "billing",
  shortcuts: "shortcuts",
};

const ALL_SLUGS = Object.keys(SLUG_TO_KEY);

export default function HelpTopicPage({
  params,
}: {
  params: Promise<{ topic: string; locale: string }>;
}) {
  const { topic } = use(params);
  const t = useTranslations("helpCenter");

  const key = SLUG_TO_KEY[topic];
  if (!key) return notFound();

  const title = t(`topics.${key}.title`);
  const content = t(`topics.${key}.content`);
  const paragraphs = content.split(/\n\n+/);

  const related = ALL_SLUGS.filter((s) => s !== topic).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/help"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("backToHelp")}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <article className="rounded-xl border border-border bg-surface p-8">
          <h1 className="mb-2 text-2xl font-bold text-text-primary">{title}</h1>
          <p className="mb-6 text-sm text-text-muted">
            {t(`topics.${key}.description`)}
          </p>
          <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </article>

        <aside className="h-fit rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
            {t("relatedArticles")}
          </h2>
          <ul className="space-y-2">
            {related.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/help/${slug}`}
                  className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-primary"
                >
                  <span>{t(`topics.${SLUG_TO_KEY[slug]}.title`)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
