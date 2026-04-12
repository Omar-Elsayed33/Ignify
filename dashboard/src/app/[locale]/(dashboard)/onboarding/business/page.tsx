"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { Loader2, Plus, X } from "lucide-react";

const INDUSTRIES = ["ecommerce", "restaurant", "clinic", "real_estate", "services", "saas", "other"] as const;
const COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "other"] as const;
const LANGS = ["ar", "en", "both"] as const;

export default function BusinessProfilePage() {
  const t = useTranslations("onboarding");
  const router = useRouter();

  const [industry, setIndustry] = useState<string>("ecommerce");
  const [country, setCountry] = useState<string>("EG");
  const [primaryLanguage, setPrimaryLanguage] = useState<string>("ar");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [products, setProducts] = useState<string[]>([""]);
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    i: number,
    v: string
  ) => setter((arr) => arr.map((x, idx) => (idx === i ? v : x)));

  const addItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter((arr) => [...arr, ""]);

  const removeItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
    setter((arr) => arr.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/v1/onboarding/business-profile", {
        industry,
        country,
        primary_language: primaryLanguage,
        description,
        target_audience: targetAudience,
        products: products.map((p) => p.trim()).filter(Boolean),
        competitors: competitors.map((c) => c.trim()).filter(Boolean),
      });
      router.push("/onboarding/brand");
    } catch {
      setError(t("errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">{t("business.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("business.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("business.industry")}</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {t(`business.industryOptions.${i}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("business.country")}</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {t(`business.countryOptions.${c}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("business.primaryLanguage")}</label>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setPrimaryLanguage(l)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                primaryLanguage === l
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("business.description")}</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("business.descriptionPlaceholder")}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("business.audience")}</label>
        <textarea
          rows={2}
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          placeholder={t("business.audiencePlaceholder")}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("business.products")}</label>
        <div className="space-y-2">
          {products.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={p}
                onChange={(e) => updateList(setProducts, i, e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              {products.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(setProducts, i)}
                  className="rounded-md border border-border p-2 text-text-secondary hover:bg-surface-hover"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addItem(setProducts)}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> {t("business.addProduct")}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("business.competitors")}</label>
        <div className="space-y-2">
          {competitors.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={c}
                onChange={(e) => updateList(setCompetitors, i, e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              {competitors.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(setCompetitors, i)}
                  className="rounded-md border border-border p-2 text-text-secondary hover:bg-surface-hover"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addItem(setCompetitors)}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> {t("business.addCompetitor")}
          </button>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("business.next")}
        </button>
      </div>
    </form>
  );
}
