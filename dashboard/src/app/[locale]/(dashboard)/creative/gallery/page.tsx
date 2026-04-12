"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import {
  Sparkles,
  Search,
  Download,
  Trash2,
  Loader2,
  Film,
  Image as ImageIcon,
  Link2,
} from "lucide-react";
import { clsx } from "clsx";

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

interface ContentPostLite {
  id: string;
  title: string;
  status: string;
}

type FilterKey = "all" | "image" | "video";

export default function CreativeGalleryPage() {
  const t = useTranslations("creativeGallery");

  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [since, setSince] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Attach-to-content state
  const [attachOpenId, setAttachOpenId] = useState<string | null>(null);
  const [posts, setPosts] = useState<ContentPostLite[]>([]);
  const [attachingPostId, setAttachingPostId] = useState<string | null>(null);

  useEffect(() => {
    void loadAssets();
  }, [filter, since]);

  async function loadAssets() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("asset_type", filter);
      if (since) params.set("since", new Date(since).toISOString());
      const qs = params.toString();
      const data = await api.get<CreativeAsset[]>(
        `/api/v1/creative-gen/assets${qs ? `?${qs}` : ""}`
      );
      setAssets(data);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.prompt_used ?? "").toLowerCase().includes(q)
    );
  }, [assets, search]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this creative?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/v1/creative-gen/assets/${id}`);
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // noop
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(asset: CreativeAsset) {
    if (!asset.file_url) return;
    try {
      const res = await fetch(asset.file_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${asset.name || "creative"}-${asset.id.slice(0, 8)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(asset.file_url, "_blank");
    }
  }

  async function openAttach(assetId: string) {
    setAttachOpenId(assetId);
    if (posts.length === 0) {
      try {
        const data = await api.get<ContentPostLite[]>(
          "/api/v1/content/posts?limit=20"
        );
        setPosts(data.filter((p) => p.status === "draft"));
      } catch {
        setPosts([]);
      }
    }
  }

  async function attachTo(postId: string, creativeId: string) {
    setAttachingPostId(postId);
    try {
      await api.post(`/api/v1/content/${postId}/attach-creative`, {
        creative_id: creativeId,
      });
      setAttachOpenId(null);
    } catch {
      // noop
    } finally {
      setAttachingPostId(null);
    }
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />
      <div className="p-6">
        <p className="mb-6 text-sm text-text-secondary">{t("subtitle")}</p>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-background p-1">
              {(["all", "image", "video"] as FilterKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    filter === k
                      ? "bg-surface text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {t(`filter.${k}`)}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
                className="w-56 rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <Link
            href="/creative/generate"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Sparkles className="h-4 w-4" />
            {t("newCreative")}
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-sm text-text-muted">
            {t("empty")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((asset) => {
              const isVideo = asset.asset_type === "video";
              return (
                <div
                  key={asset.id}
                  className="group overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
                    {isVideo && asset.file_url ? (
                      <video
                        src={asset.file_url}
                        className="h-full w-full object-cover"
                        muted
                        loop
                        playsInline
                      />
                    ) : asset.thumbnail_url || asset.file_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbnail_url ?? asset.file_url ?? ""}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                      />
                    ) : isVideo ? (
                      <Film className="h-12 w-12 text-text-muted/40" />
                    ) : (
                      <ImageIcon className="h-12 w-12 text-text-muted/40" />
                    )}
                  </div>

                  <div className="p-4">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {asset.name}
                    </p>
                    <p className="mt-0.5 text-xs capitalize text-text-muted">
                      {asset.asset_type} ·{" "}
                      {new Date(asset.created_at).toLocaleDateString()}
                    </p>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleDownload(asset)}
                        disabled={!asset.file_url}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-40"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("actions.download")}
                      </button>
                      <button
                        onClick={() => openAttach(asset.id)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {t("actions.attach")}
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        disabled={deletingId === asset.id}
                        className="rounded-md border border-border p-1.5 text-text-muted hover:bg-error/10 hover:text-error disabled:opacity-40"
                      >
                        {deletingId === asset.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {attachOpenId === asset.id && (
                      <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-background p-2">
                        {posts.length === 0 ? (
                          <p className="p-2 text-xs text-text-muted">
                            No draft content posts.
                          </p>
                        ) : (
                          posts.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => attachTo(p.id, asset.id)}
                              disabled={attachingPostId === p.id}
                              className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-40"
                            >
                              <span className="truncate">{p.title}</span>
                              {attachingPostId === p.id && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
