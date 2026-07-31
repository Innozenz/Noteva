"use client";

import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Toast (Radix Toast), habillé sur les jetons du thème.
 *
 * Bâti sur la primitive Radix déjà présente plutôt que sur une bibliothèque de
 * toasts à part, comme les autres `ui/*`. Les couleurs suivent la règle « une
 * teinte nomme quelque chose » : vert de réussite, rouge d'erreur, sur leurs
 * fonds `-soft`. Pas de classes `animate-in`/`animate-out` — le plugin qui les
 * fournit n'est pas installé, exactement comme pour le Dialog.
 */
export const ToastProvider = ToastPrimitives.Provider;

export function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Viewport>) {
  return (
    <ToastPrimitives.Viewport
      className={cn(
        // Au-dessus du Dialog (z-50) : un toast déclenché depuis une modale doit
        // rester lisible.
        "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm",
        className
      )}
      {...props}
    />
  );
}

const toastVariants = cva(
  "pointer-events-auto relative flex items-start gap-3 rounded-lg border p-4 pr-9 shadow-lg",
  {
    variants: {
      variant: {
        success: "border-success/40 bg-success-soft text-foreground",
        error: "border-danger/40 bg-danger-soft text-foreground",
      },
    },
    defaultVariants: { variant: "success" },
  }
);

export function Toast({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants>) {
  return (
    <ToastPrimitives.Root
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
}

export function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Title>) {
  return (
    <ToastPrimitives.Title
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

export function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Description>) {
  return (
    <ToastPrimitives.Description
      className={cn("mt-1 text-sm text-muted", className)}
      {...props}
    />
  );
}

export function ToastAction({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Action>) {
  return (
    <ToastPrimitives.Action
      className={cn(
        "shrink-0 rounded-md border border-border bg-elevated px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function ToastClose({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Close>) {
  return (
    <ToastPrimitives.Close
      aria-label="Fermer"
      className={cn(
        "absolute right-2 top-2 rounded-md p-1 text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none",
        className
      )}
      {...props}
    >
      <X className="h-3.5 w-3.5" />
    </ToastPrimitives.Close>
  );
}
