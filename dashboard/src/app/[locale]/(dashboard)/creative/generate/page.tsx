"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { AlertCircle, Loader2, Sparkles, Check, Download, ImagePlus, Link2 } from "lucide-react";
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

export default function CreativeGeneratePage() {
  const t = useTranslations("creativeGen");

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

      <div className="p-6">
        <div className="mx-auto max-w-4xl">
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
                <p className="mt-1 text-sm text-text-secondary">{form.idea}</p>
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
                        !done && !active && "border-border bg-background text-text-muted"
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
            <div className="rounded-xl border border-border bg-surface p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">
                  {t("result.title")}
                </h3>
                <div className="flex gap-2">
                  {result.creative_id && (
                    <button
                      onClick={openAttach}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                    >
                      <Link2 className="h-4 w-4" />
                      Attach to Content
                    </button>
                  )}
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t("result.regenerate")}
                  </button>
                </div>
              </div>

              {attachOpen && (
                <div className="mb-4 rounded-lg border border-border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-text-secondary">
                      Choose a draft content post:
                    </span>
                    <button
                      onClick={() => setAttachOpen(false)}
                      className="text-xs text-text-muted hover:text-text-primary"
                    >
                      Close
                    </button>
                  </div>
                  {draftPosts.length === 0 ? (
                    <p className="text-xs text-text-muted">No draft posts.</p>
                  ) : (
                    <div className="max-h-40 space-y-1 overflow-auto">
                      {draftPosts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => attachToPost(p.id)}
                          disabled={attachingId === p.id}
                          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-surface disabled:opacity-40"
                        >
                          <span className="truncate">{p.title}</span>
                          {attachingId === p.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : attachDone === p.id ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {result.prompt && (
                <p className="mb-4 rounded-lg bg-background px-3 py-2 text-xs text-text-muted">
                  {result.prompt}
                </p>
              )}

              {result.image_urls.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background p-10 text-center">
                  <ImagePlus className="mb-3 h-10 w-10 text-text-muted" />
                  <p className="text-sm text-text-secondary">
                    {t("errors.noToken")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {result.image_urls.map((url, idx) => {
                    const isSelected = selected === url;
                    return (
                      <div
                        key={`${url}-${idx}`}
                        className={clsx(
                          "group relative overflow-hidden rounded-lg border transition-all",
                          isSelected
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`variation ${idx + 1}`}
                          className="h-auto w-full"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => handleDownload(url)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-white"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {t("result.download")}
                          </button>
                          <button
                            onClick={() => setSelected(url)}
                            className={clsx(
                              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                              isSelected
                                ? "bg-primary text-white"
                                : "bg-primary/90 text-white hover:bg-primary"
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
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-xl border border-border bg-surface p-6"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  {t("form.idea")}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={t("form.ideaPlaceholder")}
                  value={form.idea}
                  onChange={(e) => setForm((f) => ({ ...f, idea: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("form.style")}
                  </label>
                  <select
                    value={form.style}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, style: e.target.value as Style }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="photo">{t("form.stylePhoto")}</option>
                    <option value="illustration">{t("form.styleIllustration")}</option>
                    <option value="3d">{t("form.style3d")}</option>
                    <option value="minimal">{t("form.styleMinimal")}</option>
                    <option value="anime">{t("form.styleAnime")}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("form.dimensions")}
                  </label>
                  <select
                    value={form.dimensions}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dimensions: e.target.value as Dimension,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="1:1">{t("form.dim_1_1")}</option>
                    <option value="9:16">{t("form.dim_9_16")}</option>
                    <option value="16:9">{t("form.dim_16_9")}</option>
                    <option value="4:5">{t("form.dim_4_5")}</option>
                  </select>
                </div>
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
                  <option value="ar">Arabic</option>
                  <option value="en">English</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div className="flex justify-end pt-2">
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
