"use client";

/**
 * RangeBar — visual treatment for {low, mid, high} AI-estimate payloads.
 *
 * Phase 2.5 updated the backend so KPIs, channel forecasts, and funnel
 * conversions return ranges with confidence + assumptions. Before this
 * component existed, the frontend rendered raw JSON objects, which looked
 * like a bug. This component is the visual contract that makes the
 * guardrails work: users see a range, a confidence badge, and (on demand)
 * the assumptions + source basis that were used to anchor the estimate.
 *
 * Design choices
 * --------------
 * - Tri-marker bar (low | mid | high) instead of a single point.
 *   Conveys "this is a forecast, not a promise" at a glance.
 * - Confidence as a small colored pill (low=amber, medium=teal, high=emerald).
 *   Never green across the board — a "high confidence" label on a forecast
 *   is still a forecast, not a guarantee.
 * - Assumptions + source_basis hidden behind an "Explain" toggle so simple
 *   views don't overwhelm SMB owners, but the detail is one click away.
 * - RTL-aware: Tailwind's `rtl:` utilities flip the horizontal scale.
 */

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

type Confidence = "low" | "medium" | "high";

export interface RangeBarProps {
  /** Raw range from the backend. `low <= mid <= high`; we clamp if not. */
  low: number;
  mid: number;
  high: number;
  /** Unit shown next to each number (e.g. "leads/mo", "USD", "%"). */
  unit?: string;
  /** Short label above the bar (e.g. "Monthly leads", "CAC"). */
  label?: string;
  /** LLM-declared confidence. Unknown values render neutral grey. */
  confidence?: Confidence | string;
  /** Assumptions the LLM declared — shown in the Explain drawer. */
  assumptions?: string[];
  /** Source basis (e.g. "MENA SMB Meta CPL $3-$8"). */
  sourceBasis?: string;
  /** Compact mode — no label, no explain drawer. For tables/cells. */
  compact?: boolean;
}

function fmt(n: number, unit?: string): string {
  const formatted =
    Math.abs(n) >= 1000
      ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}

const CONFIDENCE_STYLES: Record<Confidence, { bg: string; text: string; label_en: string; label_ar: string }> = {
  low: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-800 dark:text-amber-200",
    label_en: "Low confidence",
    label_ar: "ثقة منخفضة",
  },
  medium: {
    bg: "bg-teal-100 dark:bg-teal-900/30",
    text: "text-teal-800 dark:text-teal-200",
    label_en: "Medium confidence",
    label_ar: "ثقة متوسطة",
  },
  high: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-800 dark:text-emerald-200",
    label_en: "High confidence",
    label_ar: "ثقة عالية",
  },
};

export default function RangeBar({
  low,
  mid,
  high,
  unit,
  label,
  confidence,
  assumptions,
  sourceBasis,
  compact = false,
}: RangeBarProps) {
  const t = useTranslations("RangeBar");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);

  // Defensive: clamp ordering in case the LLM returned a range with the
  // bounds reversed. We do NOT silently fix — just render what we got so
  // reviewers can notice the bug if the LLM is being inconsistent.
  const safeLow = Math.min(low, mid, high);
  const safeHigh = Math.max(low, mid, high);
  const span = safeHigh - safeLow || 1;
  const midPct = ((mid - safeLow) / span) * 100;

  const c: Confidence | undefined =
    confidence && ["low", "medium", "high"].includes(confidence)
      ? (confidence as Confidence)
      : undefined;

  const hasExplain = (assumptions && assumptions.length > 0) || !!sourceBasis;

  return (
    <div className="w-full" dir={isAr ? "rtl" : "ltr"}>
      {label && !compact && (
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-on-surface">{label}</span>
          {c && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[c].bg} ${CONFIDENCE_STYLES[c].text}`}
              title={isAr ? CONFIDENCE_STYLES[c].label_ar : CONFIDENCE_STYLES[c].label_en}
            >
              {isAr ? CONFIDENCE_STYLES[c].label_ar : CONFIDENCE_STYLES[c].label_en}
            </span>
          )}
        </div>
      )}

      {/* Numbers row */}
      <div className="flex items-baseline justify-between gap-2 text-on-surface">
        <div className="flex flex-col">
          <span className="text-xs text-on-surface-variant">{isAr ? "محافظ" : "Conservative"}</span>
          <span className="text-sm font-semibold tabular-nums">{fmt(safeLow, unit)}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-on-surface-variant">{isAr ? "متوقع" : "Expected"}</span>
          <span className="text-base font-bold tabular-nums text-primary">{fmt(mid, unit)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-on-surface-variant">{isAr ? "متفائل" : "Optimistic"}</span>
          <span className="text-sm font-semibold tabular-nums">{fmt(safeHigh, unit)}</span>
        </div>
      </div>

      {/* Tri-marker bar */}
      <div className="relative mt-2 h-2 w-full rounded-full bg-surface-container">
        {/* Filled span from low to high */}
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
        {/* Mid marker */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-surface bg-primary shadow"
          style={{ left: `${midPct}%` }}
          aria-label={isAr ? "القيمة المتوقعة" : "Expected value"}
        />
      </div>

      {/* Explain toggle */}
      {hasExplain && !compact && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Info size={12} />
          {isAr ? "لماذا هذا التقدير؟" : "Why this estimate?"}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
      {open && hasExplain && (
        <div className="mt-2 rounded-lg bg-surface-container-lowest p-3 text-xs">
          {sourceBasis && (
            <div className="mb-2">
              <div className="font-medium text-on-surface">
                {isAr ? "المصدر المرجعي" : "Source basis"}
              </div>
              <div className="text-on-surface-variant">{sourceBasis}</div>
            </div>
          )}
          {assumptions && assumptions.length > 0 && (
            <div>
              <div className="font-medium text-on-surface">
                {isAr ? "الافتراضات" : "Assumptions"}
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-on-surface-variant rtl:pr-4 rtl:pl-0">
                {assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/**
 * Helper: detect whether a backend value is a range object we should render
 * with this component. Accepts both camelCase (low/mid/high) and snake_case
 * variants; some subagents emit `target_range` vs `expected_leads_range`.
 */
export function isRangeObject(v: unknown): v is { low: number; mid: number; high: number } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.low === "number" && typeof o.mid === "number" && typeof o.high === "number";
}
