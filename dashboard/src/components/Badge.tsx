"use client";

import { clsx } from "clsx";

type Tone = "neutral" | "success" | "warning" | "error" | "primary" | "secondary" | "tertiary";

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

const toneStyles: Record<Tone, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-error-container text-on-error-container",
  primary: "bg-primary-fixed text-primary",
  secondary: "bg-secondary-fixed text-secondary",
  tertiary: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
};

export default function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
