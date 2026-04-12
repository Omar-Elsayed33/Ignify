"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Loader2,
  Sparkles,
  Check,
  Download,
  Video as VideoIcon,
  Info,
} from "lucide-react";
import { clsx } from "clsx";

type Duration = 15 | 30 | 60;
type VideoType = "ad" | "educational" | "entertainment";
type AspectRatio = "9:16" | "1:1" | "16:9";
type Language = "ar" | "en" | "both";

interface Scene {
  visual_prompt: string;
  text_overlay: string;
  duration_seconds: number;
}

interface GenerateForm {
  idea: string;
  duration_seconds: Duration;
  video_type: VideoType;
  aspect_ratio: AspectRatio;
  language: Language;
}

interface GenerateResponse {
  asset_id: string | null;
  script: string | null;
  scenes: Scene[];
  video_url: string | null;
  voice_url: string | null;
  subtitle_url: string | null;
  meta: Record<string, unknown>;
}

interface QueuedResponse {
  run_id: string;
  status: string;
  poll_url: string;
}

interface RunStatusResponse {
  run_id: string;
  status: "pending" | "running" | "succeeded" | "failed" | string;
  error: string | null;
  asset_id: string | null;
  script: string | null;
  scenes: Scene[];
  video_url: string | null;
  voice_url: string | null;
  subtitle_url: string | null;
  meta: Record<string, unknown>;
}

const STEP_KEYS = [
  "script",
  "scenes",
  "voiceSelect",
  "voiceRender",
  "videoRender",
  "captions",
] as const;

export default function VideoGeneratePage() {
  const t = useTranslations("videoGen");

  const [form, setForm] = useState<GenerateForm>({
    idea: "",
    duration_seconds: 30,
    video_type: "ad",
    aspect_ratio: "9:16",
    language: "en",
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!generating) return;
    setActiveStep(0);
    const interval = setInterval(() => {
      setActiveStep((s) => (s < STEP_KEYS.length - 1 ? s + 1 : s));
    }, 2200);
    return () => clearInterval(interval);
  }, [generating]);

  // Elapsed timer while rendering
  useEffect(() => {
    if (!generating) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [generating]);

  // Poll run status every 3s while we have a runId and are still generating.
  useEffect(() => {
    if (!runId || !generating) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await api.get<RunStatusResponse>(
          `/api/v1/video-gen/runs/${runId}`
        );
        if (cancelled) return;
        if (status.status === "succeeded") {
          setResult({
            asset_id: status.asset_id,
            script: status.script,
            scenes: status.scenes || [],
            video_url: status.video_url,
            voice_url: status.voice_url,
            subtitle_url: status.subtitle_url,
            meta: status.meta || {},
          });
          setGenerating(false);
          setRunId(null);
        } else if (status.status === "failed") {
          setError(status.error || t("errors.failed"));
          setGenerating(false);
          setRunId(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errors.failed"));
          setGenerating(false);
          setRunId(null);
        }
      }
    };
    const interval = setInterval(poll, 3000);
    poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [runId, generating, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.idea.trim()) return;
    try {
      setGenerating(true);
      setError(null);
      setResult(null);
      const res = await api.post<QueuedResponse>(
        "/api/v1/video-gen/generate",
        {
          idea: form.idea,
          duration_seconds: form.duration_seconds,
          language: form.language,
          video_type: form.video_type,
          aspect_ratio: form.aspect_ratio,
        }
      );
      setRunId(res.run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failed"));
      setGenerating(false);
    }
  }

  function handleRegenerate() {
    setResult(null);
    setError(null);
  }

  async function handleDownload(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `video-${Date.now()}.mp4`;
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
                  {t("form.generating")} — {elapsed}s
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
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary">
                    {t("title")}
                  </h3>
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t("result.regenerate")}
                  </button>
                </div>

                {!result.video_url ? (
                  <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>{t("result.stub")}</span>
                  </div>
                ) : (
                  <div className="mb-4 overflow-hidden rounded-lg border border-border bg-black">
                    <video
                      src={result.video_url}
                      controls
                      className="h-auto w-full"
                    />
                  </div>
                )}

                {result.voice_url && (
                  <div className="mb-4">
                    <audio
                      src={result.voice_url}
                      controls
                      className="w-full"
                    />
                  </div>
                )}

                {result.video_url && (
                  <div className="mb-4 flex justify-end">
                    <button
                      onClick={() => handleDownload(result.video_url as string)}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                    >
                      <Download className="h-4 w-4" />
                      {t("result.download")}
                    </button>
                  </div>
                )}
              </div>

              {result.script && (
                <div className="rounded-xl border border-border bg-surface p-6">
                  <h4 className="mb-2 text-sm font-semibold text-text-primary">
                    {t("result.script")}
                  </h4>
                  <p className="whitespace-pre-wrap rounded-lg bg-background px-3 py-2 text-sm text-text-secondary">
                    {result.script}
                  </p>
                </div>
              )}

              {result.scenes && result.scenes.length > 0 && (
                <div className="rounded-xl border border-border bg-surface p-6">
                  <h4 className="mb-3 text-sm font-semibold text-text-primary">
                    {t("result.scenes")}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase text-text-muted">
                          <th className="py-2 pe-3">#</th>
                          <th className="py-2 pe-3">Visual prompt</th>
                          <th className="py-2 pe-3">Overlay</th>
                          <th className="py-2">Seconds</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.scenes.map((s, i) => (
                          <tr
                            key={i}
                            className="border-b border-border/50 align-top"
                          >
                            <td className="py-2 pe-3 text-text-muted">
                              {i + 1}
                            </td>
                            <td className="py-2 pe-3 text-text-primary">
                              {s.visual_prompt}
                            </td>
                            <td className="py-2 pe-3 text-text-secondary">
                              {s.text_overlay}
                            </td>
                            <td className="py-2 text-text-secondary">
                              {s.duration_seconds}s
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, idea: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("form.duration")}
                  </label>
                  <select
                    value={form.duration_seconds}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        duration_seconds: Number(e.target.value) as Duration,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={15}>{t("form.dur15")}</option>
                    <option value={30}>{t("form.dur30")}</option>
                    <option value={60}>{t("form.dur60")}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("form.videoType")}
                  </label>
                  <select
                    value={form.video_type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        video_type: e.target.value as VideoType,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ad">{t("form.typeAd")}</option>
                    <option value="educational">
                      {t("form.typeEducational")}
                    </option>
                    <option value="entertainment">
                      {t("form.typeEntertainment")}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("form.aspectRatio")}
                  </label>
                  <select
                    value={form.aspect_ratio}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        aspect_ratio: e.target.value as AspectRatio,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="9:16">{t("form.ratio_9_16")}</option>
                    <option value="1:1">{t("form.ratio_1_1")}</option>
                    <option value="16:9">{t("form.ratio_16_9")}</option>
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
                    <option value="ar">Arabic</option>
                    <option value="en">English</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  <VideoIcon className="h-4 w-4" />
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
