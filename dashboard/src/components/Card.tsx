"use client";

import { clsx } from "clsx";
import { forwardRef, HTMLAttributes } from "react";

type Variant = "default" | "interactive" | "flat" | "gradient-border";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: "sm" | "md" | "lg" | "none";
}

const variantStyles: Record<Variant, string> = {
  default: "bg-surface-container-lowest shadow-soft ghost-border",
  interactive:
    "bg-surface-container-lowest shadow-soft ghost-border transition-all hover:-translate-y-0.5 hover:bg-surface-bright cursor-pointer",
  flat: "bg-surface-container-low",
  "gradient-border": "brand-gradient-border shadow-soft",
};

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", padding = "md", className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        "rounded-2xl",
        variantStyles[variant],
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export default Card;
