"use client";

import { Loader2, Sparkles } from "lucide-react";

interface Props {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label: string;
  loadingLabel?: string;
  size?: "sm" | "md";
  variant?: "solid" | "ghost";
  className?: string;
}

/**
 * Reusable AI-assist button with spinner + sparkle icon.
 * Label/loadingLabel are passed pre-translated from the caller.
 */
export default function AIAssistButton({
  onClick,
  loading = false,
  disabled = false,
  label,
  loadingLabel,
  size = "md",
  variant = "solid",
  className = "",
}: Props) {
  const base =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : "px-4 py-2 text-sm";
  const theme =
    variant === "solid"
      ? "bg-gradient-to-r from-[#FF6B35] via-[#FF3D71] to-[#7B2CBF] text-white hover:opacity-90"
      : "border border-border text-text-primary hover:bg-surface-hover";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 rounded-md font-medium transition-opacity disabled:opacity-50 ${base} ${theme} ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      <span>{loading && loadingLabel ? loadingLabel : label}</span>
    </button>
  );
}
