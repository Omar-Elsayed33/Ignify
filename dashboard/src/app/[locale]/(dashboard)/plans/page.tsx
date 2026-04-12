"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import InsightChip from "@/components/InsightChip";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { AlertCircle, Loader2, Plus, Sparkles, FileText, ArrowRight } from "lucide-react";

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

  const statusTone = (status: MarketingPlan["status"]) => {
    if (status === "approved") return "success" as const;
    if (status === "draft") return "primary" as const;
    return "neutral" as const;
  };

  const statusLabel = (status: MarketingPlan["status"]) => {
    const labels: Record<string, string> = {
      draft: t("status.draft"),
      approved: t("status.approved"),
      archived: t("status.archived"),
    };
    return labels[status] ?? status;
  };

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-8">
        <div className="space-y-8">
          <PageHeader
            eyebrow="STRATEGY"
            title={t("title")}
            description={t("subtitle")}
            actions={
              <Button
                onClick={() => router.push("/plans/new")}
                leadingIcon={<Plus className="h-4 w-4" />}
              >
                {t("generateNew")}
              </Button>
            }
          />

          {error && (
            <Card padding="sm" className="flex items-center gap-3 !bg-error-container">
              <AlertCircle className="h-4 w-4 shrink-0 text-on-error-container" />
              <span className="text-sm font-medium text-on-error-container">{error}</span>
            </Card>
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  variant="interactive"
                  padding="lg"
                  onClick={() => router.push(`/plans/${plan.id}`)}
                  className="group flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="brand-gradient-bg flex h-11 w-11 items-center justify-center rounded-xl shadow-soft">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <Badge tone={statusTone(plan.status)}>{statusLabel(plan.status)}</Badge>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-headline line-clamp-2 text-lg font-bold tracking-tight text-on-surface">
                      {plan.title}
                    </h3>
                    <InsightChip icon={Sparkles}>
                      {plan.period_days} {t("days")}
                    </InsightChip>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs text-on-surface-variant">
                    <span className="font-medium">
                      {new Date(plan.created_at).toLocaleDateString()}
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
