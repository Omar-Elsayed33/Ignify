"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Loader2, Plus } from "lucide-react";

export default function NewKeywordsPage() {
  const t = useTranslations("seoPage");
  const router = useRouter();
  const [text, setText] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [location, setLocation] = useState("Egypt");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const keywords = text.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
    if (keywords.length === 0) {
      setError("Please add at least one keyword.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/v1/seo/keywords/bulk", {
        keywords,
        target_url: targetUrl.trim() || null,
        location,
        language,
      });
      router.push("/seo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add keywords");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <DashboardHeader title={t("addKeywords")} />
      <div className="p-6">
        <form onSubmit={submit} className="max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-text-secondary">
            {t("keywordsBulkLabel")}
          </label>
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"ai marketing\ncontent automation\nseo tools"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Target URL</label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://your-site.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
          </div>

          {error && <div className="mt-4 rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">{error}</div>}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/seo")}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("addKeywords")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
