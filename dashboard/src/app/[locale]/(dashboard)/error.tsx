"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Dashboard route error:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-8 text-center shadow-soft ring-1 ring-outline/10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-on-surface">{t("title")}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{t("description")}</p>
        {error?.digest && (
          <p className="mt-2 font-mono text-[10px] text-on-surface-variant/60">
            ref: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02]"
          >
            <RefreshCw className="h-4 w-4" />
            {t("retry")}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-surface-container-highest px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant"
          >
            <Home className="h-4 w-4" />
            {t("goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
