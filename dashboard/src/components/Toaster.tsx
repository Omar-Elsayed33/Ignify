"use client";

import * as Toast from "@radix-ui/react-toast";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { clsx } from "clsx";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
}

interface ToastCtx {
  show: (t: Omit<ToastItem, "id" | "duration"> & { duration?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster />");
  return ctx;
}

const kindStyles: Record<ToastKind, { ring: string; icon: ReactNode }> = {
  success: {
    ring: "ring-green-500/30 bg-green-50 dark:bg-green-950/30",
    icon: <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />,
  },
  error: {
    ring: "ring-red-500/30 bg-red-50 dark:bg-red-950/30",
    icon: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />,
  },
  info: {
    ring: "ring-blue-500/30 bg-blue-50 dark:bg-blue-950/30",
    icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
  },
};

export default function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show: ToastCtx["show"] = useCallback((t) => {
    setItems((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), duration: 4000, ...t },
    ]);
  }, []);

  const api = useMemo<ToastCtx>(
    () => ({
      show,
      success: (title, description) => show({ kind: "success", title, description }),
      error: (title, description) => show({ kind: "error", title, description }),
      info: (title, description) => show({ kind: "info", title, description }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      <Toast.Provider swipeDirection="right" duration={4000}>
        {children}
        {items.map((t) => {
          const s = kindStyles[t.kind];
          return (
            <Toast.Root
              key={t.id}
              duration={t.duration}
              onOpenChange={(open) => {
                if (!open) setItems((prev) => prev.filter((x) => x.id !== t.id));
              }}
              className={clsx(
                "flex w-full items-start gap-3 rounded-2xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 backdrop-blur",
                "data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full",
                "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full",
                s.ring
              )}
            >
              <div className="mt-0.5 shrink-0">{s.icon}</div>
              <div className="min-w-0 flex-1">
                <Toast.Title className="text-sm font-semibold text-on-surface">
                  {t.title}
                </Toast.Title>
                {t.description && (
                  <Toast.Description className="mt-0.5 text-xs text-on-surface-variant">
                    {t.description}
                  </Toast.Description>
                )}
              </div>
              <Toast.Close
                aria-label="Close"
                className="shrink-0 rounded-full p-1 text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Toast.Close>
            </Toast.Root>
          );
        })}
        <Toast.Viewport className="fixed bottom-4 end-4 z-[100] m-0 flex w-[360px] max-w-[calc(100vw-2rem)] list-none flex-col gap-2 p-0 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
