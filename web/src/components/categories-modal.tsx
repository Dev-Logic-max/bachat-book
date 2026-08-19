"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryFormModal } from "@/components/category-form-modal";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import {
  CategoryArt,
  CategoryIcon,
  categoryLabel,
  toneColor,
} from "@/components/category-icon";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { groupCatalogue, isCategoryOff, type Category } from "@/lib/categories";
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
  const [deleting, setDeleting] = React.useState<Category | null>(null);
  const [deleteUse, setDeleteUse] = React.useState<{
    transactions: number;
    budgets: number;
  } | null>(null);

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
    const all = groupCatalogue(categories, {
      kind,
      activeOnly: true,
      ownFirstFor: householdId,
      // A row you switched off has to stay on the screen that switches it back
      // on. Platform-retired rows still drop — those are not yours to restore.
      keepOwnInactiveFor: householdId,
    });
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
  }, [categories, kind, query, householdId]);

  const total = groups.reduce((n, g) => n + g.children.length + 1, 0);

  /*
   * Two mechanisms, one switch — see `isCategoryOff`. Your own rows carry
   * `is_active`; the platform defaults are listed in
   * `household_hidden_categories`, which has a trigger that refuses your own.
   */
  const toggleHidden = async (category: Category) => {
    const wasOff = isCategoryOff(category, hidden);

    if (category.household_id === householdId) {
      const { error } = await supabase
        .from("categories")
        .update({ is_active: wasOff })
        .eq("id", category.id)
        .eq("household_id", householdId);

      if (error) {
        showToast({
          type: "error",
          title: "Could not update",
          description: error.message,
        });
        return;
      }
      // No local copy to patch — `categories` is owned by the form behind this
      // sheet, so the refetch is what makes the change visible.
      onChanged?.();
      return;
    }

    setHidden((prev) => {
      const next = new Set(prev);
      if (wasOff) next.delete(category.id);
      else next.add(category.id);
      return next;
    });

    const { error } = wasOff
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
        if (wasOff) next.add(category.id);
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

  /*
   * Count what a delete would take with it BEFORE offering the button.
   *
   * `budgets.category_id` and `rules.category_id` are ON DELETE CASCADE, so
   * removing a category silently removes every budget pointing at it.
   * `transactions.category_id` is ON DELETE SET NULL, which is gentler but still
   * strips the label off past entries. Neither is something to discover after
   * the fact, so both are named in the dialog.
   */
  const requestDelete = async (category: Category) => {
    setDeleting(category);
    setDeleteUse(null);

    const [tx, bud] = await Promise.all([
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("category_id", category.id),
      supabase
        .from("budgets")
        .select("id", { count: "exact", head: true })
        .eq("category_id", category.id),
    ]);

    setDeleteUse({ transactions: tx.count ?? 0, budgets: bud.count ?? 0 });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", deleting.id);

    if (error) {
      showToast({
        type: "error",
        title: "Could not delete",
        description: error.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: `“${deleting.name}” deleted`,
      description:
        deleteUse && deleteUse.transactions > 0
          ? `${deleteUse.transactions} past ${deleteUse.transactions === 1 ? "entry" : "entries"} kept their amount and lost the label.`
          : undefined,
    });
    setDeleting(null);
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
                        const isHidden = isCategoryOff(child, hidden);
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

                            {/*
                              Three separate actions, each in its own colour.
                              An eye used to carry the on/off state, which reads
                              as "show me this" rather than "this exists" — and
                              it was the ONLY control on the row, so a
                              household's own subcategory could be created and
                              then never removed.

                              They differ in how far they go, so they must not
                              look alike: amber edits, grey switches off and is
                              reversible, red deletes and is not.
                            */}
                            <span className="flex shrink-0 items-center gap-0.5">
                              {isOwn && (
                                <IconAction
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
                                  label={`Edit ${child.name}`}
                                  tone="brass"
                                >
                                  <Pencil size={13} strokeWidth={1.75} />
                                </IconAction>
                              )}

                              <IconAction
                                disabled={readOnly}
                                onClick={() => toggleHidden(child)}
                                label={
                                  isHidden
                                    ? `Turn ${child.name} back on`
                                    : `Turn ${child.name} off`
                                }
                                title={
                                  isHidden
                                    ? "Off — turn it back on to see it in pickers"
                                    : "On — turn it off to drop it from your pickers. Past entries keep it."
                                }
                                tone={isHidden ? "muted" : "gain"}
                              >
                                {isHidden ? (
                                  <PowerOff size={13} strokeWidth={1.75} />
                                ) : (
                                  <Power size={13} strokeWidth={1.75} />
                                )}
                              </IconAction>

                              {isOwn && (
                                <IconAction
                                  disabled={readOnly}
                                  onClick={() => void requestDelete(child)}
                                  label={`Delete ${child.name}`}
                                  tone="loss"
                                >
                                  <Trash2 size={13} strokeWidth={1.75} />
                                </IconAction>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="text-faint space-y-1.5 text-[11px] leading-snug">
            <p className="italic">
              Main categories are set by Bachat Book so reports and tax summaries
              mean the same thing for everyone. Everything under them is yours.
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 not-italic">
              <span className="inline-flex items-center gap-1">
                <Power size={11} className="text-gain" /> on
              </span>
              <span className="inline-flex items-center gap-1">
                <PowerOff size={11} /> off — hidden from pickers, past entries keep it
              </span>
              <span className="inline-flex items-center gap-1">
                <Trash2 size={11} className="text-loss" /> gone for good
              </span>
            </p>
          </div>
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

      {/*
        No cascade choice. `budgets` and `rules` are ON DELETE CASCADE in the
        database — there is no "keep them" branch to offer — and transactions are
        SET NULL, which happens either way. The dialog's job here is to say so.
      */}
      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete this subcategory?"
        recordLabel={deleting ? categoryLabel(deleting, locale) : ""}
        recordMeta="Your own subcategory — deleting it cannot be undone."
        confirmLabel="Delete subcategory"
        defaultCascade={false}
        cascadeLabel=""
        linkedRefs={
          deleteUse
            ? [
                ...(deleteUse.transactions > 0
                  ? [
                      {
                        kind: "Past entries",
                        label: `${deleteUse.transactions} keep their amount and fall back to the main category`,
                      },
                    ]
                  : []),
                ...(deleteUse.budgets > 0
                  ? [
                      {
                        kind: "Budgets",
                        label: `${deleteUse.budgets} set against it will be removed`,
                      },
                    ]
                  : []),
              ]
            : []
        }
      />
    </>
  );
}

/** A small coloured action. Same 28px hit area as `RowActions` everywhere else. */
function IconAction({
  onClick,
  label,
  title,
  tone,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  title?: string;
  tone: "brass" | "gain" | "muted" | "loss";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "brass" && "text-brass-strong hover:bg-brass-soft",
        tone === "gain" && "text-gain hover:bg-gain-soft",
        tone === "muted" && "text-muted hover:bg-surface-3 hover:text-foreground",
        tone === "loss" && "text-loss/80 hover:text-loss hover:bg-loss-soft",
      )}
    >
      {children}
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
