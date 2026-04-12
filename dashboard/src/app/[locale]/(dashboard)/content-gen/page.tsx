"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Loader2,
  Sparkles,
  Check,
  Copy,
  Edit3,
  RefreshCw,
  FileText,
} from "lucide-react";
import { clsx } from "clsx";

type Target = "post" | "blog" | "caption" | "ad_copy";
type Channel =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "blog"
  | "email";
type Language = "ar" | "en" | "both";

interface GenerateForm {
  brief: string;
  target: Target;
  channel: Channel;
  language: Language;
  brand_voice?: string;
}

interface GeneratedContent {
  content_item_id: string;
  draft: string;
  final: string;
  title?: string;
  hashtags?: string[];
  meta?: Record<string, unknown>;
}

const STEP_KEYS = ["brief", "draft", "refine", "hashtags", "finalize"] as const;

const TARGETS: { value: Target; labelKey: string }[] = [
  { value: "post", labelKey: "targetPost" },
  { value: "blog", labelKey: "targetBlog" },
  { value: "caption", labelKey: "targetCaption" },
  { value: "ad_copy", labelKey: "targetAdCopy" },
];

const CHANNELS: Channel[] = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin",
  "tiktok",
  "blog",
  "email",
];

export default function ContentGenPage() {
  const t = useTranslations("contentGen");
  const tpl = useTranslations("contentTemplates");
  const router = useRouter();

  const [form, setForm] = useState<GenerateForm>({
    brief: "",
    target: "post",
    channel: "instagram",
    language: "en",
  });
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      type: string;
      channel: string | null;
      language: string;
      brief_template: string | null;
    }>
  >([]);
  const [showTplMenu, setShowTplMenu] = useState(false);

  useEffect(() => {
    // Prefill from sessionStorage if user came from templates page
    try {
      const raw = sessionStorage.getItem("ignify:contentTemplate");
      if (raw) {
        const tpl = JSON.parse(raw);
        setForm((f) => ({
          ...f,
          brief: tpl.brief_template || f.brief,
          target: (tpl.type as Target) || f.target,
          channel: (tpl.channel as Channel) || f.channel,
          language: (tpl.language as Language) || f.language,
        }));
        sessionStorage.removeItem("ignify:contentTemplate");
      }
    } catch {
      // noop
    }
    (async () => {
      try {
        const data = await api.get<typeof templates>("/api/v1/content-templates");
        setTemplates(data);
      } catch {
        // noop
      }
    })();
  }, []);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setForm((f) => ({
      ...f,
      brief: t.brief_template || f.brief,
      target: (t.type as Target) || f.target,
      channel: (t.channel as Channel) || f.channel,
      language: (t.language as Language) || f.language,
    }));
    setShowTplMenu(false);
  }
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!generating) return;
    setActiveStep(0);
    const interval = setInterval(() => {
      setActiveStep((s) => (s < STEP_KEYS.length - 1 ? s + 1 : s));
    }, 1500);
    return () => clearInterval(interval);
  }, [generating]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.brief.trim()) return;
    try {
      setGenerating(true);
      setError(null);
      setResult(null);
      const res = await api.post<GeneratedContent>(
        "/api/v1/content-gen/generate",
        form
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.final);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-6 text-sm text-text-secondary">{t("subtitle")}</p>

          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {generating ? (
            <div className="rounded-xl border border-border bg-surface p-8">
              <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-4 rounded-full bg-primary/10 p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {t("form.generating")}
                </h3>
              </div>

              <div className="space-y-3">
                {STEP_KEYS.map((key, idx) => {
                  const done = idx < activeStep;
                  const active = idx === activeStep;
                  return (
                    <div
                      key={key}
                      className={clsx(
                        "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                        done && "border-success/30 bg-success/5 text-success",
                        active && "border-primary/30 bg-primary/5 text-primary",
                        !done &&
                          !active &&
                          "border-border bg-background text-text-muted"
                      )}
                    >
                      <div
                        className={clsx(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          done && "bg-success text-white",
                          active && "bg-primary text-white",
                          !done && !active && "bg-border text-text-muted"
                        )}
                      >
                        {done ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : active ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <span className="text-xs font-medium">{idx + 1}</span>
                        )}
                      </div>
                      <span className="font-medium">{t(`steps.${key}`)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : result ? (
            <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {t("result.title")}
                  </p>
                  {result.title && (
                    <h2 className="mt-1 text-xl font-semibold text-text-primary">
                      {result.title}
                    </h2>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? t("result.copied") : t("result.copy")}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/content/${result.content_item_id}`)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {t("result.edit")}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                  {result.final}
                </p>
              </div>

              {result.hashtags && result.hashtags.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {t("result.hashtags")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.hashtags.map((tag, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("result.regenerate")}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-xl border border-border bg-surface p-6"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  {t("form.brief")}
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder={t("form.briefPlaceholder")}
                  value={form.brief}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, brief: e.target.value }))
                  }
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("form.target")}
                  </label>
                  <select
                    value={form.target}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, target: e.target.value as Target }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {TARGETS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(`form.${opt.labelKey}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("form.channel")}
                  </label>
                  <select
                    value={form.channel}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, channel: e.target.value as Channel }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("form.language")}
                  </label>
                  <select
                    value={form.language}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        language: e.target.value as Language,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ar">{t("form.languageAr")}</option>
                    <option value="en">{t("form.languageEn")}</option>
                    <option value="both">{t("form.languageBoth")}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTplMenu((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                  >
                    <FileText className="h-4 w-4" />
                    {tpl("loadFromTemplate")}
                  </button>
                  {showTplMenu && (
                    <div className="absolute bottom-full z-10 mb-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                      {templates.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-text-muted">
                          {tpl("empty")}
                        </div>
                      ) : (
                        templates.map((x) => (
                          <button
                            key={x.id}
                            type="button"
                            onClick={() => applyTemplate(x.id)}
                            className="block w-full px-3 py-2 text-start text-sm hover:bg-surface-hover"
                          >
                            {x.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  <Sparkles className="h-4 w-4" />
                  {t("form.submit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
