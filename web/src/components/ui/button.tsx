import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-control text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]",
  {
    variants: {
      variant: {
        primary:
          "bg-navy-900 text-on-navy hover:bg-navy-800 dark:bg-brass dark:text-navy-900 dark:hover:bg-brass/90 shadow-sm",
        secondary:
          "border border-border bg-surface text-foreground hover:bg-surface-subtle shadow-xs",
        ghost:
          "text-foreground-2 hover:bg-surface-subtle hover:text-foreground",
        danger:
          "bg-loss text-white hover:bg-loss/90 shadow-xs",
        brass:
          "bg-brass text-navy-900 hover:bg-brass/90 font-semibold shadow-sm",
      },
      /*
       * Compact by design.
       *
       * `md` used to be h-10 / text-sm, which made every modal footer a 40px
       * button row inside a 72px strip — the heaviest thing in a dialog whose
       * job is the fields above it. The scale now starts from the dashboard's
       * "Add Entry" pill (h-9, 12.5px), which was the one control on the app
       * that already looked right, and everything else matches it.
       *
       * `lg` is for marketing and auth pages, where a button IS the page.
       */
      size: {
        sm: "h-7 px-2.5 text-[11.5px] gap-1",
        md: "h-9 px-3.5 text-[12.5px] gap-1.5",
        lg: "h-11 px-5 text-sm rounded-card gap-2",
        icon: "size-8 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="me-2 h-4 w-4 animate-spin shrink-0" />
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
