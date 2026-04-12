"use client";

import { clsx } from "clsx";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  change?: number;
  iconColor?: string;
  iconBg?: string;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  change,
  iconColor = "text-primary",
  iconBg = "bg-primary-fixed",
}: StatCardProps) {
  const hasChange = typeof change === "number";
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="group rounded-2xl bg-surface-container-lowest p-6 shadow-soft ghost-border transition-all hover:-translate-y-0.5 hover:bg-surface-bright">
      <div className="flex items-start justify-between">
        <div className={clsx("rounded-xl p-3 transition-colors", iconBg)}>
          <Icon className={clsx("h-5 w-5", iconColor)} />
        </div>
        {hasChange && (
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold",
              isPositive
                ? "bg-emerald-50 text-emerald-600"
                : "bg-error-container text-on-error-container"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {isPositive ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
      <p className="mt-5 text-sm font-medium text-on-surface-variant">{label}</p>
      <h3 className="mt-1 font-headline text-3xl font-bold tracking-tight text-on-surface">
        {value}
      </h3>
    </div>
  );
}
