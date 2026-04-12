"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface OnboardingStatus {
  step: number;
  completed: boolean;
}

export default function OnboardingIndexPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const status = await api.get<OnboardingStatus>("/api/v1/onboarding/status");
        if (status.completed) {
          router.replace("/dashboard");
          return;
        }
        const step = status.step || 0;
        if (step >= 3) router.replace("/onboarding/plan");
        else if (step === 2) router.replace("/onboarding/channels");
        else if (step === 1) router.replace("/onboarding/brand");
        else router.replace("/onboarding/business");
      } catch {
        router.replace("/onboarding/business");
      }
    })();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
