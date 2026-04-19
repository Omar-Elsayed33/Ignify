"use client";

import { useRouter } from "@/i18n/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";

export default function SubscriptionWall() {
  const router = useRouter();
  const { user } = useAuthStore();
  const t = useTranslations("Subscription");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-md">
      <div className="mx-4 w-full max-w-md rounded-3xl bg-surface-container-low p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error-container">
          <Lock className="h-8 w-8 text-on-error-container" />
        </div>
        <h2 className="mb-2 font-headline text-2xl font-bold text-on-surface">
          {t("title")}
        </h2>
        <p className="mb-6 text-sm text-on-surface-variant">{t("subtitle")}</p>

        <div className="mb-6 rounded-2xl bg-surface-container p-4 text-start">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t("bankDetails")}
          </p>
          <div className="space-y-1 text-sm text-on-surface">
            <p><span className="font-medium">{t("bankName")}:</span> Banque Misr</p>
            <p><span className="font-medium">{t("accountName")}:</span> Ignify Technologies</p>
            <p><span className="font-medium">{t("accountNumber")}:</span> 1234567890</p>
            <p><span className="font-medium">{t("iban")}:</span> EG00 0002 0000 0000 0000 1234 5678</p>
          </div>
        </div>

        <button
          onClick={() => router.push("/billing")}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          {t("submitPayment")}
        </button>
        <p className="mt-3 text-xs text-on-surface-variant">{t("contactUs")}</p>
      </div>
    </div>
  );
}
