"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Rocket,
  Compass,
  Sparkles,
  ImageIcon,
  Share2,
  Users,
  CreditCard,
  Keyboard,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

type Topic = {
  slug: string;
  icon: React.ElementType;
  key:
    | "gettingStarted"
    | "firstPlan"
    | "aiContent"
    | "aiImages"
    | "socialAccounts"
    | "team"
    | "billing"
    | "shortcuts";
};

const TOPICS: Topic[] = [
  { slug: "getting-started", key: "gettingStarted", icon: Rocket },
  { slug: "first-plan", key: "firstPlan", icon: Compass },
  { slug: "ai-content", key: "aiContent", icon: Sparkles },
  { slug: "ai-images", key: "aiImages", icon: ImageIcon },
  { slug: "social-accounts", key: "socialAccounts", icon: Share2 },
  { slug: "team", key: "team", icon: Users },
  { slug: "billing", key: "billing", icon: CreditCard },
  { slug: "shortcuts", key: "shortcuts", icon: Keyboard },
];

export default function HelpCenterPage() {
  const t = useTranslations("helpCenter");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HelpCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-text-muted">{t("subtitle")}</p>
        </div>
      </header>

      <div className="mb-8">
        <input
          type="search"
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          return (
            <Link
              key={topic.slug}
              href={`/help/${topic.slug}`}
              className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 font-semibold text-text-primary">
                {t(`topics.${topic.key}.title`)}
              </h3>
              <p className="mb-4 flex-1 text-sm text-text-muted">
                {t(`topics.${topic.key}.description`)}
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                {t("learnMore")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
