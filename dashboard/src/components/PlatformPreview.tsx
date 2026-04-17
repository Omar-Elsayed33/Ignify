"use client";
import { useLocale } from "next-intl";
import { clsx } from "clsx";

const LIMITS: Record<string, { caption: number; name: string }> = {
  facebook: { caption: 63206, name: "Facebook" },
  instagram: { caption: 2200, name: "Instagram" },
  linkedin: { caption: 3000, name: "LinkedIn" },
  x: { caption: 280, name: "X" },
  twitter: { caption: 280, name: "X" },
  tiktok: { caption: 2200, name: "TikTok" },
  youtube: { caption: 5000, name: "YouTube" },
  snapchat: { caption: 250, name: "Snapchat" },
};

interface Props {
  platform: string;
  caption: string;
  mediaUrl?: string | null;
  brandName?: string;
}

export default function PlatformPreview({ platform, caption, mediaUrl, brandName }: Props) {
  const isAr = useLocale() === "ar";
  const meta = LIMITS[platform] || { caption: 0, name: platform };
  const over = meta.caption > 0 && caption.length > meta.caption;

  const brandBar: Record<string, string> = {
    facebook: "bg-[#1877F2]",
    instagram: "bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
    linkedin: "bg-[#0A66C2]",
    x: "bg-black",
    twitter: "bg-black",
    tiktok: "bg-black",
    youtube: "bg-[#FF0000]",
    snapchat: "bg-yellow-400",
  };

  const isX = platform === "x" || platform === "twitter";

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-outline/10">
      <div className={`h-1 ${brandBar[platform] || "bg-on-surface/20"}`} />
      <div className="flex items-center gap-2 border-b border-outline/10 p-3">
        <div className="h-8 w-8 rounded-full bg-on-surface/10" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{brandName || "Your Brand"}</p>
          <p className="text-[11px] text-on-surface-variant">{meta.name}</p>
        </div>
      </div>
      {mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl} alt="" className="aspect-video w-full object-cover" />
      )}
      <div className="p-3">
        <p
          className={clsx(
            "whitespace-pre-wrap text-sm text-on-surface",
            isX ? "line-clamp-6" : ""
          )}
        >
          {caption || (isAr ? "اكتب محتوى المنشور..." : "Write your post...")}
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span
            className={clsx(
              over ? "font-semibold text-red-600" : "text-on-surface-variant"
            )}
          >
            {caption.length} / {meta.caption}
          </span>
          {over && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-white">
              {isAr ? "تجاوز الحد" : "Over limit"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
