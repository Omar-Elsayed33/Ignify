"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Rocket,
  Compass,
  Sparkles,
  ImageIcon,
  Share2,
  Users,
  CreditCard,
  Keyboard,
  Check,
  Lightbulb,
  BookOpen,
  Clock,
} from "lucide-react";
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

const TOPIC_META: Record<
  string,
  { icon: React.ElementType; gradient: string; accent: string }
> = {
  "getting-started": {
    icon: Rocket,
    gradient: "from-fuchsia-500/20 via-purple-500/15 to-indigo-500/10",
    accent: "text-fuchsia-500",
  },
  "first-plan": {
    icon: Compass,
    gradient: "from-sky-500/20 via-cyan-500/15 to-teal-500/10",
    accent: "text-sky-500",
  },
  "ai-content": {
    icon: Sparkles,
    gradient: "from-amber-500/20 via-orange-500/15 to-pink-500/10",
    accent: "text-amber-500",
  },
  "ai-images": {
    icon: ImageIcon,
    gradient: "from-rose-500/20 via-pink-500/15 to-fuchsia-500/10",
    accent: "text-rose-500",
  },
  "social-accounts": {
    icon: Share2,
    gradient: "from-emerald-500/20 via-teal-500/15 to-cyan-500/10",
    accent: "text-emerald-500",
  },
  team: {
    icon: Users,
    gradient: "from-indigo-500/20 via-violet-500/15 to-purple-500/10",
    accent: "text-indigo-500",
  },
  billing: {
    icon: CreditCard,
    gradient: "from-lime-500/20 via-green-500/15 to-emerald-500/10",
    accent: "text-lime-500",
  },
  shortcuts: {
    icon: Keyboard,
    gradient: "from-slate-500/20 via-zinc-500/15 to-neutral-500/10",
    accent: "text-slate-500",
  },
};

const ALL_SLUGS = Object.keys(SLUG_TO_KEY);

type Block =
  | { type: "step"; number: string; title: string; body: string }
  | { type: "bullets"; intro?: string; items: string[] }
  | { type: "para"; text: string }
  | { type: "tip"; text: string };

