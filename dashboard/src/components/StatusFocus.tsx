"use client";

/**
 * StatusFocus — three clear status cards for the dashboard home.
 *
 * Why this replaces the existing widgets
 * --------------------------------------
 * The previous dashboard showed 4 stat cards with totals (Leads, Campaigns,
 * Content, Credits). Totals tell you nothing about "what do I do now?".
 * Also showed fake KPI deltas (+14.2%) that were hardcoded literals (Phase 5
 * removed those but the underlying UX was still "look at these numbers").
 *
 * This component answers the three questions a small-business owner actually
 * has when they open the dashboard on a Monday morning:
 *
 *   1. What do I need to do TODAY?
 *   2. What am I waiting on?
 *   3. What's already working?
 *
 * Each card is populated from data the backend actually tracks. No faked
 * percentages, no vanity metrics. If a card has nothing to say, it shows an
 * honest "nothing here yet" state rather than a placeholder number.
 */

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertCircle,
  Clock,
  TrendingUp,
  ChevronRight,
  Check,
} from "lucide-react";

export interface StatusFocusProps {
  /** Concrete actions the user can take today, in order of importance. */
  todoToday: Array<{
    label: string;
    href: string;
  }>;
  /** Things waiting on someone — approvals, payments, reviews. */
  pending: Array<{
    label: string;
    detail?: string;
    href?: string;
  }>;
  /**
   * One-line facts about what's actually working. Feed these from REAL
   * metrics (posts published last week, leads captured, top-performing
   * content). Nothing fabricated.
   */
  working: Array<{
    label: string;
    detail?: string;
  }>;
}

export default function StatusFocus({
  todoToday,
  pending,
  working,
}: StatusFocusProps) {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <section
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
      dir={isAr ? "rtl" : "ltr"}
    >
      <StatusCard
        tone="action"
        icon={AlertCircle}
        title={isAr ? "ماذا تفعل اليوم" : "What to do today"}
        emptyLabel={
          isAr
            ? "لا توجد مهام عاجلة. استمتع بيومك ✨"
            : "No urgent tasks. Enjoy your day ✨"
        }
        items={todoToday.map((item) => ({
          label: item.label,
          href: item.href,
        }))}
      />
      <StatusCard
        tone="pending"
        icon={Clock}
        title={isAr ? "ينتظر مراجعة" : "Pending review"}
        emptyLabel={isAr ? "لا شيء ينتظر مراجعتك" : "Nothing's waiting on you"}
        items={pending.map((item) => ({
          label: item.label,
          detail: item.detail,
          href: item.href,
        }))}
      />
      <StatusCard
        tone="positive"
        icon={TrendingUp}
        title={isAr ? "ما يعمل معك" : "What's working"}
        emptyLabel={
          isAr
            ? "سنعرض أبرز نتائجك فور جمع بيانات كافية"
            : "We'll highlight what's working once we have enough data"
        }
        items={working.map((item) => ({
          label: item.label,
          detail: item.detail,
        }))}
      />
    </section>
  );
}

/** One of the three cards. Renders items when populated, an empty state
 * message otherwise. Items with `href` are clickable rows. */
function StatusCard({
  tone,
  icon: Icon,
  title,
  items,
  emptyLabel,
}: {
  tone: "action" | "pending" | "positive";
  icon: typeof AlertCircle;
  title: string;
  items: Array<{ label: string; detail?: string; href?: string }>;
  emptyLabel: string;
}) {
  // Color tokens come from the MD3 theme in use across the dashboard.
  const toneClasses = {
    action: {
      headerIcon: "bg-error-container text-on-error-container",
      border: "border-error/30",
      itemAccent: "text-error",
    },
    pending: {
      headerIcon:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      border: "border-amber-300/30",
      itemAccent: "text-amber-700 dark:text-amber-300",
    },
    positive: {
      headerIcon:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      border: "border-emerald-300/30",
      itemAccent: "text-emerald-700 dark:text-emerald-300",
    },
  }[tone];

  return (
    <div className={`rounded-2xl border bg-surface p-5 shadow-soft ${toneClasses.border}`}>
      <div className="mb-3 flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${toneClasses.headerIcon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-sm text-on-surface-variant">
          <Check className="h-4 w-4 opacity-50" />
          <span>{emptyLabel}</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 5).map((item, i) => {
            const content = (
              <div className="flex items-start gap-2">
                <div className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${toneClasses.itemAccent} bg-current`} />
                <div className="flex-1">
                  <p className="text-sm text-on-surface">{item.label}</p>
                  {item.detail && (
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {item.detail}
                    </p>
                  )}
                </div>
                {item.href && (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant rtl:rotate-180" />
                )}
              </div>
            );
            return (
              <li key={i}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block rounded-lg px-1 py-1 hover:bg-surface-container-lowest"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="px-1 py-1">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
