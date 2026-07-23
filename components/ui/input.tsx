import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
 "flex h-10 w-full rounded-[var(--radius-sm)] border border-border bg-elevated px-3 py-2 text-sm text-foreground transition-colors",
 "placeholder:text-subtle hover:border-border-strong",
 "focus-visible:border-primary focus-visible:outline-none",
          // L'anneau de focus global suffit ; on ajoute seulement la bordure.
 "aria-[invalid=true]:border-danger",
 "disabled:cursor-not-allowed disabled:opacity-50",
 "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
