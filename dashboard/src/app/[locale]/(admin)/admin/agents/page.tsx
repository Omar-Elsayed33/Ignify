"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Workflow, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

interface AgentListItem {
  name: string;
  default_model: string;
  description: string | null;
  sub_agents: string[];
}

export default function AdminAgentsPage() {
  const t = useTranslations("adminAgents");
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AgentListItem[]>("/api/v1/admin/agents/list")
      .then(setAgents)
      .catch((e) => setError(e?.message ?? "Failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-surface px-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t("title")}</h1>
          <p className="text-xs text-text-muted">{t("subtitle")}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-text-muted">
            {t("list.empty")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <div
                key={a.name}
                className="flex flex-col rounded-xl border border-border bg-surface p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Workflow className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold capitalize text-text-primary">
                        {a.name}
                      </h3>
                      <p className="text-xs text-text-muted">{a.default_model}</p>
                    </div>
                  </div>
                </div>

                {a.description && (
                  <p className="mb-4 line-clamp-3 text-sm text-text-secondary">
                    {a.description}
                  </p>
                )}

                <div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
                  <span className="rounded-full bg-background px-2 py-0.5">
                    {a.sub_agents.length} {t("list.subAgents")}
                  </span>
                </div>

                {a.sub_agents.length > 0 && (
                  <ul className="mb-4 flex flex-wrap gap-1.5">
                    {a.sub_agents.slice(0, 6).map((sa) => (
                      <li
                        key={sa}
                        className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-text-secondary"
                      >
                        {sa}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto">
                  <Link
                    href={`/admin/agents/${a.name}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    {t("list.viewGraph")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
