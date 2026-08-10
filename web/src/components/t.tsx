import { cn } from "@/lib/utils";

/**
 * Wrapper for user-facing COPY.
 *
 * The layout never mirrors — `<html>` is `dir="ltr"` in every locale. This is
 * the one place direction changes: `dir="auto"` lets the browser pick per run,
 * so an Urdu string reads right-to-left inside its own box while the card it
 * sits in, and everything around it, stays put.
 *
 * Rule of thumb: translated strings go in `<T>`; numbers, dates, IDs and brand
 * names do not (they use `.tnum` / `.ltr`, which force LTR and isolate).
 */
export function T<Tag extends keyof React.JSX.IntrinsicElements = "span">({
  as,
  className,
  children,
  ...rest
}: {
  as?: Tag;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<Tag>, "children" | "className">) {
  const Component = (as ?? "span") as React.ElementType;
  return (
    <Component dir="auto" className={cn("copy", className)} {...rest}>
      {children}
    </Component>
  );
}
