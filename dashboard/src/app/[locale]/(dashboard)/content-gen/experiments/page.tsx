"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Plus, Loader2, AlertCircle, FlaskConical } from "lucide-react";

interface Experiment {
  id: string;
  name: string;
  brief: string;
  target: string;
  channel: string | null;
  language: string;
  status: "draft" | "running" | "completed";
  winner_variant_id: string | null;
  created_at: string;
}

export default function ExperimentsPage() {
  const t = useTranslations("experiments");
  const [items, setItems] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Experiment[]>("/api/v1/experiments");
        setItems(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statusBadge = (s: Experiment["status"]) => {
    const map: Record<string, string> = {
      draft: "bg-border text-text-secondary",
      running: "bg-amber-500/15 text-amber-600",
      completed: "bg-emerald-500/15 text-emerald-600",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[s] || map.draft}`}>
        {t(`status.${s}`)}
      </span>
    );
  };

  return (
    <div>
      <DashboardHeader title={t("title")} />
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-text-secondary">{t("subtitle")}</p>
          <Link
            href="/content-gen/experiments/new"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            {t("new")}
          </Link>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
            <FlaskConical className="mx-auto mb-2 h-10 w-10 text-text-muted" />
            {t("empty")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((exp) => (
              <Link
                key={exp.id}
                href={`/content-gen/experiments/${exp.id}`}
                className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{exp.name}</h3>
                  {statusBadge(exp.status)}
                </div>
                <p className="mb-3 line-clamp-2 text-xs text-text-secondary">{exp.brief}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {exp.target}
                  </span>
                  {exp.channel && (
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-text-secondary">
                      {exp.channel}
                    </span>
                  )}
                  <span className="rounded-full bg-border px-2 py-0.5 text-xs text-text-secondary">
                    {exp.language}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
