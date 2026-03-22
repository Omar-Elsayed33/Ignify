"use client";

import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { clsx } from "clsx";
import {
  MonitorSmartphone,
  BarChart3,
  Search,
  Mail,
  ShoppingBag,
  Globe,
  Zap,
  Users,
} from "lucide-react";

interface Integration {
  key: string;
  icon: React.ElementType;
  color: string;
  connected: boolean;
  description: string;
}

const integrations: Integration[] = [
  { key: "googleAds", icon: MonitorSmartphone, color: "bg-blue-500/10 text-blue-500", connected: true, description: "Run and optimize Google search and display campaigns" },
  { key: "metaAds", icon: MonitorSmartphone, color: "bg-blue-600/10 text-blue-600", connected: true, description: "Manage Facebook and Instagram advertising" },
  { key: "snapchatAds", icon: MonitorSmartphone, color: "bg-yellow-500/10 text-yellow-500", connected: false, description: "Reach younger audiences with Snapchat campaigns" },
  { key: "googleAnalytics", icon: BarChart3, color: "bg-orange-500/10 text-orange-500", connected: true, description: "Track website traffic and user behavior" },
  { key: "searchConsole", icon: Search, color: "bg-green-500/10 text-green-500", connected: true, description: "Monitor search performance and indexing" },
  { key: "mailchimp", icon: Mail, color: "bg-yellow-600/10 text-yellow-600", connected: false, description: "Email marketing and automation platform" },
  { key: "hubspot", icon: Users, color: "bg-orange-600/10 text-orange-600", connected: false, description: "CRM and inbound marketing suite" },
  { key: "shopify", icon: ShoppingBag, color: "bg-green-600/10 text-green-600", connected: false, description: "E-commerce platform integration" },
  { key: "wordpress", icon: Globe, color: "bg-sky-500/10 text-sky-500", connected: true, description: "Content management and publishing" },
  { key: "zapier", icon: Zap, color: "bg-orange-500/10 text-orange-500", connected: false, description: "Connect with 5000+ apps and automate workflows" },
];

export default function IntegrationsPage() {
  const t = useTranslations("integrationsPage");
  const tc = useTranslations("common");

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            return (
              <div
                key={integration.key}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx("rounded-lg p-2.5", integration.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">
                        {t(integration.key as "googleAds")}
                      </h4>
                      <span
                        className={clsx(
                          "text-xs font-medium",
                          integration.connected ? "text-success" : "text-text-muted"
                        )}
                      >
                        {integration.connected ? tc("connected") : tc("disconnected")}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-text-secondary leading-relaxed">
                  {integration.description}
                </p>

                <div className="mt-4">
                  {integration.connected ? (
                    <button className="w-full rounded-lg border border-error/20 py-2 text-xs font-medium text-error hover:bg-error/10">
                      {tc("disconnect")}
                    </button>
                  ) : (
                    <button className="w-full rounded-lg bg-primary py-2 text-xs font-medium text-white hover:bg-primary-dark">
                      {tc("connect")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
