import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Les variantes n'utilisent que des jetons sémantiques : l'identité se règle
 * dans globals.css, pas ici.
 */
const buttonVariants = cva(
 "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Léger enfoncement au clic : un retour physique vaut mieux qu'un
        // changement de teinte seul.
        default:
 "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:translate-y-px",
        destructive:
 "bg-danger text-white shadow-sm hover:brightness-110 active:translate-y-px",
        outline:
 "border border-border bg-elevated text-foreground hover:border-border-strong hover:bg-surface active:translate-y-px",
        secondary:
 "bg-surface-strong text-foreground hover:brightness-95 active:translate-y-px",
        ghost: "text-muted hover:bg-surface hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success:
 "bg-success text-white shadow-sm hover:brightness-110 active:translate-y-px",
        accent:
 "bg-accent text-white shadow-sm hover:brightness-110 active:translate-y-px",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-[0.8125rem]",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
