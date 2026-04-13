"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import InsightChip from "@/components/InsightChip";
import { Textarea } from "@/components/FormField";
import { api } from "@/lib/api";
import { AlertCircle, Loader2, Sparkles, Check, Download, ImagePlus, Link2, FileText } from "lucide-react";
import { clsx } from "clsx";

type Style = "photo" | "illustration" | "3d" | "minimal" | "anime";
type Dimension = "1:1" | "9:16" | "16:9" | "4:5";
type Language = "ar" | "en" | "both";

interface GenerateForm {
  idea: string;
  style: Style;
  dimensions: Dimension;
  language: Language;
}

interface GenerateResponse {
  creative_id: string | null;
  prompt: string | null;
  image_urls: string[];
  assets: { creative_id: string; file_url: string }[];
  meta: Record<string, unknown>;
}

const STEP_KEYS = ["prompt", "brand", "render"] as const;

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

export default function CreativeGeneratePage() {
  const t = useTranslations("creativeGen");
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan_id");
  const [planTitle, setPlanTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    api
      .get<{ title: string }>(`/api/v1/plans/${planId}`)
      .then((p) => setPlanTitle(p.title))
      .catch(() => setPlanTitle(null));
  }, [planId]);

  const [form, setForm] = useState<GenerateForm>({
    idea: "",
    style: "photo",
    dimensions: "1:1",
    language: "en",
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [draftPosts, setDraftPosts] = useState<{ id: string; title: string; status: string }[]>([]);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [attachDone, setAttachDone] = useState<string | null>(null);

  async function openAttach() {
    setAttachOpen(true);
    if (draftPosts.length === 0) {
      try {
        const posts = await api.get<{ id: string; title: string; status: string }[]>(
          "/api/v1/content/posts?limit=20"
        );
        setDraftPosts(posts.filter((p) => p.status === "draft"));
      } catch {
        setDraftPosts([]);
      }
    }
  }

  async function attachToPost(postId: string) {
    if (!result?.creative_id) return;
    setAttachingId(postId);
    try {
      await api.post(`/api/v1/content/${postId}/attach-creative`, {
        creative_id: result.creative_id,
      });
      setAttachDone(postId);
    } catch {
      // noop
    } finally {
      setAttachingId(null);
    }
  }

  useEffect(() => {
    if (!generating) return;
    setActiveStep(0);
    const interval = setInterval(() => {
      setActiveStep((s) => (s < STEP_KEYS.length - 1 ? s + 1 : s));
    }, 1600);
    return () => clearInterval(interval);
  }, [generating]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.idea.trim()) return;
    try {
      setGenerating(true);
      setError(null);
      setResult(null);
      const res = await api.post<GenerateResponse>("/api/v1/creative-gen/generate", {
        idea: form.idea,
        style: form.style,
        dimensions: form.dimensions,
        language: form.language,
        plan_id: planId || undefined,
      });
      setResult(res);
      if ((res.image_urls?.length ?? 0) === 0) {
        const err = (res.meta as { error?: string } | null)?.error;
        if (err && err.includes("no replicate token")) {
          setError(t("errors.noToken"));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setGenerating(false);
    }
  }

  function handleRegenerate() {
    setResult(null);
    setSelected(null);
    setError(null);
  }

  async function handleDownload(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `creative-${Date.now()}.webp`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <PageHeader
            eyebrow="AI · CREATIVE ENGINE"
            title={t("title")}
            description={t("subtitle")}
          />

          {planId && (
            <Card padding="sm" className="flex items-center gap-2 !bg-emerald-50">
              <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                {planTitle
                  ? `مرتبط بالخطة: ${planTitle} — الصور ستتماشى مع هوية العلامة والتموضع من الخطة.`
                  : "مرتبط بالخطة — يتم تحميل التفاصيل..."}
              </span>
            </Card>
          )}

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
                <p className="mt-1 text-sm text-on-surface-variant">{form.idea}</p>
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
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <InsightChip>RENDERED</InsightChip>
                  <h3 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                    {t("result.title")}
                  </h3>
                </div>
                <div className="flex gap-2">
                  {result.creative_id && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={openAttach}
                      leadingIcon={<Link2 className="h-4 w-4" />}
                    >
                      Attach to Content
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRegenerate}
                    leadingIcon={<Sparkles className="h-4 w-4" />}
                  >
                    {t("result.regenerate")}
                  </Button>
                </div>
              </div>

              {attachOpen && (
                <Card variant="flat" padding="md" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Choose a draft content post
                    </span>
                    <button
                      onClick={() => setAttachOpen(false)}
                      className="text-xs font-semibold text-on-surface-variant hover:text-primary"
                    >
                      Close
                    </button>
                  </div>
                  {draftPosts.length === 0 ? (
                    <p className="text-xs text-on-surface-variant">No draft posts.</p>
                  ) : (
                    <div className="max-h-40 space-y-1 overflow-auto">
                      {draftPosts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => attachToPost(p.id)}
                          disabled={attachingId === p.id}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-xs font-medium hover:bg-surface-container-lowest disabled:opacity-40"
                        >
                          <span className="truncate">{p.title}</span>
                          {attachingId === p.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : attachDone === p.id ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {result.prompt && (
                <div className="rounded-xl bg-surface-container-low p-4">
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    {result.prompt}
                  </p>
                </div>
              )}

              {result.image_urls.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container-low p-12 text-center">
                  <ImagePlus className="mb-3 h-10 w-10 text-on-surface-variant" />
                  <p className="text-sm text-on-surface-variant">{t("errors.noToken")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {result.image_urls.map((url, idx) => {
                    const isSelected = selected === url;
                    return (
                      <div
                        key={`${url}-${idx}`}
                        className={clsx(
                          "group relative overflow-hidden rounded-2xl shadow-soft transition-all",
                          isSelected && "ring-2 ring-primary"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`variation ${idx + 1}`} className="h-auto w-full" />
                        <div className="brand-gradient-bg absolute inset-x-0 bottom-0 flex gap-2 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => handleDownload(url)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-on-surface hover:bg-white"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t("result.download")}
                          </button>
                          <button
                            onClick={() => setSelected(url)}
                            className={clsx(
                              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold",
                              isSelected
                                ? "bg-white text-primary"
                                : "bg-black/20 text-white hover:bg-black/30"
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {t("result.select")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              {/* Form */}
              <Card padding="lg">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <Textarea
                    label={t("form.idea")}
                    required
                    rows={5}
                    placeholder={t("form.ideaPlaceholder")}
                    value={form.idea}
                    onChange={(e) => setForm((f) => ({ ...f, idea: e.target.value }))}
                  />
                  <StyledSelect
                    label={t("form.style")}
                    value={form.style}
                    onChange={(v) => setForm((f) => ({ ...f, style: v as Style }))}
                  >
                    <option value="photo">{t("form.stylePhoto")}</option>
                    <option value="illustration">{t("form.styleIllustration")}</option>
                    <option value="3d">{t("form.style3d")}</option>
                    <option value="minimal">{t("form.styleMinimal")}</option>
                    <option value="anime">{t("form.styleAnime")}</option>
                  </StyledSelect>
                  <StyledSelect
                    label={t("form.dimensions")}
                    value={form.dimensions}
                    onChange={(v) => setForm((f) => ({ ...f, dimensions: v as Dimension }))}
                  >
                    <option value="1:1">{t("form.dim_1_1")}</option>
                    <option value="9:16">{t("form.dim_9_16")}</option>
                    <option value="16:9">{t("form.dim_16_9")}</option>
                    <option value="4:5">{t("form.dim_4_5")}</option>
                  </StyledSelect>
                  <StyledSelect
                    label={t("form.language")}
                    value={form.language}
                    onChange={(v) => setForm((f) => ({ ...f, language: v as Language }))}
                  >
                    <option value="ar">Arabic</option>
                    <option value="en">English</option>
                    <option value="both">Both</option>
                  </StyledSelect>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    leadingIcon={<Sparkles className="h-4 w-4" />}
                  >
                    {t("form.submit")}
                  </Button>
                </form>
              </Card>

              {/* Gallery placeholder */}
              <Card variant="flat" padding="lg" className="flex min-h-[400px] flex-col items-center justify-center space-y-3 text-center">
                <InsightChip>GALLERY</InsightChip>
                <ImagePlus className="h-12 w-12 text-on-surface-variant" />
                <p className="max-w-xs text-sm font-medium text-on-surface-variant">
                  Describe your creative idea on the left. Generated variations appear here.
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
