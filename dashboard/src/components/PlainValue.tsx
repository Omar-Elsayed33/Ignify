"use client";

/**
 * PlainValue — the "smart" renderer for any value coming out of the
 * marketing-plan JSON.
 *
 * Problem solved
 * --------------
 * Plan sections contain a mix of: plain strings, numbers, objects with
 * `{low, mid, high}` ranges, objects with free-form keys, and arrays of
 * either. Before Phase 9 the UI showed most non-string values as raw JSON,
 * which looks like a bug to a business owner.
 *
 * This component picks the right presentation:
 *  - strings / numbers → plain text
 *  - {low, mid, high} ranges → RangeBar
 *  - objects with confidence/assumptions → RangeBar + metadata
 *  - arrays of primitives → bulleted list
 *  - arrays of objects → collapsible (not recursive — one level)
 *  - falls back to a styled code block only as a last resort
 *
 * This is the single component the plan-detail page uses for any value
 * whose shape it doesn't know ahead of time.
 */

import { ReactNode } from "react";
import { useLocale } from "next-intl";
import RangeBar, { isRangeObject } from "./RangeBar";
import Glossary from "./Glossary";

type Confidence = "low" | "medium" | "high";

interface Props {
  /** The raw value from the plan JSON. Any shape. */
  value: unknown;
  /** Optional label above the value. Will be glossary-wrapped automatically. */
  label?: string;
  /** Unit shown next to numeric ranges (e.g. "leads/mo", "USD"). */
  unit?: string;
  /** Force compact rendering (for use inside tables). */
  compact?: boolean;
}

function isRangeObjectLike(v: unknown): v is {
  low: number;
  mid: number;
  high: number;
  confidence?: Confidence;
  assumptions?: string[];
  source_basis?: string;
} {
  return isRangeObject(v);
}

function isPrimitive(v: unknown): v is string | number | boolean {
  return (
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

/**
 * Heuristic: detect a value that LOOKS like it should be a range but was
 * shipped by the LLM as a point estimate. Used to tag it with an "estimate"
 * badge without forcing the whole section to re-render.
 */
function isPointCountLike(label?: string): boolean {
  if (!label) return false;
  const low = label.toLowerCase();
  return /\b(leads|customers|revenue|sales|reach|conversions)\b/.test(low);
}

export default function PlainValue({
  value,
  label,
  unit,
  compact = false,
}: Props) {
  const locale = useLocale();
  const isAr = locale === "ar";

  // 1. Null / undefined / empty
  if (value === null || value === undefined || value === "") {
    return (
      <span className="text-sm italic text-on-surface-variant">
        {isAr ? "لا يوجد" : "—"}
      </span>
    );
  }

  // 2. Range objects: {low, mid, high} plus optional confidence + assumptions
  if (isRangeObjectLike(value)) {
    return (
      <RangeBar
        low={value.low}
        mid={value.mid}
        high={value.high}
        unit={unit}
        label={label}
        confidence={value.confidence}
        assumptions={value.assumptions}
        sourceBasis={value.source_basis}
        compact={compact}
      />
    );
  }

  // 3. Primitives: glossary-wrap the label, show the value plainly.
  if (isPrimitive(value)) {
    const display = typeof value === "boolean"
      ? (value ? (isAr ? "نعم" : "Yes") : (isAr ? "لا" : "No"))
      : typeof value === "number"
        ? value.toLocaleString()
        : String(value);

    return (
      <div className="flex flex-col">
        {label && !compact && (
          <span className="text-xs text-on-surface-variant">
            <Glossary term={label}>{label}</Glossary>
          </span>
        )}
        <span className="text-sm text-on-surface">
          {display}
          {unit && typeof value === "number" ? ` ${unit}` : ""}
        </span>
        {isPointCountLike(label) && typeof value === "number" && (
          // Flag point estimates for count-like fields — prompt the user
          // that this is a single-point forecast (not a range). Backend
          // should migrate these to ranges over time.
          <span className="mt-0.5 inline-flex self-start items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {isAr ? "تقدير تقريبي" : "rough estimate"}
          </span>
        )}
      </div>
    );
  }

  // 4. Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span className="text-sm italic text-on-surface-variant">
          {isAr ? "لا يوجد عناصر" : "No items"}
        </span>
      );
    }
    // Arrays of primitives → bulleted list.
    if (value.every(isPrimitive)) {
      return (
        <div className="space-y-1">
          {label && !compact && (
            <div className="text-xs text-on-surface-variant">
              <Glossary term={label}>{label}</Glossary>
            </div>
          )}
          <ul
            className="list-disc space-y-0.5 pl-4 text-sm text-on-surface rtl:pr-4 rtl:pl-0"
            dir={isAr ? "rtl" : "ltr"}
          >
            {value.map((item, i) => (
              <li key={i}>{String(item)}</li>
            ))}
          </ul>
        </div>
      );
    }
    // Arrays of objects → numbered cards, one object per card.
    return (
      <div className="space-y-2">
        {label && !compact && (
          <div className="text-xs font-medium text-on-surface-variant">
            <Glossary term={label}>{label}</Glossary>
          </div>
        )}
        {value.slice(0, 10).map((item, i) => (
          <div
            key={i}
            className="rounded-lg bg-surface-container-lowest p-3"
          >
            <div className="mb-1 text-[11px] font-medium text-on-surface-variant">
              #{i + 1}
            </div>
            <PlainObject value={item as Record<string, unknown>} />
          </div>
        ))}
        {value.length > 10 && (
          <div className="text-xs italic text-on-surface-variant">
            {isAr ? `+${value.length - 10} عناصر إضافية` : `+${value.length - 10} more`}
          </div>
        )}
      </div>
    );
  }

  // 5. Objects — render as key/value pairs. Depth-1 only to avoid runaway.
  if (typeof value === "object") {
    return (
      <div className="space-y-1">
        {label && !compact && (
          <div className="mb-1 text-xs font-medium text-on-surface-variant">
            <Glossary term={label}>{label}</Glossary>
          </div>
        )}
        <PlainObject value={value as Record<string, unknown>} />
      </div>
    );
  }

  // 6. Last resort
  return <span className="text-sm text-on-surface">{String(value)}</span>;
}

/** Render one object's key/value pairs, glossary-wrapping each key. */
function PlainObject({ value }: { value: Record<string, unknown> }): ReactNode {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <span className="text-xs italic text-on-surface-variant">—</span>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[max-content_1fr]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs font-medium text-on-surface-variant">
            <Glossary term={humanize(k)}>{humanize(k)}</Glossary>
          </dt>
          <dd className="text-sm text-on-surface">
            <PlainValue value={v} compact />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Turn snake_case / camelCase keys into human-readable labels. */
function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
