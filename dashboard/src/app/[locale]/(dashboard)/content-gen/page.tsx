"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import InsightChip from "@/components/InsightChip";
import { Textarea } from "@/components/FormField";
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

function StyledSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/30"
      >
        {children}
      </select>
    </label>
  );
}

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
    const tp = templates.find((x) => x.id === id);
    if (!tp) return;
    setForm((f) => ({
      ...f,
      brief: tp.brief_template || f.brief,
      target: (tp.type as Target) || f.target,
      channel: (tp.channel as Channel) || f.channel,
      language: (tp.language as Language) || f.language,
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

      <div className="p-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <PageHeader
            eyebrow="AI · CONTENT ENGINE"
            title={t("title")}
            description={t("subtitle")}
          />

          {error && (
            <Card padding="sm" className="flex items-center gap-3 !bg-error-container">
              <AlertCircle className="h-4 w-4 shrink-0 text-on-error-container" />
              <span className="text-sm font-medium text-on-error-container">{error}</span>
            </Card>
          )}

          {generating ? (
            <Card padding="lg" className="mx-auto max-w-2xl space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="brand-gradient-bg mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-soft">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
                <h3 className="font-headline text-xl font-bold tracking-tight text-on-surface">
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
                        "flex items-center gap-4 rounded-2xl bg-surface-container-lowest p-4 shadow-soft transition-all",
                        active && "ring-2 ring-primary/30"
                      )}
                    >
                      <div
                        className={clsx(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-headline text-sm font-bold",
                          done && "bg-emerald-100 text-emerald-600",
                          active && "brand-gradient-bg text-white",
                          !done && !active && "bg-surface-container-high text-on-surface-variant"
                        )}
                      >
                        {done ? (
                          <Check className="h-5 w-5" />
                        ) : active ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span className="font-headline text-sm font-bold text-on-surface">
                        {t(`steps.${key}`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : result ? (
            <Card padding="lg" className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <InsightChip>{t("result.title")}</InsightChip>
                  {result.title && (
                    <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
                      {result.title}
                    </h2>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopy}
                    leadingIcon={
                      copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {copied ? t("result.copied") : t("result.copy")}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => router.push(`/content/${result.content_item_id}`)}
                    leadingIcon={<Edit3 className="h-3.5 w-3.5" />}
                  >
                    {t("result.edit")}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-container-low p-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
                  {result.final}
                </p>
              </div>

              {result.hashtags && result.hashtags.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    {t("result.hashtags")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.hashtags.map((tag, i) => (
                      <InsightChip key={i}>
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </InsightChip>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleReset}
                  leadingIcon={<RefreshCw className="h-4 w-4" />}
                >
                  {t("result.regenerate")}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* Composer */}
              <Card padding="lg">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Textarea
                    label={t("form.brief")}
                    required
                    rows={6}
                    placeholder={t("form.briefPlaceholder")}
                    value={form.brief}
                    onChange={(e) => setForm((f) => ({ ...f, brief: e.target.value }))}
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <StyledSelect
                      label={t("form.target")}
                      value={form.target}
                      onChange={(v) => setForm((f) => ({ ...f, target: v as Target }))}
                    >
                      {TARGETS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(`form.${opt.labelKey}`)}
                        </option>
                      ))}
                    </StyledSelect>
                    <StyledSelect
                      label={t("form.channel")}
                      value={form.channel}
                      onChange={(v) => setForm((f) => ({ ...f, channel: v as Channel }))}
                    >
                      {CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </StyledSelect>
                    <StyledSelect
                      label={t("form.language")}
                      value={form.language}
                      onChange={(v) => setForm((f) => ({ ...f, language: v as Language }))}
                    >
                      <option value="ar">{t("form.languageAr")}</option>
                      <option value="en">{t("form.languageEn")}</option>
                      <option value="both">{t("form.languageBoth")}</option>
                    </StyledSelect>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="relative">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowTplMenu((v) => !v)}
                        leadingIcon={<FileText className="h-4 w-4" />}
                      >
                        {tpl("loadFromTemplate")}
                      </Button>
                      {showTplMenu && (
                        <div className="absolute bottom-full z-10 mb-2 max-h-56 w-64 overflow-y-auto rounded-2xl bg-surface-container-lowest p-2 shadow-soft">
                          {templates.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-on-surface-variant">
                              {tpl("empty")}
                            </div>
                          ) : (
                            templates.map((x) => (
                              <button
                                key={x.id}
                                type="button"
                                onClick={() => applyTemplate(x.id)}
                                className="block w-full rounded-lg px-3 py-2 text-start text-sm font-medium transition-colors hover:bg-surface-container-low"
                              >
                                {x.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      leadingIcon={<Sparkles className="h-4 w-4" />}
                    >
                      {t("form.submit")}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Preview panel */}
              <Card variant="flat" padding="lg" className="h-fit space-y-4">
                <InsightChip>PREVIEW</InsightChip>
                <h3 className="font-headline text-lg font-bold tracking-tight text-on-surface">
                  {t("subtitle")}
                </h3>
                <div className="space-y-3 text-xs font-medium text-on-surface-variant">
                  <div className="flex items-center justify-between">
                    <span className="font-headline uppercase tracking-widest">Channel</span>
                    <span>{form.channel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-headline uppercase tracking-widest">Format</span>
                    <span>{form.target}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-headline uppercase tracking-widest">Language</span>
                    <span>{form.language}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
