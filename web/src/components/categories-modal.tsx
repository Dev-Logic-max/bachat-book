"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Plus,
  Search,
  Tags,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryFormModal } from "@/components/category-form-modal";
import {
  CategoryArt,
  CategoryIcon,
  categoryLabel,
  toneColor,
} from "@/components/category-icon";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { groupCatalogue, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

import type { CategoryDraft } from "@/components/category-form-modal";

/**
 * The category catalogue, reachable from beside the Category field so you can
 * check what exists — and now FIX what exists — without abandoning a half-filled
 * entry form. That was the whole reason the door was put here; it used to open
 * onto a read-only list, which meant discovering a missing category told you
 * about the problem and then made you go somewhere else to solve it.
 *
 * Two tiers, deliberately:
 *
 *   PARENTS are platform-wide and owned by the super admin. Reports, budgets and
 *   the tax surfaces all group by them, so a household renaming "Bills" would
 *   silently break comparisons across the platform. Marked with a lock, not
 *   hidden behind a disabled control with no explanation.
 *   SUBCATEGORIES are the household's. Its own are editable here; the seeded
 *   defaults can be switched off, because 126 of them is a list you stop reading
 *   rather than one you prune.
 */
export function CategoriesModal({
  isOpen,
  onClose,
  categories,
  householdId,
  /** Narrows the list when opened from an income or expense form. */
  kind,
  onChanged,
  readOnly = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  householdId: string;
  kind?: "income" | "expense" | "transfer";
  /** Fires after any write, so the form behind can refetch its picker. */
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const locale = useLocale();

  const [query, setQuery] = React.useState("");
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryDraft | null>(null);
  const [formParentId, setFormParentId] = React.useState<string | null>(null);

  // Clear the search each time it opens rather than reopening onto someone
  // else's half-typed filter.
  const [wasOpen, setWasOpen] = React.useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setQuery("");
  }

  React.useEffect(() => {
    if (!isOpen || !householdId) return;
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from("household_hidden_categories")
        .select("category_id")
        .eq("household_id", householdId);
      if (!active || error) return;
      setHidden(new Set((data ?? []).map((r) => r.category_id)));
    })();

    return () => {
      active = false;
    };
  }, [isOpen, householdId, supabase]);

  /*
   * Hidden rows are SHOWN here, greyed, rather than filtered out — this is the
   * screen you opened because something was missing, so the answer "it is here,
   * you switched it off" has to be reachable. Every actual PICKER drops them.
   */
  const groups = React.useMemo(() => {
    const all = groupCatalogue(categories, { kind, activeOnly: true });
    const q = query.trim().toLowerCase();
    if (!q) return all;

    const matches = (c: Category) =>
      c.name.toLowerCase().includes(q) ||
      (c.name_ur ?? "").toLowerCase().includes(q);

    return all
      .map((g) =>
        // A parent that matches keeps ALL of its children — you searched for the
        // group, so you want to see what is in it.
        matches(g.parent) ? g : { ...g, children: g.children.filter(matches) },
      )
      .filter((g) => matches(g.parent) || g.children.length > 0);
  }, [categories, kind, query]);

  const total = groups.reduce((n, g) => n + g.children.length + 1, 0);

  const toggleHidden = async (category: Category) => {
    const isHidden = hidden.has(category.id);

    setHidden((prev) => {
      const next = new Set(prev);
      if (isHidden) next.delete(category.id);
      else next.add(category.id);
      return next;
    });

    const { error } = isHidden
      ? await supabase
          .from("household_hidden_categories")
          .delete()
          .eq("household_id", householdId)
          .eq("category_id", category.id)
      : await supabase
          .from("household_hidden_categories")
          .insert({ household_id: householdId, category_id: category.id });

    if (error) {
      setHidden((prev) => {
        const next = new Set(prev);
        if (isHidden) next.add(category.id);
        else next.delete(category.id);
        return next;
      });
      showToast({
        type: "error",
        title: "Could not update",
        description: error.message,
      });
      return;
    }

    onChanged?.();
  };

  return (
    <>
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
                  <div
                    className="border-border flex items-center gap-2.5 border-b px-3 py-2.5"
                    style={{
                      background: `linear-gradient(to bottom, color-mix(in oklab, ${toneColor(parent.tone)} 8%, transparent), transparent)`,
                    }}
                  >
                    <CategoryArt category={parent} size={30} />

                    <div className="min-w-0 flex-1">
                      <p
                        dir="auto"
                        className="copy text-foreground truncate text-[12.5px] font-semibold"
                      >
                        {categoryLabel(parent, locale)}
                      </p>
                      <p className="text-faint mt-0.5 flex items-center gap-1 text-[10.5px]">
                        <KindGlyph kind={parent.kind} />
                        <span className="italic">
                          {children.length}{" "}
                          {children.length === 1
                            ? "subcategory"
                            : "subcategories"}
                        </span>
                      </p>
                    </div>

                    {/* Platform-owned. Stated, not silently unavailable. */}
                    <span
                      title="Set by Bachat Book — the same for everyone, so reports stay comparable"
                      className="border-border text-faint hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex"
                    >
                      <Lock size={9} />
                      Platform
                    </span>

                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        setEditing(null);
                        setFormParentId(parent.id);
                        setFormOpen(true);
                      }}
                      aria-label={`Add a category under ${parent.name}`}
                      title={
                        readOnly
                          ? "This workspace is read-only on your current plan"
                          : `Add under ${parent.name}`
                      }
                      className="text-brass-strong hover:bg-brass-soft flex size-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {children.length > 0 && (
                    <ul className="divide-border divide-y">
                      {children.map((child) => {
                        const isHidden = hidden.has(child.id);
                        const isOwn = child.household_id === householdId;

                        return (
                          <li
                            key={child.id}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2",
                              isHidden && "opacity-45",
                            )}
                          >
                            <span
                              className="flex size-5.5 shrink-0 items-center justify-center rounded-full"
                              style={{
                                background: `color-mix(in oklab, ${toneColor(child.tone)} 14%, transparent)`,
                                color: toneColor(child.tone),
                              }}
                            >
                              <CategoryIcon icon={child.icon} size={11} />
                            </span>

                            <span
                              dir="auto"
                              className={cn(
                                "copy text-foreground-2 min-w-0 flex-1 truncate text-[12px]",
                                isHidden && "line-through",
                              )}
                            >
                              {categoryLabel(child, locale)}
                            </span>

                            {isOwn && (
                              <span className="bg-brass-soft text-brass-strong shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold">
                                Yours
                              </span>
                            )}

                            {isOwn ? (
                              <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => {
                                  setEditing({
                                    id: child.id,
                                    name: child.name,
                                    name_ur: child.name_ur,
                                    icon: child.icon,
                                    parent_id: child.parent_id,
                                    kind: child.kind,
                                  });
                                  setFormParentId(null);
                                  setFormOpen(true);
                                }}
                                aria-label={`Edit ${child.name}`}
                                title={`Edit ${child.name}`}
                                className="text-muted hover:bg-surface-3 hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Pencil size={12} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => toggleHidden(child)}
                                aria-label={
                                  isHidden
                                    ? `Switch ${child.name} back on`
                                    : `Switch ${child.name} off`
                                }
                                title={
                                  isHidden
                                    ? "Switch back on"
                                    : "Switch off — it leaves your pickers, past entries keep it"
                                }
                                className="text-muted hover:bg-surface-3 hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isHidden ? (
                                  <Eye size={12} />
                                ) : (
                                  <EyeOff size={12} />
                                )}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="text-faint text-[11px] italic leading-snug">
            Main categories are set by Bachat Book so reports and tax summaries
            mean the same thing for everyone. Everything under them is yours —
            add your own, or switch off the ones you never use.
          </p>
        </div>
      </Modal>

      {/*
        Nested over this one, which is itself over a half-filled entry form.
        Modal keeps a stack precisely so Escape closes only the topmost and the
        form two layers down survives.
      */}
      <CategoryFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        categories={categories}
        householdId={householdId}
        category={editing}
        defaultParentId={formParentId}
        onSuccess={onChanged}
      />
    </>
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
