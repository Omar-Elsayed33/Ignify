"use client";

import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const roundedMap = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
} as const;

export function Skeleton({
  className,
  rounded = "lg",
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={clsx(
        "animate-pulse bg-surface-container-highest/60",
        roundedMap[rounded],
        className
      )}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={clsx("space-y-2", className)}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx("h-3", i === lines - 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={clsx(
        "rounded-2xl bg-surface-container-lowest p-5 shadow-soft",
        className
      )}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-8 w-1/2" />
      <SkeletonText className="mt-4" lines={2} />
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export default Skeleton;
