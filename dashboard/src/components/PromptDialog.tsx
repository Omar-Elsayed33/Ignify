"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface PromptOptions {
  title: string;
  description?: string;
  placeholder?: string;
  inputType?: "text" | "password" | "url";
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PromptCtx {
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const Ctx = createContext<PromptCtx | null>(null);

export function usePrompt(): PromptCtx["prompt"] {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrompt must be used inside <PromptProvider />");
  return v.prompt;
}

export default function PromptProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<PromptOptions>({ title: "" });
  const [value, setValue] = useState("");
  const resolverRef = useRef<((v: string | null) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prompt = useCallback<PromptCtx["prompt"]>((o) => {
    setOpts(o);
    setValue("");
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (result: string | null) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpen(false);
    setValue("");
  };

  return (
    <Ctx.Provider value={{ prompt }}>
      {children}
      <Dialog.Root
        open={open}
        onOpenChange={(o) => {
          if (!o) settle(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            className="fixed start-1/2 top-1/2 z-[100] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(0,0,0,0.2)] ring-1 ring-outline/10 rtl:translate-x-1/2 data-[state=open]:animate-in data-[state=open]:zoom-in-95"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <Dialog.Title className="text-base font-bold text-on-surface">
              {opts.title}
            </Dialog.Title>
            {opts.description && (
              <Dialog.Description className="mt-1.5 text-sm text-on-surface-variant">
                {opts.description}
              </Dialog.Description>
            )}
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                settle(value);
              }}
            >
              <input
                ref={inputRef}
                type={opts.inputType ?? "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={opts.placeholder ?? ""}
                className="w-full rounded-2xl border border-outline/30 bg-surface-container-high px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => settle(null)}
                  className="rounded-2xl bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {opts.cancelLabel ?? "إلغاء"}
                </button>
                <button
                  type="submit"
                  className="brand-gradient rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {opts.confirmLabel ?? "تأكيد"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