function parseContent(content: string): Block[] {
  const paragraphs = content.split(/\n\n+/);
  const blocks: Block[] = [];

  for (const raw of paragraphs) {
    const p = raw.trim();
    if (!p) continue;

    // Tip / pro tip / important
    const tipMatch = p.match(/^(Tip|Pro tips?|Important|Best practice|Privacy|Troubleshooting):\s*(.*)/is);
    if (tipMatch) {
      blocks.push({ type: "tip", text: `${tipMatch[1]}: ${tipMatch[2]}` });
      continue;
    }

    // Step N — Title. Body...
    const stepDash = p.match(/^Step\s+(\d+)\s*[—–-]\s*([^.\n]+)\.\s*([\s\S]*)$/i);
    if (stepDash) {
      blocks.push({
        type: "step",
        number: stepDash[1],
        title: stepDash[2].trim(),
        body: stepDash[3].trim(),
      });
      continue;
    }

    // 1. Body (single-line leading number)
    const numbered = p.match(/^(\d+)\.\s+([\s\S]+)$/);
    if (numbered) {
      const body = numbered[2].trim();
      // Use first sentence as title if short, else first 60 chars
      const firstSentenceMatch = body.match(/^([^.\n]{3,80})\.\s*([\s\S]*)$/);
      if (firstSentenceMatch) {
        blocks.push({
          type: "step",
          number: numbered[1],
          title: firstSentenceMatch[1].trim(),
          body: firstSentenceMatch[2].trim(),
        });
      } else {
        blocks.push({
          type: "step",
          number: numbered[1],
          title: body.length > 80 ? body.slice(0, 80) + "…" : body,
          body: body.length > 80 ? body : "",
        });
      }
      continue;
    }

    // Bullet list (lines starting with "- ")
    const lines = p.split(/\n/);
    const bulletLines = lines.filter((l) => /^\s*-\s+/.test(l));
    if (bulletLines.length >= 2 && bulletLines.length >= lines.length - 1) {
      const intro = lines.find((l) => !/^\s*-\s+/.test(l))?.trim();
      blocks.push({
        type: "bullets",
        intro: intro || undefined,
        items: bulletLines.map((l) => l.replace(/^\s*-\s+/, "").trim()),
      });
      continue;
    }

    blocks.push({ type: "para", text: p });
  }

  return blocks;
}

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

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
  const description = t(`topics.${key}.description`);
  const content = t(`topics.${key}.content`);
  const blocks = parseContent(content);
  const readTime = estimateReadTime(content);

  const meta = TOPIC_META[topic] ?? TOPIC_META["getting-started"];
  const Icon = meta.icon;

  const related = ALL_SLUGS.filter((s) => s !== topic).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/help"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("backToHelp")}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="overflow-hidden rounded-2xl border border-border bg-surface">
          {/* Hero */}
          <div
            className={`relative overflow-hidden bg-gradient-to-br ${meta.gradient} px-8 py-10 sm:px-12 sm:py-14`}
          >
            {/* decorative vector shapes */}
            <div
              aria-hidden
              className="pointer-events-none absolute -end-10 -top-10 h-48 w-48 rounded-full bg-white/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -start-8 h-56 w-56 rounded-full bg-white/10 blur-3xl"
            />
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="help-grid"
                  width="32"
                  height="32"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 32 0 L 0 0 0 32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#help-grid)" />
            </svg>

            <div className="relative flex items-start gap-5">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-lg shadow-black/5 backdrop-blur ${meta.accent}`}
              >
                <Icon className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-text-muted">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 backdrop-blur">
                    <BookOpen className="h-3.5 w-3.5" />
                    {t("title")}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 backdrop-blur">
                    <Clock className="h-3.5 w-3.5" />
                    {readTime} min read
                  </span>
                </div>
                <h1 className="text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-3 text-base leading-relaxed text-text-secondary sm:text-lg">
                  {description}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-6 px-8 py-10 sm:px-12 sm:py-12">
            {blocks.map((block, i) => {
              if (block.type === "step") {
                return (
                  <div
                    key={i}
                    className="group relative flex gap-5 rounded-xl border border-border/60 bg-surface p-5 transition-shadow hover:shadow-md sm:p-6"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} text-base font-bold ${meta.accent} shadow-sm`}
                    >
                      {block.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-2 text-base font-semibold text-text-primary sm:text-lg">
                        {block.title}
                      </h3>
                      {block.body && (
                        <p className="text-sm leading-relaxed text-text-secondary sm:text-[0.95rem]">
                          {block.body}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              if (block.type === "bullets") {
                return (
                  <div key={i} className="space-y-3">
                    {block.intro && (
                      <p className="text-sm leading-relaxed text-text-secondary sm:text-[0.95rem]">
                        {block.intro}
                      </p>
                    )}
                    <ul className="space-y-2.5">
                      {block.items.map((item, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-3 rounded-lg bg-surface-hover/40 p-3"
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${meta.gradient} ${meta.accent}`}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                          <span className="text-sm leading-relaxed text-text-secondary sm:text-[0.95rem]">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }

              if (block.type === "tip") {
                return (
                  <div
                    key={i}
                    className={`flex gap-4 rounded-xl border border-dashed border-border bg-gradient-to-br ${meta.gradient} p-5`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 ${meta.accent} shadow-sm`}
                    >
                      <Lightbulb className="h-5 w-5" />
                    </div>
                    <p className="flex-1 text-sm leading-relaxed text-text-secondary sm:text-[0.95rem]">
                      {block.text}
                    </p>
                  </div>
                );
              }

              return (
                <p
                  key={i}
                  className="text-sm leading-loose text-text-secondary sm:text-[0.95rem]"
                >
                  {block.text}
                </p>
              );
            })}
          </div>
        </article>

        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t("relatedArticles")}
            </h2>
            <ul className="space-y-1">
              {related.map((slug) => {
                const rMeta = TOPIC_META[slug];
                const RIcon = rMeta.icon;
                return (
                  <li key={slug}>
                    <Link
                      href={`/help/${slug}`}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${rMeta.gradient} ${rMeta.accent}`}
                      >
                        <RIcon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate">
                        {t(`topics.${SLUG_TO_KEY[slug]}.title`)}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
