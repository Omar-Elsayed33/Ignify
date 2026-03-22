"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import * as Tabs from "@radix-ui/react-tabs";
import { clsx } from "clsx";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const t = useTranslations("settingsPage");
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List className="mb-6 flex gap-1 rounded-lg bg-background p-1">
            {[
              { value: "general", label: t("general") },
              { value: "ai", label: t("aiConfig") },
              { value: "brand", label: t("brandSettings") },
            ].map((tab) => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className={clsx(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.value
                    ? "bg-surface text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* General Settings */}
          <Tabs.Content value="general">
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-6 text-lg font-semibold text-text-primary">{t("general")}</h3>
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("tenantName")}
                  </label>
                  <input
                    type="text"
                    defaultValue="My Company"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("slug")}
                  </label>
                  <input
                    type="text"
                    defaultValue="my-company"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-text-muted">app.ignify.ai/my-company</p>
                </div>
                <button className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">
                  <Save className="h-4 w-4" />
                  {t("saveSettings")}
                </button>
              </div>
            </div>
          </Tabs.Content>

          {/* AI Configuration */}
          <Tabs.Content value="ai">
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-6 text-lg font-semibold text-text-primary">{t("aiConfig")}</h3>
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("aiProvider")}
                  </label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>OpenAI</option>
                    <option>Anthropic</option>
                    <option>Google AI</option>
                    <option>Cohere</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("model")}
                  </label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>GPT-4o</option>
                    <option>GPT-4o-mini</option>
                    <option>Claude 3.5 Sonnet</option>
                    <option>Gemini 2.0</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("apiKey")}
                  </label>
                  <input
                    type="password"
                    defaultValue="sk-xxxxxxxxxxxxx"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">
                  <Save className="h-4 w-4" />
                  {t("saveSettings")}
                </button>
              </div>
            </div>
          </Tabs.Content>

          {/* Brand Settings */}
          <Tabs.Content value="brand">
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-6 text-lg font-semibold text-text-primary">{t("brandSettings")}</h3>
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("brandName")}
                  </label>
                  <input
                    type="text"
                    defaultValue="My Brand"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("brandVoice")}
                  </label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>Professional</option>
                    <option>Casual</option>
                    <option>Friendly</option>
                    <option>Authoritative</option>
                    <option>Playful</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("brandTone")}
                  </label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>Confident</option>
                    <option>Empathetic</option>
                    <option>Inspirational</option>
                    <option>Informative</option>
                    <option>Conversational</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t("brandColors")}
                  </label>
                  <div className="flex gap-3">
                    <div>
                      <p className="mb-1 text-xs text-text-muted">Primary</p>
                      <input type="color" defaultValue="#FF6B00" className="h-10 w-16 cursor-pointer rounded border border-border" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-text-muted">Secondary</p>
                      <input type="color" defaultValue="#1A1A2E" className="h-10 w-16 cursor-pointer rounded border border-border" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-text-muted">Accent</p>
                      <input type="color" defaultValue="#FFB800" className="h-10 w-16 cursor-pointer rounded border border-border" />
                    </div>
                  </div>
                </div>
                <button className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">
                  <Save className="h-4 w-4" />
                  {t("saveSettings")}
                </button>
              </div>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
