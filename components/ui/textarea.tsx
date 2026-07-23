import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
 "flex min-h-24 w-full rounded-[var(--radius-sm)] border border-border bg-elevated px-3 py-2 text-sm leading-relaxed text-foreground transition-colors",
 "placeholder:text-subtle hover:border-border-strong",
 "focus-visible:border-primary focus-visible:outline-none",
 "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
