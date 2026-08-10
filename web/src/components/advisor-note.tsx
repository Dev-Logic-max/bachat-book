import { Info } from "lucide-react";
import { T } from "@/components/t";
import { cn } from "@/lib/utils";

/**
 * Required on every Zakat and Tax surface — CLAUDE.md: "Tax and Zakat surfaces
 * carry a visible 'verify with your own advisor' line. The app computes; it
 * does not advise."
 *
 * Deliberately not a dismissible toast: it has to survive a screenshot and be
 * present on the page a user prints or exports.
 */
export function AdvisorNote({
  kind,
  className,
}: {
  /** Zakat cites a scholar, tax cites a tax advisor — different authorities. */
  kind: "zakat" | "tax";
  className?: string;
}) {
  const body =
    kind === "zakat"
      ? "Bachat Book calculates your Zakat from the figures you enter. It does not give religious rulings. Verify the nisab standard, your hawl date and the final amount with a qualified Islamic scholar before you pay."
      : "Bachat Book calculates tax from the figures you enter using published FBR slabs. It is not tax advice and is not affiliated with the FBR. Verify every figure with a qualified tax advisor before you file.";

  return (
    <aside
      className={cn(
        "border-border bg-surface-subtle rounded-card flex items-start gap-2.5 border p-3.5",
        className,
      )}
    >
      <Info
        size={15}
        strokeWidth={1.75}
        className="text-warn mt-0.5 shrink-0"
        aria-hidden
      />
      <T as="p" className="text-muted text-[11.5px] leading-relaxed">
        {body}
      </T>
    </aside>
  );
}
