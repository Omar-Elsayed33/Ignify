"use client";

import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { Plus, Heart, MessageCircle, Share2, Eye, Instagram, Facebook, Twitter, Linkedin, Calendar } from "lucide-react";
import { clsx } from "clsx";

const connectedAccounts = [
  { name: "Instagram", icon: Instagram, followers: "24.5K", status: "connected" },
  { name: "Facebook", icon: Facebook, followers: "18.2K", status: "connected" },
  { name: "Twitter / X", icon: Twitter, followers: "12.8K", status: "connected" },
  { name: "LinkedIn", icon: Linkedin, followers: "8.4K", status: "disconnected" },
];

const recentPosts = [
  { id: "1", content: "Exciting news! Our AI marketing platform just reached 10K users...", platform: "Instagram", date: "2026-03-20", likes: 342, comments: 28, shares: 45, reach: "12.4K" },
  { id: "2", content: "5 AI Marketing Trends You Can't Ignore in 2026...", platform: "Twitter / X", date: "2026-03-19", likes: 189, comments: 34, shares: 67, reach: "8.9K" },
  { id: "3", content: "Behind the scenes at Ignify HQ - Meet our engineering team...", platform: "Facebook", date: "2026-03-18", likes: 256, comments: 42, shares: 23, reach: "15.2K" },
  { id: "4", content: "New case study: How Company X increased leads by 300%...", platform: "LinkedIn", date: "2026-03-17", likes: 178, comments: 19, shares: 56, reach: "6.7K" },
];

const platformColors: Record<string, string> = {
  Instagram: "bg-pink-500/10 text-pink-500",
  Facebook: "bg-blue-600/10 text-blue-600",
  "Twitter / X": "bg-sky-500/10 text-sky-500",
  LinkedIn: "bg-blue-700/10 text-blue-700",
};

export default function SocialPage() {
  const t = useTranslations("socialPage");

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        {/* Connected Accounts */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">
            {t("connectedAccounts")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {connectedAccounts.map((account) => {
              const Icon = account.icon;
              return (
                <div
                  key={account.name}
                  className="rounded-xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-text-secondary" />
                      <span className="text-sm font-medium text-text-primary">{account.name}</span>
                    </div>
                    <span
                      className={clsx(
                        "h-2 w-2 rounded-full",
                        account.status === "connected" ? "bg-success" : "bg-text-muted"
                      )}
                    />
                  </div>
                  <p className="mt-2 text-xl font-bold text-text-primary">{account.followers}</p>
                  <p className="text-xs text-text-muted">followers</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Post Calendar Placeholder */}
        <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">{t("postCalendar")}</h3>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              <Plus className="h-4 w-4" />
              {t("schedulePost")}
            </button>
          </div>
          <div className="mt-4 flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
            <div className="text-center">
              <Calendar className="mx-auto h-10 w-10 text-text-muted/40" />
              <p className="mt-2 text-sm text-text-muted">{t("postCalendar")}</p>
            </div>
          </div>
        </div>

        {/* Recent Posts */}
        <h3 className="mb-4 text-lg font-semibold text-text-primary">{t("recentPosts")}</h3>
        <div className="space-y-4">
          {recentPosts.map((post) => (
            <div
              key={post.id}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", platformColors[post.platform])}>
                      {post.platform}
                    </span>
                    <span className="text-xs text-text-muted">{post.date}</span>
                  </div>
                  <p className="mt-2 text-sm text-text-primary">{post.content}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-6">
                <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <Heart className="h-4 w-4" /> {post.likes} {t("likes")}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <MessageCircle className="h-4 w-4" /> {post.comments} {t("comments")}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <Share2 className="h-4 w-4" /> {post.shares} {t("shares")}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <Eye className="h-4 w-4" /> {post.reach} {t("reach")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
