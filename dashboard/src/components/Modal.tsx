"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed start-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-xl focus:outline-none [dir=rtl]&:translate-x-1/2">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="mt-2 text-sm text-text-secondary">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
