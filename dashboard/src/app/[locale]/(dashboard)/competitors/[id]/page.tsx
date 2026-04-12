"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Loader2, Play, Camera } from "lucide-react";

interface Snapshot {
  id: string;
  competitor_id: string;
  snapshot_type: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

interface Competitor {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
}

export default function CompetitorDetailPage() {
  const t = useTranslations("competitorsPage");
  const params = useParams<{ id: string }>();
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<"snapshot" | "analyze" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [c, h] = await Promise.all([
        api.get<Competitor>(`/api/v1/competitors/${params.id}`),
        api.get<Snapshot[]>(`/api/v1/competitors/${params.id}/history`),
      ]);
      setCompetitor(c);
      setHistory(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params.id]);

  async function takeSnapshot() {
    setRunning("snapshot");
    try {
      await api.post(`/api/v1/competitors/${params.id}/snapshot`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Snapshot failed");
    } finally {
      setRunning(null);
    }
  }

  async function runAgent() {
    setRunning("analyze");
    try {
      await api.post(`/api/v1/competitors/${params.id}/analyze/agent`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent failed");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div>
      <DashboardHeader title={competitor?.name ?? t("title")} />
      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error && <div className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}
        {competitor && (
          <>
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={takeSnapshot}
                disabled={running !== null}
                className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
              >
                {running === "snapshot" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {t("takeSnapshot")}
              </button>
              <button
                onClick={runAgent}
                disabled={running !== null}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {running === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {t("runAgent")}
              </button>
            </div>

            <h3 className="mb-3 text-lg font-semibold text-text-primary">{t("history")}</h3>
            {history.length === 0 ? (
              <p className="text-sm text-text-muted">No snapshots yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map((s) => {
                  const analysis = (s.data?.analysis ?? null) as Record<string, unknown> | null;
                  const gaps = (s.data?.gaps ?? []) as Array<Record<string, string>>;
                  return (
                    <div key={s.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-text-primary capitalize">{s.snapshot_type}</p>
                        <p className="text-xs text-text-muted">{new Date(s.created_at).toLocaleString()}</p>
                      </div>
                      {analysis && Object.keys(analysis).length > 0 && (
                        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-3 font-sans text-xs text-text-secondary">
                          {JSON.stringify(analysis, null, 2)}
                        </pre>
                      )}
                      {gaps.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-success">{t("gaps")} ({gaps.length})</p>
                          <div className="space-y-2">
                            {gaps.map((g, i) => (
                              <div key={i} className="rounded-lg bg-success/5 p-3">
                                <p className="text-sm font-medium text-text-primary">{g.opportunity}</p>
                                <p className="mt-0.5 text-xs text-text-secondary">{g.rationale}</p>
                                {g.action && <p className="mt-1 text-xs font-medium text-success">→ {g.action}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
