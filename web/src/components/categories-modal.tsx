"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Lock, Pencil, Search, Tags } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryChip } from "@/components/category-icon";
import { cn } from "@/lib/utils";

import type { Tables } from "@/lib/supabase/types";

type Category = Tables<"categories">;

/**
 * The category catalogue, reachable from beside the Category field so you can
 * check what exists without abandoning a half-filled entry form.
 *
 * READ-ONLY for now, and the edit buttons say so rather than being hidden: a
 * disabled control with a reason is a promise, an absent one is a mystery. They
 * light up when the write path lands.
 *
 * Two tiers, deliberately:
 *
 *   PARENTS are platform-wide and owned by the super admin. Reports, budgets and
 *   the tax surfaces all group by them, so a household renaming "Utilities" to
 *   something else would silently break comparisons across the platform.
 *   SUBCATEGORIES are where a household's own habits live and are the tier that
 *   will become editable per user.
 *
 * `household_id === null` marks a platform row; anything else belongs to the
 * household that made it.
 */
export function CategoriesModal({
  isOpen,
  onClose,
  categories,
  /** Narrows the list when opened from an income or expense form. */
  kind,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  kind?: "income" | "expense" | "transfer";
}) {
  const [query, setQuery] = React.useState("");

  // Clear the search each time it opens rather than reopening onto someone
  // else's half-typed filter.
  const [wasOpen, setWasOpen] = React.useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setQuery("");
  }

  const pool = React.useMemo(
    () => (kind ? categories.filter((c) => c.kind === kind) : categories),
    [categories, kind],
  );

  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const parents = pool.filter((c) => !c.parent_id).sort(byName);

    return parents
      .map((parent) => {
        const children = pool
          .filter((c) => c.parent_id === parent.id)
          .sort(byName);

        if (!q) return { parent, children };

        // A parent that matches keeps ALL of its children — you searched for the
        // group, so you want to see what is in it.
        if (parent.name.toLowerCase().includes(q)) return { parent, children };
        return {
          parent,
          children: children.filter((c) => c.name.toLowerCase().includes(q)),
          filtered: true,
        };
      })
      .filter((g) => !g.filtered || g.children.length > 0);
  }, [pool, query]);

  const total = pool.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Categories"
      subtitle={`${total} available${kind ? ` for ${kind}` : ""}`}
      icon={<Tags size={16} />}
      footer={
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search
            size={14}
            className="text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <Input
            placeholder="Search categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>

        {groups.length === 0 ? (
          <p className="text-muted py-6 text-center text-xs">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul className="space-y-3">
            {groups.map(({ parent, children }) => (
              <li
                key={parent.id}
                className="border-border overflow-hidden rounded-card border"
              >
                <div className="bg-surface-subtle border-border flex items-center gap-2.5 border-b px-3 py-2.5">
                  <CategoryChip
                    icon={parent.icon}
                    tone={parent.tone}
                    size={26}
                    iconSize={13}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-[12.5px] font-semibold">
                      {parent.name}
                    </p>
                    <p className="text-faint mt-0.5 flex items-center gap-1 text-[10.5px]">
                      <KindGlyph kind={parent.kind} />
                      <span className="italic">
                        {children.length}{" "}
                        {children.length === 1 ? "subcategory" : "subcategories"}
                      </span>
                    </p>
                  </div>

                  {/* Platform-owned. Stated, not silently unavailable. */}
                  <span
                    title="Platform category — the same for everyone, so reports stay comparable"
                    className="border-border text-faint hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex"
                  >
                    <Lock size={9} />
                    Platform
                  </span>
                  <EditStub label={`Edit ${parent.name}`} />
                </div>

                {children.length > 0 && (
                  <ul className="divide-border divide-y">
                    {children.map((child) => (
                      <li
                        key={child.id}
                        className="flex items-center gap-2.5 px-3 py-2"
                      >
                        <CategoryChip
                          icon={child.icon}
                          tone={child.tone}
                          size={22}
                          iconSize={11}
                        />
                        <span className="text-foreground-2 min-w-0 flex-1 truncate text-[12px]">
                          {child.name}
                        </span>
                        {child.household_id && (
                          <span className="bg-brass-soft text-brass-strong shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold">
                            Yours
                          </span>
                        )}
                        <EditStub label={`Edit ${child.name}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-faint text-[11px] italic leading-snug">
          Parent categories are set by the platform so reports and tax summaries
          mean the same thing for everyone. Editing your own subcategories is
          coming — the buttons are here and switched off until it is wired.
        </p>
      </div>
    </Modal>
  );
}

/** The disabled edit affordance. Present, explained, inert. */
function EditStub({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Editing categories is not available yet"
      aria-label={label}
      className={cn(
        "text-faint flex size-7 shrink-0 cursor-not-allowed items-center justify-center rounded-full opacity-50",
      )}
    >
      <Pencil size={13} strokeWidth={1.75} />
    </button>
  );
}

function KindGlyph({ kind }: { kind: Category["kind"] }) {
  if (kind === "income") {
    return <ArrowUpRight size={10} className="text-gain shrink-0" />;
  }
  if (kind === "expense") {
    return <ArrowDownRight size={10} className="text-loss shrink-0" />;
  }
  return <Tags size={10} className="shrink-0" />;
}

function byName(a: Category, b: Category) {
  return a.name.localeCompare(b.name);
}
