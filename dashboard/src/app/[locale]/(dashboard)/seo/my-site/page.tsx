"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { api } from "@/lib/api";
import { Loader2, Globe, AlertCircle, CheckCircle2, Lightbulb } from "lucide-react";
import AIAssistButton from "@/components/AIAssistButton";

interface AuditIssue {
  severity?: string;
  category?: string;
  title?: string;
  description?: string;
}
interface AuditRec {
  priority?: string;
  category?: string;
  title?: string;
  description?: string | unknown;
  impact?: string;
}
interface AuditResponse {
  id?: string;
  score?: number | null;
  issues?: AuditIssue[];
  recommendations?: AuditRec[];
  created_at?: string;
}

export default function MySiteSEOPage() {
  const t = useTranslations("seoAudit");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"ar" | "en">("en");

  // Pre-fill from tenant onboarding status
  useEffect(() => {
    (async () => {
      try {
        const s = await api.get<{ business_profile?: { website?: string } }>(
          "/api/v1/onboarding/status"
        );
        const w = s?.business_profile?.website;
        if (w) setUrl(w);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const runAudit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.post<AuditResponse>("/api/v1/seo/audit", {
        url,
        language: lang,
        target_keywords: [],
      });
      setAudit(r);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  const score = audit?.score ?? null;
  const scoreColor =
    score == null
      ? "#9a7b6a"
      : score >= 80
      ? "#10b981"
      : score >= 50
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <div className="rounded-xl border border-border bg-surface-container-lowest p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <Globe className="h-3.5 w-3.5" />
              {t("websiteUrl")}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourbusiness.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "ar" | "en")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="en">EN</option>
            <option value="ar">AR</option>
          </select>
          <AIAssistButton
            onClick={runAudit}
            loading={loading}
            disabled={!url.trim()}
            label={audit ? t("reAudit") : t("runAudit")}
            loadingLabel={t("running")}
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
      </div>

      {audit && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Score gauge */}
          <div className="rounded-xl border border-border bg-surface-container-lowest p-6 text-center lg:col-span-1">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              {t("overallScore")}
            </div>
            <div className="relative mx-auto h-40 w-40">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${((score ?? 0) / 100) * 264} 264`}
                />
              </svg>
              <div
                className="absolute inset-0 flex items-center justify-center text-4xl font-bold"
                style={{ color: scoreColor }}
              >
                {score ?? "—"}
              </div>
            </div>
            <p className="mt-3 text-xs text-on-surface-variant">
              {(audit.issues || []).length} {t("issuesCount")} •{" "}
              {(audit.recommendations || []).length} {t("recsCount")}
            </p>
          </div>

          {/* Issues */}
          <div className="rounded-xl border border-border bg-surface-container-lowest p-5 lg:col-span-2">
            <h2 className="mb-3 flex items-center gap-2 font-headline text-base font-semibold">
              <AlertCircle className="h-4 w-4 text-red-500" />
              {t("issues")}
            </h2>
            <ul className="space-y-3">
              {(audit.issues || []).slice(0, 15).map((is: Record<string, unknown>, i: number) => {
                const sev = (is.severity as string) || "info";
                const label = (isAr ? is.label_ar : is.label_en) || (is.title as string) || "";
                const fix = (isAr ? is.fix_ar : is.fix_en) || (is.description as string) || "";
                const current = is.current;
                const extra = (is.extra || {}) as Record<string, unknown>;
                return (
                  <li key={i} className="rounded-md border border-border bg-background p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          sev === "high"
                            ? "bg-red-500/10 text-red-500"
                            : sev === "medium"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-sky-500/10 text-sky-500"
                        }`}
                      >{sev}</span>
                      <span className="text-xs text-on-surface-variant">{(is.code as string) || ""}</span>
                    </div>
                    <div className="mt-1 font-medium">{label}</div>
                    {fix && <div className="mt-1 text-xs text-on-surface-variant">{fix}</div>}
                    {current != null && current !== "" && (
                      <div className="mt-2 rounded bg-surface-container-low p-2 text-xs">
                        <span className="font-semibold text-on-surface-variant me-1">{isAr ? "القيمة الحالية:" : "Current:"}</span>
                        <span className="text-on-surface">{typeof current === "string" ? current : JSON.stringify(current)}</span>
                        {typeof extra.length === "number" && <span className="ms-2 text-on-surface-variant">({extra.length} {isAr ? "حرف" : "chars"})</span>}
                      </div>
                    )}
                  </li>
                );
              })}
              {(!audit.issues || audit.issues.length === 0) && (
                <li className="text-sm text-on-surface-variant">
                  <CheckCircle2 className="me-1 inline h-4 w-4 text-green-500" />
                  {t("noIssues")}
                </li>
              )}
            </ul>
            {audit.suggested_title && audit.title && (
              <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <div className="font-semibold text-primary mb-1">{isAr ? "اقتراح عنوان محسّن" : "Suggested improved title"}</div>
                <div className="text-xs text-on-surface-variant">{isAr ? "الحالي" : "Current"}: {audit.title as string}</div>
                <div className="text-xs text-on-surface mt-1">{isAr ? "المقترح" : "Suggested"}: <span className="font-medium">{audit.suggested_title as string}</span></div>
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border border-border bg-surface-container-lowest p-5 lg:col-span-3">
            <h2 className="mb-3 flex items-center gap-2 font-headline text-base font-semibold">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              {t("recommendations")}
            </h2>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(audit.recommendations || []).slice(0, 20).map((r: Record<string, unknown>, i: number) => {
                const safeText = (v: unknown): string => {
                  if (v == null) return "";
                  if (typeof v === "string") return v;
                  if (typeof v === "number" || typeof v === "boolean") return String(v);
                  if (Array.isArray(v)) return v.map(safeText).filter(Boolean).join("، ");
                  if (typeof v === "object") {
                    return Object.entries(v as Record<string, unknown>)
                      .map(([k, val]) => `${k.replace(/_/g, " ")}: ${safeText(val)}`)
                      .join(" · ");
                  }
                  return String(v);
                };
                const title = safeText(r.title);
                const description = safeText(r.description);
                const impact = safeText(r.impact);
                const priority = safeText(r.priority);
                const category = safeText(r.category);
                return (
                  <li key={i} className="rounded-md border border-border bg-background p-3 text-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                      {priority}{priority && category ? " • " : ""}{category}
                    </div>
                    {title && <div className="mt-1 font-medium" dir={isAr ? "rtl" : "ltr"}>{title}</div>}
                    {description && (
                      <div className="mt-1 text-xs text-on-surface-variant" dir={isAr ? "rtl" : "ltr"}>
                        {description}
                      </div>
                    )}
                    {impact && (
                      <div className="mt-2 text-xs italic text-on-surface-variant" dir={isAr ? "rtl" : "ltr"}>
                        {impact}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
