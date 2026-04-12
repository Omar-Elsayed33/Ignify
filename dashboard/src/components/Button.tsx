"use client";

import { clsx } from "clsx";
import { forwardRef, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "brand-gradient text-white shadow-soft hover:scale-[1.02] transition-transform",
  secondary:
    "bg-surface-container-highest text-on-surface hover:bg-surface-variant transition-colors",
  tertiary:
    "bg-tertiary-fixed text-on-tertiary-fixed-variant hover:brightness-95 transition-all",
  ghost:
    "bg-transparent text-primary hover:bg-primary-fixed/50 transition-colors",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-4 text-xs rounded-xl",
  md: "h-11 px-5 text-sm rounded-2xl",
  lg: "h-12 px-6 text-sm rounded-2xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", leadingIcon, trailingIcon, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});

export default Button;
