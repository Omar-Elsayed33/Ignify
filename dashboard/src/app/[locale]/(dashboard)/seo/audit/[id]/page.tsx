"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface Issue { severity?: string; category?: string; title?: string; description?: string }
interface Rec { priority?: string; category?: string; title?: string; description?: unknown; impact?: string }

interface SEOAudit {
  id: string;
  audit_type: string;
  score: number | null;
  issues: Issue[] | null;
  recommendations: Rec[] | null;
  created_at: string;
}

export default function SeoAuditDetailPage() {
  const t = useTranslations("seoPage");
  const params = useParams<{ id: string }>();
  const [audit, setAudit] = useState<SEOAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SEOAudit>(`/api/v1/seo/audits/${params.id}`)
      .then(setAudit)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const score = audit?.score ?? null;
  const scoreColor =
    score == null ? "bg-text-muted/10 text-text-muted" :
    score >= 85 ? "bg-success/10 text-success" :
    score >= 70 ? "bg-accent/10 text-accent" :
    "bg-error/10 text-error";

  return (
    <div>
      <DashboardHeader title={t("auditReport")} />
      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error && <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}
        {audit && (
          <>
            <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div>
                <p className="text-xs text-text-muted">{t("seoScore")}</p>
                <p className="text-2xl font-bold text-text-primary capitalize">{audit.audit_type}</p>
                <p className="mt-1 text-xs text-text-muted">{new Date(audit.created_at).toLocaleString()}</p>
              </div>
              <div className={clsx("flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold", scoreColor)}>
                {score ?? "—"}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-error">
                  Issues ({audit.issues?.length ?? 0})
                </h3>
                <div className="space-y-2">
                  {(audit.issues ?? []).map((i, idx) => (
                    <div key={idx} className="rounded-lg bg-error/5 p-3">
                      <div className="flex items-center gap-2">
                        {i.severity && <span className="rounded bg-error/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-error">{i.severity}</span>}
                        {i.category && <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-muted">{i.category}</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium text-text-primary">{i.title}</p>
                      <p className="mt-0.5 text-xs text-text-secondary">{i.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-success">
                  Recommendations ({audit.recommendations?.length ?? 0})
                </h3>
                <div className="space-y-2">
                  {(audit.recommendations ?? []).map((r, idx) => (
                    <div key={idx} className="rounded-lg bg-success/5 p-3">
                      <div className="flex items-center gap-2">
                        {r.priority && <span className="rounded bg-success/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-success">{r.priority}</span>}
                        {r.category && <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-muted">{r.category}</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium text-text-primary">{r.title}</p>
                      <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-text-secondary">
                        {typeof r.description === "string" ? r.description : JSON.stringify(r.description, null, 2)}
                      </pre>
                      {r.impact && <p className="mt-1 text-xs font-medium text-success">Impact: {r.impact}</p>}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
