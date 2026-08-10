import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `action` is a label by default and a link when `actionHref` is given.
 *
 * It was previously typed `action?: string` and always rendered as a bare
 * <span>, which is why "View All" on the dashboard looked clickable and did
 * nothing. Most call sites genuinely pass a label ("3 open", "Silver nisab"), so
 * the label case had to stay rather than be converted wholesale to links.
 */
export function Panel({
  title,
  action,
  actionHref,
  onAction,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const actionClasses =
    "text-brass-strong text-[12px] font-medium inline-flex items-center gap-0.5 rounded-control transition-colors";

  return (
    <section
      className={cn(
        "bg-surface border-border rounded-panel border shadow-sm",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>

        {action != null &&
          (actionHref ? (
            <Link
              href={actionHref}
              className={cn(actionClasses, "hover:underline")}
            >
              {action}
              <ChevronRight size={13} strokeWidth={2} />
            </Link>
          ) : onAction ? (
            <button
              type="button"
              onClick={onAction}
              className={cn(actionClasses, "hover:underline")}
            >
              {action}
            </button>
          ) : (
            <span className="text-brass-strong text-[12px] font-medium">
              {action}
            </span>
          ))}
      </header>
      <div className={cn("px-5 pb-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Hairline separator between list rows — never a bordered table. */
export function Rows({ children }: { children: React.ReactNode }) {
  return <ul className="divide-border divide-y">{children}</ul>;
}
