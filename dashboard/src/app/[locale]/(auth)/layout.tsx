"use client";

import { Flame } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Branding panel */}
      <div className="hidden w-1/2 flex-col items-center justify-center bg-secondary p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Flame className="h-8 w-8 text-white" />
          </div>
          <span className="text-4xl font-bold text-white">Ignify</span>
        </div>
        <p className="mt-6 max-w-md text-center text-lg text-white/70">
          AI-powered marketing platform that transforms your business growth
          with intelligent automation and data-driven insights.
        </p>
        <div className="mt-12 grid grid-cols-3 gap-8">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">10x</p>
            <p className="mt-1 text-sm text-white/60">Faster Content</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-accent">85%</p>
            <p className="mt-1 text-sm text-white/60">Cost Reduction</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">3x</p>
            <p className="mt-1 text-sm text-white/60">More Leads</p>
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
