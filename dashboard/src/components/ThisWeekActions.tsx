"use client";

/**
 * ThisWeekActions — "What should you do this week?" card.
 *
 * Why this exists
 * ---------------
 * The execution_roadmap section of a marketing plan contains 30 days of
 * day-by-day actions. Reading 30 rows in a table is not what a small-business
 * owner wants to do on a Monday morning. This card collapses the roadmap
 * down to the 3-5 most immediate actions, in plain language, with owner and
 * expected outcome shown inline. That's the "what do I actually do?" answer.
 *
 * Data model expected
 * -------------------
 * The backend execution_roadmap is an array like:
 *   [
 *     { day: 1, priority_action: "Launch WhatsApp catalog",
 *       owner_role: "owner", expected_outcome: "...",
 *       blocker_to_watch: "..." }
 *     ...
 *   ]
 * We sort by `day` ascending, filter to day ≤ 7, cap at 5 items. If the
 * roadmap has `priority` tags ("high"/"medium"/"low") we prefer "high"
 * first. If both strategies yield empty, we show a friendly empty state
 * rather than pretending.
 *
 * We deliberately don't show day numbers — "Day 3" means different things
 * to different users. "This week" is the frame.
 */

import { useLocale } from "next-intl";
import { CheckSquare, User, Target, AlertCircle } from "lucide-react";

interface RoadmapItem {
  day?: number;
  priority?: "high" | "medium" | "low" | string;
  priority_action?: string;
  action?: string;
  owner_role?: string;
  owner?: string;
  expected_outcome?: string;
  outcome?: string;
  blocker_to_watch?: string;
  blocker?: string;
}

interface Props {
  /**
   * The raw `execution_roadmap` value from the MarketingPlan. Accepts either
   * an array or an object with a `steps` / `actions` / `items` key.
   */
  roadmap: unknown;
  /** Number of items to show. Default 5 — fits comfortably on one screen. */
  maxItems?: number;
}

function normalizeRoadmap(raw: unknown): RoadmapItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as RoadmapItem[];
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["steps", "actions", "items", "days", "plan"]) {
      if (Array.isArray(obj[key])) return obj[key] as RoadmapItem[];
    }
  }
  return [];
}

function pickTopActions(items: RoadmapItem[], maxItems: number): RoadmapItem[] {
  // Strategy 1: first N items of days 1-7. Roadmaps are day-indexed; the
  // first week is what matters.
  const firstWeek = items.filter((i) => {
    if (typeof i.day !== "number") return true; // undated items go through
    return i.day >= 1 && i.day <= 7;
  });
  if (firstWeek.length > 0) {
    // Within the first-week slice, prefer high-priority if annotated.
    const highFirst = [...firstWeek].sort((a, b) => {
      const ap = (a.priority || "").toLowerCase();
      const bp = (b.priority || "").toLowerCase();
      const score = (p: string) =>
        p === "high" ? 0 : p === "medium" ? 1 : p === "low" ? 2 : 3;
      return score(ap) - score(bp);
    });
    return highFirst.slice(0, maxItems);
  }

  // Strategy 2: no day metadata at all — just take the first N.
  return items.slice(0, maxItems);
}

export default function ThisWeekActions({ roadmap, maxItems = 5 }: Props) {
  const locale = useLocale();
  const isAr = locale === "ar";

  const items = pickTopActions(normalizeRoadmap(roadmap), maxItems);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-container-lowest p-5 text-center">
        <p className="text-sm text-on-surface-variant">
          {isAr
            ? "لم تُنشأ قائمة مهام لهذا الأسبوع بعد. أعد تشغيل قسم «خريطة التنفيذ» في الخطة."
            : "No action roadmap yet. Regenerate the Execution Roadmap section to see what to do this week."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-surface p-5 shadow-soft"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <CheckSquare className="h-4 w-4" />
        </div>
        <h3 className="font-bold text-on-surface">
          {isAr ? "ماذا تفعل هذا الأسبوع؟" : "What to do this week"}
        </h3>
      </div>

      <ol className="space-y-3">
        {items.map((item, i) => {
          const action =
            item.priority_action || item.action || (isAr ? "(بدون تفاصيل)" : "(no detail)");
          const owner = item.owner_role || item.owner;
          const outcome = item.expected_outcome || item.outcome;
          const blocker = item.blocker_to_watch || item.blocker;
          const priority = (item.priority || "").toLowerCase();

          return (
            <li
              key={i}
              className="flex gap-3 rounded-lg bg-surface-container-lowest/60 p-3"
            >
              {/* Number chip */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  priority === "high"
                    ? "bg-error-container text-on-error-container"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {i + 1}
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-medium text-on-surface">{action}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                  {owner && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {owner}
                    </span>
                  )}
                  {outcome && (
                    <span className="inline-flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {outcome}
                    </span>
                  )}
                </div>
                {blocker && (
                  <p className="inline-flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      <span className="font-medium">
                        {isAr ? "انتبه: " : "Watch for: "}
                      </span>
                      {blocker}
                    </span>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[11px] italic text-on-surface-variant">
        {isAr
          ? "هذه خلاصة الأسبوع الأول من خريطة التنفيذ الكاملة — استعرض التبويب كاملاً للمزيد."
          : "First week extract from the full execution roadmap — see the tab for the complete 30-day plan."}
      </p>
    </div>
  );
}
