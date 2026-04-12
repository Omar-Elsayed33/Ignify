"use client";

import { clsx } from "clsx";
import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function FieldWrapper({ label, hint, error, children }: FieldWrapperProps) {
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="font-headline text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
      )}
      {children}
      {hint && !error && <span className="block text-xs text-on-surface-variant/70">{hint}</span>}
      {error && <span className="block text-xs font-medium text-error">{error}</span>}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, ...props },
  ref
) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <input
        ref={ref}
        className={clsx(
          "w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none transition-all focus:ring-2 focus:ring-primary/30",
          error && "ring-2 ring-error/40",
          className
        )}
        {...props}
      />
    </FieldWrapper>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, ...props },
  ref
) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <textarea
        ref={ref}
        className={clsx(
          "w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none transition-all focus:ring-2 focus:ring-primary/30",
          error && "ring-2 ring-error/40",
          className
        )}
        {...props}
      />
    </FieldWrapper>
  );
});

export default Input;
