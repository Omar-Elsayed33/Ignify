"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Loader2, Play, FileSearch, ArrowRight } from "lucide-react";

interface SEOAudit {
  id: string;
  audit_type: string;
  score: number | null;
  issues: unknown[] | null;
  recommendations: unknown[] | null;
  created_at: string;
}

export default function SeoAuditListPage() {
  const t = useTranslations("seoPage");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [keywords, setKeywords] = useState("");
  const [running, setRunning] = useState(false);
  const [audits, setAudits] = useState<SEOAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SEOAudit[]>("/api/v1/seo/audits")
      .then(setAudits)
      .catch(() => setAudits([]))
      .finally(() => setLoading(false));
  }, []);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const created = await api.post<SEOAudit>("/api/v1/seo/audit", {
        url: url.trim(),
        language,
        target_keywords: keywords
          .split(/[\n,]+/)
          .map((k) => k.trim())
          .filter(Boolean),
      });
      setAudits((prev) => [created, ...prev]);
      setUrl("");
      setKeywords("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <DashboardHeader title={t("auditTitle")} />
      <div className="p-6">
        <form onSubmit={run} className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("auditNewUrl")}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-text-secondary">URL</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/page"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "ar" | "en")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-text-secondary">{t("targetKeywords")}</label>
              <textarea
                rows={2}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="one per line or comma separated"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          {error && (
            <div className="mt-3 rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">{error}</div>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={running}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {t("runAudit")}
            </button>
          </div>
        </form>

        <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("recentAudits")}</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : audits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <FileSearch className="mx-auto mb-3 h-10 w-10 text-text-muted/40" />
            <p className="text-sm text-text-muted">No audits yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {audits.map((a) => (
              <Link
                key={a.id}
                href={`/seo/audit/${a.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 hover:shadow-md"
              >
                <div>
                  <p className="text-sm font-medium capitalize text-text-primary">{a.audit_type} audit</p>
                  <p className="text-xs text-text-muted">
                    {new Date(a.created_at).toLocaleString()} · score {a.score ?? "—"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-muted" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
