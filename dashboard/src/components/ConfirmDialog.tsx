"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ConfirmKind = "default" | "danger";

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  kind?: ConfirmKind;
}

interface ConfirmCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<ConfirmCtx | null>(null);

export function useConfirm(): ConfirmCtx["confirm"] {
  const v = useContext(Ctx);
  if (!v) throw new Error("useConfirm must be used inside <ConfirmProvider />");
  return v.confirm;
}

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmCtx["confirm"]>((o) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (v: boolean) => {
    resolverRef.current?.(v);
    resolverRef.current = null;
    setOpen(false);
  };

  const kind = opts.kind ?? "default";

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      <Dialog.Root open={open} onOpenChange={(o) => !o && settle(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed start-1/2 top-1/2 z-[100] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(0,0,0,0.2)] ring-1 ring-outline/10 rtl:translate-x-1/2 data-[state=open]:animate-in data-[state=open]:zoom-in-95">
            <div className="flex items-start gap-3">
              {kind === "danger" && (
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-base font-bold text-on-surface">
                  {opts.title ?? "Confirm"}
                </Dialog.Title>
                {opts.description && (
                  <Dialog.Description className="mt-1.5 text-sm text-on-surface-variant">
                    {opts.description}
                  </Dialog.Description>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => settle(false)}
                className="rounded-2xl bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => settle(true)}
                className={
                  kind === "danger"
                    ? "rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
                    : "brand-gradient rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                }
              >
                {opts.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
