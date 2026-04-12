"use client";

import { useState, KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { Loader2, X } from "lucide-react";

const TONES = ["professional", "friendly", "playful", "luxury", "bold", "educational"] as const;

export default function BrandVoicePage() {
  const t = useTranslations("onboarding");
  const router = useRouter();

  const [tone, setTone] = useState<string>("friendly");
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [wordInput, setWordInput] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState("#f59e0b");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addWord = () => {
    const v = wordInput.trim();
    if (v && !forbiddenWords.includes(v)) {
      setForbiddenWords((arr) => [...arr, v]);
    }
    setWordInput("");
  };

  const onWordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addWord();
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/v1/onboarding/brand-voice", {
        tone,
        forbidden_words: forbiddenWords,
        colors: { primary: primaryColor, secondary: secondaryColor },
        fonts: {},
        logo_url: logoUrl || null,
      });
      router.push("/onboarding/channels");
    } catch {
      setError(t("errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">{t("brand.title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("brand.subtitle")}</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("brand.tone")}</label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {TONES.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => setTone(v)}
              className={`rounded-md border px-3 py-2 text-sm ${
                tone === v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background"
              }`}
            >
              {t(`brand.toneOptions.${v}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("brand.forbiddenWords")}</label>
        <div className="rounded-md border border-border bg-background p-2">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {forbiddenWords.map((w) => (
              <span
                key={w}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                {w}
                <button
                  type="button"
                  onClick={() => setForbiddenWords((arr) => arr.filter((x) => x !== w))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            onKeyDown={onWordKey}
            onBlur={addWord}
            placeholder={t("brand.forbiddenWordsPlaceholder")}
            className="w-full bg-transparent px-1 py-1 text-sm outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("brand.colors")}</label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded"
            />
            <div className="flex-1">
              <div className="text-xs text-text-secondary">{t("brand.primaryColor")}</div>
              <input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded"
            />
            <div className="flex-1">
              <div className="text-xs text-text-secondary">{t("brand.secondaryColor")}</div>
              <input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("brand.logo")}</label>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder={t("brand.uploadLogo")}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => router.push("/onboarding/business")}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-hover"
        >
          {t("brand.previous")}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("brand.next")}
        </button>
      </div>
    </form>
  );
}
