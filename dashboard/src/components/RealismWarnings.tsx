"use client";

/**
 * RealismWarnings — surfaces the backend's AI-guardrails output.
 *
 * Phase 2.5 added a validator that scans generated plans for over-promise
 * language, absolute-point claims, and missing confidence/assumptions.
 * Warnings live in `agent_runs.output._realism_warnings`. Before this
 * component, they were invisible to reviewers. Now they render as a
 * collapsible panel on the plan detail page so a reviewer can see
 * "3 low-confidence KPIs, 1 round-number estimate" before approving.
 *
 * Rendering model
 * ---------------
 * - `severity: error`   → red. Should block approval (UX decision: we SHOW
 *   the warning but don't force block — approval is a human call).
 * - `severity: warning` → amber. Reviewer should look at the cited field.
 * - `severity: info`    → neutral. Missing-confidence / missing-assumptions
 *   fall here.
 *
 * The raw list can be long. We group by severity and default-collapse the
 * `info` group to keep the reviewer's attention on errors.
 */

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from "lucide-react";

export interface RealismWarning {
  severity: "error" | "warning" | "info";
  kind: string;
  where: string;
  message: string;
}

interface Props {
  warnings: RealismWarning[] | null | undefined;
  /** Default-expand the error group so reviewers don't miss it. */
  defaultExpandErrors?: boolean;
}

const SEVERITY_STYLE = {
  error: {
    bar: "border-l-error bg-error-container/60",
    icon: AlertCircle,
    iconClass: "text-error",
    label_en: "Needs attention",
    label_ar: "يحتاج مراجعة",
  },
  warning: {
    bar: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
    icon: AlertTriangle,
    iconClass: "text-amber-600 dark:text-amber-400",
    label_en: "Review",
    label_ar: "للمراجعة",
  },
  info: {
    bar: "border-l-slate-400 bg-surface-container-lowest",
    icon: Info,
    iconClass: "text-on-surface-variant",
    label_en: "FYI",
    label_ar: "للعلم",
  },
} as const;

export default function RealismWarnings({ warnings, defaultExpandErrors = true }: Props) {
  const t = useTranslations("RealismWarnings");
  const locale = useLocale();
  const isAr = locale === "ar";

  if (!warnings || warnings.length === 0) {
    return null; // Nothing to show — clean generation. Don't clutter.
  }

  // Group by severity and count.
  const grouped: Record<RealismWarning["severity"], RealismWarning[]> = {
    error: [],
    warning: [],
    info: [],
  };
  for (const w of warnings) {
    if (w.severity in grouped) grouped[w.severity].push(w);
  }

  const hasAnything = grouped.error.length + grouped.warning.length + grouped.info.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="mb-3 flex items-center gap-2">
        <Info size={18} className="text-on-surface-variant" />
        <h3 className="text-sm font-semibold text-on-surface">
          {isAr ? "ملاحظات الذكاء الاصطناعي" : "AI review notes"}
        </h3>
        <span className="text-xs text-on-surface-variant">
          {isAr
            ? `${warnings.length} ملاحظة`
            : `${warnings.length} note${warnings.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="space-y-2">
        {(["error", "warning", "info"] as const).map((sev) =>
          grouped[sev].length > 0 ? (
            <SeverityGroup
              key={sev}
              severity={sev}
              items={grouped[sev]}
              defaultOpen={sev === "error" ? defaultExpandErrors : sev === "warning"}
              isAr={isAr}
            />
          ) : null
        )}
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">
        {isAr
          ? "هذه ملاحظات تلقائية من نظامنا للتأكد من أن المخرجات واقعية وليست مبالغ فيها. تحتاج مراجعتك كبشر."
          : "Automated notes from our realism guardrails. They don't block approval — they highlight places a human reviewer should look before the plan goes live."}
      </p>
    </div>
  );
}

function SeverityGroup({
  severity,
  items,
  defaultOpen,
  isAr,
}: {
  severity: keyof typeof SEVERITY_STYLE;
  items: RealismWarning[];
  defaultOpen: boolean;
  isAr: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const s = SEVERITY_STYLE[severity];
  const Icon = s.icon;
  const label = isAr ? s.label_ar : s.label_en;

  return (
    <div className={`border-l-4 ${s.bar} rounded-md`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Icon size={16} className={s.iconClass} />
        <span className="flex-1 text-sm font-medium text-on-surface">
          {label} · {items.length}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <ul className="space-y-1 px-3 pb-3 text-xs">
          {items.map((w, i) => (
            <li key={i} className="rounded-md bg-surface px-2 py-1.5">
              <div className="font-mono text-[10px] uppercase text-on-surface-variant">
                {w.kind}
              </div>
              <div className="mt-0.5 text-on-surface">{w.message}</div>
              {w.where && (
                <div className="mt-0.5 text-[11px] text-on-surface-variant">
                  <span className="opacity-60">{isAr ? "الموقع:" : "at:"}</span>{" "}
                  <span className="font-mono">{w.where}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
