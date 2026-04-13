"use client";

import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-screen bg-background">
      {/* Branding panel */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-secondary via-secondary to-primary/80 p-12 lg:flex">
        <div className="absolute -top-24 -end-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -start-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/40">
            <Flame className="h-8 w-8 text-white" />
          </div>
          <span className="text-4xl font-bold text-white">Ignify</span>
        </div>
        <p className="relative mt-6 max-w-md text-center text-lg leading-relaxed text-white/85">
          {t("brandTagline")}
        </p>
        <div className="relative mt-12 grid grid-cols-3 gap-8">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">10x</p>
            <p className="mt-1 text-sm text-white/70">{t("statFasterContent")}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-accent">85%</p>
            <p className="mt-1 text-sm text-white/70">{t("statCostReduction")}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white">3x</p>
            <p className="mt-1 text-sm text-white/70">{t("statMoreLeads")}</p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
