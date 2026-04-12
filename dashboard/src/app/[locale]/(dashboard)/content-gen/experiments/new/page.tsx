"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Loader2, Plus, Trash2, AlertCircle, Sparkles } from "lucide-react";

interface VariantInput {
  variant_label: string;
  model_override: string;
  prompt_override: string;
}

const MODEL_OPTIONS = [
  { value: "", label: "Default" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "claude-haiku-4", label: "Claude Haiku 4" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

export default function NewExperimentPage() {
  const t = useTranslations("experiments");
  const router = useRouter();

  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [target, setTarget] = useState("post");
  const [channel, setChannel] = useState("instagram");
  const [language, setLanguage] = useState("ar");
  const [variants, setVariants] = useState<VariantInput[]>([
    { variant_label: "A", model_override: "gpt-4o", prompt_override: "" },
    { variant_label: "B", model_override: "claude-sonnet-4", prompt_override: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addVariant() {
    if (variants.length >= 4) return;
    const label = String.fromCharCode(65 + variants.length);
    setVariants([...variants, { variant_label: label, model_override: "", prompt_override: "" }]);
  }

  function removeVariant(i: number) {
    if (variants.length <= 2) return;
    setVariants(variants.filter((_, idx) => idx !== i));
  }

  function updateVariant(i: number, patch: Partial<VariantInput>) {
    setVariants(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        brief,
        target,
        channel: channel || null,
        language,
        variants: variants.map((v) => ({
          variant_label: v.variant_label,
          model_override: v.model_override || null,
          prompt_override: v.prompt_override || null,
        })),
      };
      const created = await api.post<{ id: string }>("/api/v1/experiments", body);
      router.push(`/content-gen/experiments/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setSaving(false);
    }
  }

  const canSubmit = name.trim() && brief.trim() && variants.length >= 2 && !saving;

  return (
    <div>
      <DashboardHeader title={t("newTitle")} />
      <div className="mx-auto max-w-3xl p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
          <div>
            <label className="mb-1 block text-xs font-medium">{t("form.name")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t("form.brief")}</label>
            <textarea
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium">{t("form.target")}</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="post">post</option>
                <option value="caption">caption</option>
                <option value="blog">blog</option>
                <option value="ad_copy">ad_copy</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t("form.channel")}</label>
              <input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t("form.language")}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="ar">ar</option>
                <option value="en">en</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("form.variants")}</h3>
            <button
              onClick={addVariant}
              disabled={variants.length >= 4}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-hover disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              {t("form.addVariant")}
            </button>
          </div>
          <div className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    {t("form.variantLabel")} {v.variant_label}
                  </span>
                  {variants.length > 2 && (
                    <button
                      onClick={() => removeVariant(i)}
                      className="rounded p-1 text-text-muted hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("form.model")}</label>
                    <select
                      value={v.model_override}
                      onChange={(e) => updateVariant(i, { model_override: e.target.value })}
                      className="w-full rounded-md border border-border bg-surface px-2 py-2 text-xs"
                    >
                      {MODEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("form.promptHint")}</label>
                    <input
                      value={v.prompt_override}
                      onChange={(e) => updateVariant(i, { prompt_override: e.target.value })}
                      placeholder={t("form.promptPlaceholder")}
                      className="w-full rounded-md border border-border bg-surface px-2 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => router.push("/content-gen/experiments")}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            {t("form.cancel")}
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("form.generate")}
          </button>
        </div>
      </div>
    </div>
  );
}
