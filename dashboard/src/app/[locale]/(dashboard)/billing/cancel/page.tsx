"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { XCircle } from "lucide-react";

export default function BillingCancelPage() {
  const t = useTranslations("billing");
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error/10">
          <XCircle className="h-10 w-10 text-error" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-text-primary">
          {t("cancel.title")}
        </h1>
        <p className="mb-6 text-sm text-text-secondary">
          {t("cancel.subtitle")}
        </p>
        <Link
          href="/billing/plans"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          {t("cancel.tryAgain")}
        </Link>
      </div>
    </div>
  );
}
