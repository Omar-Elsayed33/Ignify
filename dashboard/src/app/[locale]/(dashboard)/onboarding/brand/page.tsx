"use client";

import { useRef, useState, KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { Loader2, Upload, X } from "lucide-react";
import AIAssistButton from "@/components/AIAssistButton";
import OnboardingProgress from "@/components/OnboardingProgress";

const TONES = ["professional", "friendly", "playful", "luxury", "bold", "educational"] as const;

export default function BrandVoicePage() {
  const t = useTranslations("onboarding");
  const tAI = useTranslations("aiAssist");
  const router = useRouter();

  const [tone, setTone] = useState<string>("friendly");
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [wordInput, setWordInput] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState("#f59e0b");
  const [accentColor, setAccentColor] = useState("#10b981");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onFilePick = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<{ url: string }>("/api/v1/media/upload", fd);
      if (res?.url) {
        setLogoUrl(res.url);
        // Auto-extract colors
        setExtracting(true);
        try {
          const colors = await api.post<{
            primary_color?: string;
            secondary_color?: string;
            accent_color?: string;
          }>("/api/v1/ai-assistant/analyze-logo", { logo_url: res.url });
          if (colors?.primary_color) setPrimaryColor(colors.primary_color);
          if (colors?.secondary_color) setSecondaryColor(colors.secondary_color);
          if (colors?.accent_color) setAccentColor(colors.accent_color);
        } catch {
          /* non-fatal */
        } finally {
          setExtracting(false);
        }
      }
    } catch {
      setError(t("errors.failed"));
    } finally {
      setUploading(false);
    }
  };

  const extractFromUrl = async () => {
    if (!logoUrl) return;
    setExtracting(true);
    try {
      const colors = await api.post<{
        primary_color?: string;
        secondary_color?: string;
        accent_color?: string;
      }>("/api/v1/ai-assistant/analyze-logo", { logo_url: logoUrl });
      if (colors?.primary_color) setPrimaryColor(colors.primary_color);
      if (colors?.secondary_color) setSecondaryColor(colors.secondary_color);
      if (colors?.accent_color) setAccentColor(colors.accent_color);
    } catch {
      /* non-fatal */
    } finally {
      setExtracting(false);
    }
  };

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
        colors: { primary: primaryColor, secondary: secondaryColor, accent: accentColor },
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
      <OnboardingProgress current="brand" />
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
          <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded"
            />
            <div className="flex-1">
              <div className="text-xs text-text-secondary">{tAI("accentColor")}</div>
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">{t("brand.logo")}</label>
        <div className="space-y-2">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void onFilePick(f);
            }}
            className="flex cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed border-border bg-background px-4 py-6 text-sm text-text-secondary hover:bg-surface-hover"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : logoUrl ? (
              <img
                src={logoUrl}
                alt="logo"
                className="h-12 w-12 rounded-md object-contain"
              />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span>
              {uploading
                ? tAI("uploadLogo.processing")
                : logoUrl
                ? tAI("uploadLogo.replace")
                : tAI("uploadLogo.dragHere")}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFilePick(f);
            }}
          />
          <div className="flex gap-2">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder={t("brand.uploadLogo")}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {logoUrl && (
              <AIAssistButton
                onClick={extractFromUrl}
                loading={extracting}
                label={tAI("extractLogo.button")}
                loadingLabel={tAI("extractLogo.analyzing")}
                size="sm"
                variant="ghost"
              />
            )}
          </div>
        </div>
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
