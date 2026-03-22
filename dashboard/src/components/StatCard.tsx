"use client";

import { clsx } from "clsx";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  change: number;
  iconColor?: string;
  iconBg?: string;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  change,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
}: StatCardProps) {
  const isPositive = change >= 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-text-secondary">{label}</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{value}</p>
        </div>
        <div className={clsx("rounded-lg p-2.5", iconBg)}>
          <Icon className={clsx("h-5 w-5", iconColor)} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1">
        {isPositive ? (
          <TrendingUp className="h-4 w-4 text-success" />
        ) : (
          <TrendingDown className="h-4 w-4 text-error" />
        )}
        <span
          className={clsx(
            "text-sm font-medium",
            isPositive ? "text-success" : "text-error"
          )}
        >
          {isPositive ? "+" : ""}
          {change}%
        </span>
        <span className="text-sm text-text-muted">vs last month</span>
      </div>
    </div>
  );
}
