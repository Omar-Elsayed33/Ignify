"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  Loader2, Play, Camera, X, Maximize2, Globe, TrendingUp,
  AlertTriangle, CheckCircle2, Lightbulb, Target, Sparkles, FileText,
} from "lucide-react";

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

/** Render any value as a pretty HTML block */
function RichValue({ value, dir }: { value: unknown; dir: "ltr" | "rtl" }) {
  if (value == null) return null;
  if (typeof value === "string") {
    // Support markdown-ish headings & bullet lists in the AI response.
    const parts = value.split(/\n{2,}/);
    return (
      <div className="prose-custom" dir={dir}>
        {parts.map((p, i) => {
          const bulletLines = p.split("\n").filter((l) => /^\s*[-*•]\s/.test(l));
          if (bulletLines.length >= 2 && bulletLines.length === p.split("\n").filter(Boolean).length) {
            return (
              <ul key={i} className="list-disc space-y-1 ps-5 text-sm text-on-surface">
                {p.split("\n").map((l, j) => (
                  <li key={j}>{l.replace(/^\s*[-*•]\s*/, "").replace(/\*\*(.+?)\*\*/g, "$1")}</li>
                ))}
              </ul>
            );
          }
          // Bold sentence detection: **Header** → h4
          const boldHeading = p.match(/^\*\*(.+?)\*\*/);
          if (boldHeading) {
            const rest = p.replace(/^\*\*.+?\*\*[:\s]*/, "");
            return (
              <div key={i} className="space-y-2">
                <h4 className="font-headline text-base font-bold text-primary">{boldHeading[1]}</h4>
                {rest && <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">{rest}</p>}
              </div>
            );
          }
          return (
            <p key={i} className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">
              {p.replace(/\*\*(.+?)\*\*/g, "$1")}
            </p>
          );
        })}
      </div>
    );
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-sm text-on-surface">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return (
        <ul className="list-disc space-y-1 ps-5 text-sm text-on-surface" dir={dir}>
          {value.map((v, i) => <li key={i}>{String(v)}</li>)}
        </ul>
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {value.map((v, i) => (
          <div key={i} className="rounded-xl bg-surface-container-low p-4">
            <RichValue value={v} dir={dir} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <dl className="space-y-3">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-surface-container-low p-3">
            <dt className="mb-1 font-headline text-xs font-bold uppercase tracking-wider text-primary">
              {k.replace(/_/g, " ")}
            </dt>
            <dd className="ps-2"><RichValue value={v} dir={dir} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="text-sm">{String(value)}</span>;
}

function Modal({ open, onClose, children, title }: {
  open: boolean; onClose: () => void; children: React.ReactNode; title: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-on-surface/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative my-8 w-full max-w-5xl rounded-2xl bg-surface shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl bg-surface/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="brand-gradient-bg flex h-10 w-10 items-center justify-center rounded-xl text-white">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="font-headline text-lg font-bold text-on-surface">{title}</div>
              <div className="text-xs text-on-surface-variant">تحليل منافس مفصّل عبر الذكاء الاصطناعي</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">{children}</div>
      </div>
    </div>
  );
}

export default function CompetitorDetailPage() {
  const t = useTranslations("competitorsPage");
  const locale = useLocale();
  const dir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";
  const params = useParams<{ id: string }>();
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<"snapshot" | "analyze" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalSnapshot, setModalSnapshot] = useState<Snapshot | null>(null);

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
    try { await api.post(`/api/v1/competitors/${params.id}/snapshot`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Snapshot failed"); }
    finally { setRunning(null); }
  }

  async function runAgent() {
    setRunning("analyze");
    try { await api.post(`/api/v1/competitors/${params.id}/analyze/agent`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Agent failed"); }
    finally { setRunning(null); }
  }

  function extractStats(analysis: unknown): Array<{label: string; value: string; icon: React.ReactNode}> {
    if (!analysis || typeof analysis !== "string") return [];
    const stats: Array<{label: string; value: string; icon: React.ReactNode}> = [];
    const strengthsMatch = analysis.match(/strengths?[:\s\S]*?(?=weaknesses?|$)/i);
    const weaknessesMatch = analysis.match(/weaknesses?[:\s\S]*?(?=opportunities?|$)/i);
    if (strengthsMatch) stats.push({ label: dir === "rtl" ? "نقاط القوة" : "Strengths", value: String((strengthsMatch[0].match(/\n\s*[-*•]/g) || []).length), icon: <CheckCircle2 className="h-4 w-4 text-green-600"/> });
    if (weaknessesMatch) stats.push({ label: dir === "rtl" ? "نقاط الضعف" : "Weaknesses", value: String((weaknessesMatch[0].match(/\n\s*[-*•]/g) || []).length), icon: <AlertTriangle className="h-4 w-4 text-amber-600"/> });
    return stats;
  }

  return (
    <div>
      <DashboardHeader title={competitor?.name ?? t("title")} />
      <div className="p-8">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error && <div className="mb-4 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</div>}
        {competitor && (
          <>
            {/* Header card */}
            <div className="mb-6 rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="brand-gradient-bg flex h-14 w-14 items-center justify-center rounded-2xl text-white">
                    <Globe className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="font-headline text-2xl font-bold text-on-surface">{competitor.name}</h1>
                    {competitor.website && (
                      <a href={competitor.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{competitor.website}</a>
                    )}
                    {competitor.description && <p className="mt-2 text-sm text-on-surface-variant max-w-2xl">{competitor.description}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={takeSnapshot}
                    disabled={running !== null}
                    className="flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-highest disabled:opacity-60"
                  >
                    {running === "snapshot" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {t("takeSnapshot")}
                  </button>
                  <button
                    onClick={runAgent}
                    disabled={running !== null}
                    className="brand-gradient-bg flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-soft hover:opacity-95 disabled:opacity-60"
                  >
                    {running === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {t("runAgent")}
                  </button>
                </div>
              </div>
            </div>

            {/* History */}
            <h3 className="mb-4 font-headline text-xl font-bold text-on-surface flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t("history")} {history.length > 0 && <span className="text-sm font-normal text-on-surface-variant">({history.length})</span>}
            </h3>
            {history.length === 0 ? (
              <div className="rounded-2xl bg-surface-container-lowest p-8 text-center">
                <Lightbulb className="mx-auto mb-3 h-10 w-10 text-primary/40" />
                <p className="text-sm text-on-surface-variant">{dir === "rtl" ? "لا توجد تحليلات بعد. اضغط \"تحليل\" للبدء." : "No analyses yet. Click \"Analyze\" to start."}</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {history.map((s) => {
                  const analysis = s.data?.analysis;
                  const gaps = (s.data?.gaps ?? []) as Array<Record<string, string>>;
                  const isAgent = s.snapshot_type === "ai_analysis" || s.snapshot_type === "ai_agent";
                  const stats = extractStats(analysis);
                  return (
                    <div
                      key={s.id}
                      onClick={() => setModalSnapshot(s)}
                      className="group cursor-pointer rounded-2xl bg-surface-container-lowest p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isAgent ? (
                            <span className="insight-chip flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          ) : (
                            <span className="rounded-full bg-surface-container-high px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                              {s.snapshot_type}
                            </span>
                          )}
                          <p className="text-xs text-on-surface-variant">{new Date(s.created_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</p>
                        </div>
                        <Maximize2 className="h-4 w-4 text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>

                      {/* Quick preview */}
                      {typeof analysis === "string" && (
                        <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-on-surface" dir={dir}>
                          {analysis.replace(/\*\*/g, "").slice(0, 200)}…
                        </p>
                      )}

                      {/* Mini stats */}
                      {stats.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {stats.map((st, i) => (
                            <div key={i} className="flex items-center gap-1.5 rounded-lg bg-surface-container-low px-2.5 py-1 text-xs">
                              {st.icon}
                              <span className="text-on-surface-variant">{st.label}:</span>
                              <span className="font-semibold text-on-surface">{st.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {gaps.length > 0 && (
                        <div className="rounded-lg bg-tertiary-fixed/30 p-2 text-xs text-on-tertiary-container">
                          <TrendingUp className="inline h-3 w-3 me-1" />
                          {gaps.length} {dir === "rtl" ? "فرصة مكتشفة" : "opportunities found"}
                        </div>
                      )}

                      <div className="mt-3 text-xs font-semibold text-primary flex items-center gap-1">
                        {dir === "rtl" ? "اضغط لعرض التحليل الكامل" : "Click to view full analysis"} →
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        open={modalSnapshot !== null}
        onClose={() => setModalSnapshot(null)}
        title={competitor?.name ? `${dir === "rtl" ? "تحليل" : "Analysis of"} ${competitor.name}` : "Analysis"}
      >
        {modalSnapshot && (
          <>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="rounded-full bg-surface-container-high px-2.5 py-1 font-semibold">{modalSnapshot.snapshot_type}</span>
              <span>{new Date(modalSnapshot.created_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</span>
            </div>

            {/* Analysis body */}
            {modalSnapshot.data?.analysis && (
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
                <h3 className="mb-4 font-headline text-lg font-bold text-on-surface flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  {dir === "rtl" ? "التحليل التنافسي" : "Competitive Analysis"}
                </h3>
                <RichValue value={modalSnapshot.data.analysis} dir={dir} />
              </div>
            )}

            {/* Gaps */}
            {Array.isArray(modalSnapshot.data?.gaps) && (modalSnapshot.data.gaps as unknown[]).length > 0 && (
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
                <h3 className="mb-4 font-headline text-lg font-bold text-on-surface flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  {dir === "rtl" ? "الفرص المكتشفة" : "Opportunities"}
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {(modalSnapshot.data.gaps as Array<Record<string, string>>).map((g, i) => (
                    <div key={i} className="brand-gradient-border rounded-xl bg-surface-container-lowest p-4">
                      <div className="insight-chip inline-flex items-center gap-1 mb-2">
                        <TrendingUp className="h-3 w-3" /> {dir === "rtl" ? `فرصة ${i + 1}` : `Opportunity ${i + 1}`}
                      </div>
                      <p className="font-headline text-sm font-bold text-on-surface">{g.opportunity}</p>
                      {g.rationale && <p className="mt-1 text-xs text-on-surface-variant">{g.rationale}</p>}
                      {g.action && (
                        <div className="mt-3 rounded-lg bg-primary/10 p-2 text-xs">
                          <span className="font-semibold text-primary">→ </span>
                          <span className="text-on-surface">{g.action}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw data fallback (if no analysis/gaps) */}
            {!modalSnapshot.data?.analysis && !Array.isArray(modalSnapshot.data?.gaps) && modalSnapshot.data && (
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
                <RichValue value={modalSnapshot.data} dir={dir} />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
