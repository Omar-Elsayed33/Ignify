"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { AlertCircle, Loader2, Plus, Sparkles, FileText, ArrowRight } from "lucide-react";
import { clsx } from "clsx";

interface MarketingPlan {
  id: string;
  title: string;
  period_days: number;
  language?: string;
  status: "draft" | "approved" | "archived";
  created_at: string;
  [key: string]: unknown;
}

export default function PlansPage() {
  const t = useTranslations("plans");
  const router = useRouter();

  const [plans, setPlans] = useState<MarketingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<MarketingPlan[]>("/api/v1/plans/");
        setPlans(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errorLoad"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const statusBadge = (status: MarketingPlan["status"]) => {
    const colors: Record<string, string> = {
      draft: "bg-text-muted/10 text-text-muted",
      approved: "bg-success/10 text-success",
      archived: "bg-border text-text-muted",
    };
    const labels: Record<string, string> = {
      draft: t("status.draft"),
      approved: t("status.approved"),
      archived: t("status.archived"),
    };
    return (
      <span
        className={clsx(
          "rounded-full px-2.5 py-0.5 text-xs font-medium",
          colors[status] ?? "bg-border text-text-muted"
        )}
      >
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-sm text-text-secondary">{t("subtitle")}</p>
          <button
            onClick={() => router.push("/plans/new")}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("generateNew")}
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={t("listEmpty")}
            description={t("subtitle")}
            actionLabel={t("generateNew")}
            onAction={() => router.push("/plans/new")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => router.push(`/plans/${plan.id}`)}
                className="group flex flex-col rounded-xl border border-border bg-surface p-5 text-start transition-all hover:border-primary hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  {statusBadge(plan.status)}
                </div>
                <h3 className="mb-1 line-clamp-2 text-base font-semibold text-text-primary">
                  {plan.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {plan.period_days} {t("days")}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-text-muted">
                  <span>{new Date(plan.created_at).toLocaleDateString()}</span>
                  <ArrowRight className="h-4 w-4 text-text-muted transition-colors group-hover:text-primary rtl:rotate-180" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
