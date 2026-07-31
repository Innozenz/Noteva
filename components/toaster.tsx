"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToastStore } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Rendu de la file de toasts.
 *
 * Monté une fois (dans `Providers`), il lit la file du store et rend un Toast
 * Radix par entrée. Radix gère l'auto-fermeture (`duration`) : à l'expiration il
 * émet `onOpenChange(false)`, et l'on retire alors l'entrée du store.
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <ToastProvider swipeDirection="right" duration={5000}>
      {toasts.map((toast) => {
        const Icon = toast.variant === "success" ? CheckCircle2 : AlertCircle;

        return (
          <Toast
            key={toast.id}
            variant={toast.variant}
            onOpenChange={(open) => {
              if (!open) dismiss(toast.id);
            }}
          >
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                toast.variant === "success" ? "text-success" : "text-danger"
              )}
            />
            <div className="min-w-0 flex-1">
              <ToastTitle>{toast.title}</ToastTitle>
              {toast.description ? (
                <ToastDescription>{toast.description}</ToastDescription>
              ) : null}
            </div>
            {toast.action ? (
              <ToastAction
                altText={toast.action.label}
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </ToastAction>
            ) : null}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
