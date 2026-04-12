"use client";

import { clsx } from "clsx";
import { Sparkles } from "lucide-react";

interface InsightChipProps {
  children: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}

/**
 * Signature violet "Ember Insight" chip.
 * bg-tertiary-fixed + on-tertiary-fixed-variant per DESIGN.md
 */
export default function InsightChip({
  children,
  icon: Icon = Sparkles,
  className,
}: InsightChipProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full bg-tertiary-fixed px-3 py-1 font-headline text-[10px] font-bold uppercase tracking-widest text-on-tertiary-fixed-variant",
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}
