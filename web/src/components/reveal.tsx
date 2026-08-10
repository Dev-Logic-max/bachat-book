import { cn } from "@/lib/utils";

/**
 * Entrance motion, to the numbers in SPEC §8 as tightened by DECISIONS.md §6:
 * fade + 8px rise, 220ms, cubic-bezier(0.16, 1, 0.3, 1), 40ms between siblings.
 *
 * CSS, not JS, and deliberately so. The first cut used `motion` with
 * `useReducedMotion()` picking between a plain div and a motion.div — that is a
 * hydration mismatch (different element type on server vs client) and React
 * dropped the whole subtree, blanking the page below the header.
 *
 * A keyframe with `animation-fill-mode: both` cannot fail that way: it runs
 * without JS, needs no client boundary, and the global reduced-motion rule in
 * globals.css collapses the duration so the element lands on its FINAL state
 * rather than staying invisible — which is what the screenshot loop requires.
 */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode;
  /** Position among siblings; drives the 40ms stagger. */
  index?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("reveal", className)}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {children}
    </div>
  );
}
