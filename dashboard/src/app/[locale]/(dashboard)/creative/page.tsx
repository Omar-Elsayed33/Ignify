"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import {
  Sparkles,
  Upload,
  Image,
  LayoutGrid,
  Stamp,
  Box,
  Download,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { clsx } from "clsx";

// ── Types matching backend snake_case responses ──

interface CreativeAsset {
  id: string;
  tenant_id: string;
  name: string;
  asset_type: string;
  file_url: string | null;
  thumbnail_url: string | null;
  prompt_used: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Must match backend AssetType enum
const ASSET_TYPES = ["image", "banner", "logo", "mockup", "video", "audio"] as const;
type AssetTypeValue = (typeof ASSET_TYPES)[number];

const typeIcons: Record<string, React.ElementType> = {
  image: Image,
  banner: LayoutGrid,
  logo: Stamp,
  mockup: Box,
  video: LayoutGrid,
  audio: Box,
};

export default function CreativePage() {
  const t = useTranslations("creativePage");

  // ── State ──
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    asset_type: "image" as AssetTypeValue,
    file_url: "",
    thumbnail_url: "",
  });

  // AI Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateForm, setGenerateForm] = useState({
    prompt: "",
    name: "",
    asset_type: "image" as AssetTypeValue,
    width: "1024",
    height: "1024",
    style: "",
  });

  // ── Fetch assets ──
  useEffect(() => {
    setLoading(true);
    api
      .get<CreativeAsset[]>("/api/v1/creative/assets")
      .then(setAssets)
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Filter assets client-side ──
  const filtered =
    filter === "all" ? assets : assets.filter((a) => a.asset_type === filter);

  // ── Upload asset ──
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.name.trim() || !uploadForm.file_url.trim()) {
      setUploadError("Name and file URL are required.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const payload = {
        name: uploadForm.name.trim(),
        asset_type: uploadForm.asset_type,
        file_url: uploadForm.file_url.trim(),
        thumbnail_url: uploadForm.thumbnail_url.trim() || null,
      };
      const created = await api.post<CreativeAsset>("/api/v1/creative/assets", payload);
      setAssets((prev) => [created, ...prev]);
      setShowUpload(false);
      setUploadForm({ name: "", asset_type: "image", file_url: "", thumbnail_url: "" });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ── AI Generate image ──
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!generateForm.prompt.trim()) {
      setGenerateError("Prompt is required.");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const payload = {
        prompt: generateForm.prompt.trim(),
        name: generateForm.name.trim() || undefined,
        asset_type: generateForm.asset_type,
        width: parseInt(generateForm.width) || 1024,
        height: parseInt(generateForm.height) || 1024,
        style: generateForm.style.trim() || undefined,
      };
      const created = await api.post<CreativeAsset>("/api/v1/creative/generate-image", payload);
      setAssets((prev) => [created, ...prev]);
      setShowGenerate(false);
      setGenerateForm({ prompt: "", name: "", asset_type: "image", width: "1024", height: "1024", style: "" });
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  // ── Delete asset ──
  async function handleDelete(assetId: string) {
    setDeletingId(assetId);
    try {
      await api.delete(`/api/v1/creative/assets/${assetId}`);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch {
      // silently fail — could show toast
    } finally {
      setDeletingId(null);
    }
  }

  const filters = [
    { value: "all", label: t("allTypes") },
    { value: "image", label: t("image") },
    { value: "banner", label: t("banner") },
    { value: "logo", label: t("logo") },
    { value: "mockup", label: t("mockup") },
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Filter tabs */}
          <div className="flex gap-1 rounded-lg bg-background p-1">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.value
                    ? "bg-surface text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
            >
              <Upload className="h-4 w-4" />
              {t("upload")}
            </button>
            <button
              onClick={() => setShowGenerate(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Sparkles className="h-4 w-4" />
              {t("generateImage")}
            </button>
          </div>
        </div>

        {/* Content area */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Image}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actionLabel={t("generateImage")}
            onAction={() => setShowGenerate(true)}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((asset) => {
              const TypeIcon = typeIcons[asset.asset_type] ?? Image;
              return (
                <div
                  key={asset.id}
                  className="group overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Thumbnail */}
                  <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
                    {asset.thumbnail_url ? (
                      <img
                        src={asset.thumbnail_url}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : asset.file_url && asset.asset_type === "image" ? (
                      <img
                        src={asset.file_url}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <TypeIcon className="h-12 w-12 text-text-muted/40" />
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {asset.name}
                        </p>
                        <p className="mt-0.5 text-xs capitalize text-text-muted">
                          {asset.asset_type}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {asset.file_url && (
                          <a
                            href={asset.file_url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(asset.id)}
                          disabled={deletingId === asset.id}
                          className="rounded-md p-1 text-text-muted hover:bg-error/10 hover:text-error disabled:opacity-40"
                        >
                          {deletingId === asset.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-text-muted">
                      {new Date(asset.created_at).toLocaleDateString()}
                    </p>
                    {asset.prompt_used && (
                      <p className="mt-1 line-clamp-2 text-xs italic text-text-muted">
                        "{asset.prompt_used}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">{t("upload")}</h2>
              <button
                onClick={() => { setShowUpload(false); setUploadError(null); }}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Name *</label>
                <input
                  required
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Asset name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Type *</label>
                <select
                  value={uploadForm.asset_type}
                  onChange={(e) => setUploadForm((f) => ({ ...f, asset_type: e.target.value as AssetTypeValue }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">File URL *</label>
                <input
                  required
                  type="url"
                  value={uploadForm.file_url}
                  onChange={(e) => setUploadForm((f) => ({ ...f, file_url: e.target.value }))}
                  placeholder="https://cdn.example.com/asset.png"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Thumbnail URL</label>
                <input
                  type="url"
                  value={uploadForm.thumbnail_url}
                  onChange={(e) => setUploadForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                  placeholder="https://cdn.example.com/thumb.png"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowUpload(false); setUploadError(null); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("upload")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">{t("generateImage")}</h2>
              <button
                onClick={() => { setShowGenerate(false); setGenerateError(null); }}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {generateError && (
              <div className="mb-4 rounded-lg bg-error/10 px-4 py-2.5 text-sm text-error">
                {generateError}
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Prompt *</label>
                <textarea
                  required
                  rows={3}
                  value={generateForm.prompt}
                  onChange={(e) => setGenerateForm((f) => ({ ...f, prompt: e.target.value }))}
                  placeholder="Describe the image you want to generate…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Name</label>
                <input
                  type="text"
                  value={generateForm.name}
                  onChange={(e) => setGenerateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Optional display name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Asset Type</label>
                <select
                  value={generateForm.asset_type}
                  onChange={(e) => setGenerateForm((f) => ({ ...f, asset_type: e.target.value as AssetTypeValue }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Width (px)</label>
                  <input
                    type="number"
                    min="64"
                    max="4096"
                    step="64"
                    value={generateForm.width}
                    onChange={(e) => setGenerateForm((f) => ({ ...f, width: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Height (px)</label>
                  <input
                    type="number"
                    min="64"
                    max="4096"
                    step="64"
                    value={generateForm.height}
                    onChange={(e) => setGenerateForm((f) => ({ ...f, height: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Style</label>
                <input
                  type="text"
                  value={generateForm.style}
                  onChange={(e) => setGenerateForm((f) => ({ ...f, style: e.target.value }))}
                  placeholder="e.g. photorealistic, minimalist, cartoon"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowGenerate(false); setGenerateError(null); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {generating ? "Generating…" : t("generateImage")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
