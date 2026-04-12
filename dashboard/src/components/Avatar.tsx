"use client";

import { clsx } from "clsx";
import * as RAvatar from "@radix-ui/react-avatar";

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  premium?: boolean;
  className?: string;
}

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export default function Avatar({
  name,
  src,
  size = "md",
  premium = false,
  className,
}: AvatarProps) {
  const initial = (name || "U").charAt(0).toUpperCase();

  const inner = (
    <RAvatar.Root
      className={clsx(
        "brand-gradient flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        sizes[size]
      )}
    >
      {src && <RAvatar.Image src={src} alt={name || ""} className="h-full w-full object-cover" />}
      <RAvatar.Fallback className="font-semibold text-white">{initial}</RAvatar.Fallback>
    </RAvatar.Root>
  );

  if (premium) {
    return (
      <div className={clsx("brand-gradient rounded-full p-[2px]", className)}>
        <div className="rounded-full bg-surface-container-lowest p-[2px]">{inner}</div>
      </div>
    );
  }

  return <div className={className}>{inner}</div>;
}
