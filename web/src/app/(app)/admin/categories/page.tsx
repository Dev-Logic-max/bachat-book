"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  GripVertical,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/reveal";
import { useToast } from "@/components/ui/toast";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { AdminCategoryModal } from "@/components/admin-category-modal";
import { CategoryArt, toneColor } from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import {
  KIND_META,
  KIND_ORDER,
  byCatalogueOrder,
  type Category,
  type CategoryKind,
} from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * The platform category catalogue — the 26 MAIN categories every household
 * shares, plus the ~126 subcategories seeded under them.
 *
 * These rows had no screen at all. RLS has allowed `is_platform_admin()` to
 * write them since the catalogue was created, but the only way to exercise that
 * was raw SQL, which meant the one tier the product depends on for comparable
 * reporting was the one tier nobody could safely change.
 *
 * WHY IT SITS IN /admin AND NOT IN SETTINGS. A main category is shared by every
 * household on the platform: renaming "Bills" renames it for everyone, and
 * deleting one strips the label off other people's history. That is an operator
 * action, so it lives behind the same role guard as the rest of the console.
 *
 * Counts, not money. The same rule as the rest of /admin — this page reports how
 * many households have filed something under a category, never what.
 */
export default function AdminCategoriesPage() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [usage, setUsage] = React.useState<Map<string, number>>(() => new Map());
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [kind, setKind] = React.useState<CategoryKind>("expense");
  const [query, setQuery] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [formParentId, setFormParentId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<Category | null>(null);

  const reload = () => setRefreshKey((k) => k + 1);

  React.useEffect(() => {
    let active = true;

    async function load() {
      const [catRes, txRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order").order("name"),
        // How many households have used each one. Not amounts — the console
        // never loads money, and "is anyone relying on this" is the only
        // question a delete actually needs answered.
        supabase.from("transactions").select("category_id, household_id"),
      ]);

      if (!active) return;

      if (catRes.error) {
        showToast({
          type: "error",
          title: "Could not load the catalogue",
          description: catRes.error.message,
        });
        setLoading(false);
        return;
      }

      setCategories(catRes.data ?? []);

      const byCategory = new Map<string, Set<string>>();
      for (const row of txRes.data ?? []) {
        if (!row.category_id) continue;
        const set = byCategory.get(row.category_id) ?? new Set<string>();
        set.add(row.household_id);
        byCategory.set(row.category_id, set);
      }
      setUsage(new Map([...byCategory].map(([id, set]) => [id, set.size])));

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase, refreshKey, showToast]);

  /*
   * PLATFORM ROWS ONLY.
   *
   * Every household's own subcategories are visible to a super admin through
   * RLS, and showing them here would turn an operator screen into a window onto
   * what individual families call their spending. They are counted in the
   * header and never listed.
   */
  const platform = React.useMemo(
    () => categories.filter((c) => c.household_id === null),
    [categories],
  );
  const householdOwned = categories.length - platform.length;

  const counts = React.useMemo(() => {
    const out = {} as Record<CategoryKind, number>;
    for (const k of KIND_ORDER) {
      out[k] = platform.filter((c) => c.kind === k && !c.parent_id).length;
    }
    return out;
  }, [platform]);

  const groups = React.useMemo(() => {
    const parents = platform
      .filter((c) => c.kind === kind && !c.parent_id)
      .sort(byCatalogueOrder);

    const q = query.trim().toLowerCase();
    const matches = (c: Category) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.name_ur ?? "").toLowerCase().includes(q);

    return parents
      .map((parent) => ({
        parent,
        children: platform
          .filter((c) => c.parent_id === parent.id)
          .sort(byCatalogueOrder),
      }))
      .map((g) =>
        matches(g.parent) ? g : { ...g, children: g.children.filter(matches) },
      )
      .filter((g) => matches(g.parent) || g.children.length > 0);
  }, [platform, kind, query]);

  /** Switch a row off everywhere without deleting it. */
  const toggleActive = async (category: Category) => {
    const next = !category.is_active;

    setCategories((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, is_active: next } : c)),
    );

    const { error } = await supabase
      .from("categories")
      .update({ is_active: next })
      .eq("id", category.id);

    if (error) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === category.id ? { ...c, is_active: category.is_active } : c,
        ),
      );
      showToast({
        type: "error",
        title: "Could not update",
        description: error.message,
      });
      return;
    }

    showToast({
      type: "success",
      title: next ? `${category.name} switched on` : `${category.name} retired`,
      description: next
        ? "It is offered in every household's pickers again."
        : "It leaves every picker platform-wide. Entries already filed under it keep their label.",
    });
  };

  const handleDelete = async () => {
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
      title: `“${deleting.name}” deleted platform-wide`,
    });
    setDeleting(null);
    reload();
  };

  const deletingChildren = deleting
    ? categories.filter((c) => c.parent_id === deleting.id)
    : [];
  const deletingUse = deleting ? (usage.get(deleting.id) ?? 0) : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin"
            className="text-muted hover:text-foreground mb-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium transition-colors"
          >
            <ArrowLeft size={13} />
            Platform console
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display truncate text-[19px] font-semibold tracking-[-0.02em] sm:text-[22px]">
              Category catalogue
            </h1>
            <span className="bg-brass/20 text-brass-strong border-brass/40 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold">
              <ShieldCheck size={10} />
              Platform-wide
            </span>
          </div>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Shared by every household. Changing one here changes it for everyone,
            which is what keeps reports and tax summaries comparable.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormParentId(null);
            setFormOpen(true);
          }}
          className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 flex h-9 shrink-0 items-center gap-1.5 rounded-control px-3.5 text-[12.5px] font-semibold"
        >
          <Plus size={15} />
          <span className="hidden min-[380px]:inline">New main category</span>
          <span className="min-[380px]:hidden">New</span>
        </button>
      </header>

      <p className="border-border text-faint flex items-start gap-2 rounded-card border border-dashed px-3.5 py-2.5 text-[11.5px] italic leading-snug">
        <Users size={13} className="mt-0.5 shrink-0" />
        <span>
          {householdOwned} subcategor{householdOwned === 1 ? "y" : "ies"} created
          by households are deliberately not listed here — what a family calls
          its own spending is not an operator&apos;s business. Usage below is a
          count of households, never an amount.
        </span>
      </p>

      <Reveal index={0}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="bg-surface-subtle grid flex-1 grid-cols-3 gap-1 rounded-control p-1">
            {KIND_ORDER.map((k) => {
              const active = k === kind;
              const Glyph =
                k === "income"
                  ? ArrowUpRight
                  : k === "expense"
                    ? ArrowDownRight
                    : ArrowLeftRight;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-[7px] px-2 py-2 text-[12px] font-medium transition-colors",
                    active
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted hover:text-foreground-2",
                  )}
                >
                  <Glyph
                    size={13}
                    className={
                      k === "income"
                        ? "text-gain"
                        : k === "expense"
                          ? "text-loss"
                          : "text-brass-strong"
                    }
                  />
                  {KIND_META[k].label}
                  <span className="tnum text-faint">{counts[k] ?? 0}</span>
                </button>
              );
            })}
          </div>

          <div className="relative lg:w-72">
            <Search
              size={14}
              className="text-muted pointer-events-none absolute inset-s-3 top-1/2 -translate-y-1/2"
            />
            <Input
              placeholder="Search name or key…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ps-8 text-xs"
            />
          </div>
        </div>
      </Reveal>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-56 rounded-panel" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-muted py-10 text-center text-xs">
          Nothing matches “{query}”.
        </p>
      ) : (
        <Reveal index={1}>
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map(({ parent, children }) => (
              <ParentCard
                key={parent.id}
                parent={parent}
                subcategories={children}
                usage={usage}
                onEdit={(c) => {
                  setEditing(c);
                  setFormParentId(null);
                  setFormOpen(true);
                }}
                onAddChild={() => {
                  setEditing(null);
                  setFormParentId(parent.id);
                  setFormOpen(true);
                }}
                onDelete={setDeleting}
                onToggleActive={toggleActive}
              />
            ))}
          </div>
        </Reveal>
      )}

      <AdminCategoryModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setFormParentId(null);
        }}
        categories={categories}
        category={editing}
        defaultParentId={formParentId}
        defaultKind={kind}
        onSuccess={reload}
      />

      {/*
        The consequences are platform-wide and named one by one. `categories`
        cascades to its own children, to budgets and to rules; transactions are
        SET NULL. Nothing here offers a choice, because the database does not.
      */}
      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={
          deleting?.parent_id
            ? "Delete this subcategory for everyone?"
            : "Delete this main category for everyone?"
        }
        recordLabel={deleting?.name ?? ""}
        recordMeta={
          deleting
            ? `${deleting.id} · platform-wide · cannot be undone`
            : undefined
        }
        confirmLabel="Delete platform-wide"
        defaultCascade={false}
        cascadeLabel=""
        linkedRefs={[
          ...(deletingChildren.length > 0
            ? [
                {
                  kind: "Subcategories",
                  label: `${deletingChildren.length} under it are deleted too (${deletingChildren
                    .slice(0, 3)
                    .map((c) => c.name)
                    .join(", ")}${deletingChildren.length > 3 ? "…" : ""})`,
                },
              ]
            : []),
          ...(deletingUse > 0
            ? [
                {
                  kind: "Households",
                  label: `${deletingUse} ${deletingUse === 1 ? "has" : "have"} entries filed here — those keep their amount and lose the label`,
                },
              ]
            : []),
          {
            kind: "Budgets and rules",
            label: "Anything set against it, in any household, is removed",
          },
        ]}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ParentCard({
  parent,
  subcategories,
  usage,
  onEdit,
  onAddChild,
  onDelete,
  onToggleActive,
}: {
  parent: Category;
  subcategories: Category[];
  usage: Map<string, number>;
  onEdit: (c: Category) => void;
  onAddChild: () => void;
  onDelete: (c: Category) => void;
  onToggleActive: (c: Category) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const tint = toneColor(parent.tone);
  const shown = expanded ? subcategories : subcategories.slice(0, 6);
  const rest = subcategories.length - shown.length;

  return (
    <div
      className={cn(
        "bg-surface border-border shadow-xs flex h-full flex-col overflow-hidden rounded-panel border",
        !parent.is_active && "opacity-60",
      )}
    >
      <div
        className="border-border flex items-center gap-3 border-b px-4 py-3"
        style={{
          background: `linear-gradient(to bottom, color-mix(in oklab, ${tint} 7%, transparent), transparent)`,
        }}
      >
        <CategoryArt category={parent} size={42} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3
              dir="auto"
              className={cn(
                "copy text-foreground truncate text-[13.5px] font-semibold",
                !parent.is_active && "line-through",
              )}
            >
              {parent.name}
            </h3>
            {!parent.is_active && (
              <span className="border-border text-faint shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold">
                retired
              </span>
            )}
          </div>
          <p className="text-faint mt-0.5 flex items-center gap-1.5 truncate text-[10.5px]">
            {/* The key is shown here and nowhere else in the product. It is what
                an operator greps for, what a migration references, and what a
                seed file writes — the one audience it belongs to. */}
            <code className="ltr bg-surface-subtle rounded px-1 py-px text-[9.5px]">
              {parent.id}
            </code>
            <span className="tnum inline-flex items-center gap-1">
              <GripVertical size={9} />
              {parent.sort_order}
            </span>
          </p>
        </div>

        <span className="flex shrink-0 items-center gap-0.5">
          <Action label={`Edit ${parent.name}`} tone="brass" onClick={() => onEdit(parent)}>
            <Pencil size={13} strokeWidth={1.75} />
          </Action>
          <Action
            label={parent.is_active ? `Retire ${parent.name}` : `Restore ${parent.name}`}
            title={
              parent.is_active
                ? "Retire — it leaves every picker platform-wide, and past entries keep it"
                : "Restore it to every household's pickers"
            }
            tone={parent.is_active ? "gain" : "muted"}
            onClick={() => onToggleActive(parent)}
          >
            {parent.is_active ? (
              <Power size={13} strokeWidth={1.75} />
            ) : (
              <PowerOff size={13} strokeWidth={1.75} />
            )}
          </Action>
          <Action label={`Delete ${parent.name}`} tone="loss" onClick={() => onDelete(parent)}>
            <Trash2 size={13} strokeWidth={1.75} />
          </Action>
        </span>
      </div>

      <ul className="divide-border flex-1 divide-y">
        {shown.map((child) => {
          const used = usage.get(child.id) ?? 0;
          return (
            <li
              key={child.id}
              className={cn(
                "group/row hover:bg-surface-subtle/60 flex items-center gap-2.5 px-4 py-2 transition-colors",
                !child.is_active && "opacity-50",
              )}
            >
              <span className="min-w-0 flex-1">
                <span
                  dir="auto"
                  className={cn(
                    "copy text-foreground-2 block truncate text-[12px]",
                    !child.is_active && "line-through",
                  )}
                >
                  {child.name}
                </span>
                <code className="ltr text-faint block truncate text-[9.5px]">
                  {child.id}
                </code>
              </span>

              {used > 0 && (
                <span
                  title={`${used} household${used === 1 ? "" : "s"} have entries filed here`}
                  className="text-faint tnum shrink-0 text-[10px]"
                >
                  {used}
                </span>
              )}

              <span className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover/row:opacity-100 lg:group-focus-within/row:opacity-100">
                <Action label={`Edit ${child.name}`} tone="brass" onClick={() => onEdit(child)}>
                  <Pencil size={12} strokeWidth={1.75} />
                </Action>
                <Action
                  label={child.is_active ? `Retire ${child.name}` : `Restore ${child.name}`}
                  tone={child.is_active ? "gain" : "muted"}
                  onClick={() => onToggleActive(child)}
                >
                  {child.is_active ? (
                    <Power size={12} strokeWidth={1.75} />
                  ) : (
                    <PowerOff size={12} strokeWidth={1.75} />
                  )}
                </Action>
                <Action label={`Delete ${child.name}`} tone="loss" onClick={() => onDelete(child)}>
                  <Trash2 size={12} strokeWidth={1.75} />
                </Action>
              </span>
            </li>
          );
        })}

        {subcategories.length === 0 && (
          <li className="text-faint px-4 py-3 text-[11px] italic">
            No seeded subcategories.
          </li>
        )}
      </ul>

      <div className="border-border flex items-center justify-between gap-2 border-t px-2 py-1.5">
        {rest > 0 || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted hover:text-foreground rounded-control px-2 py-1 text-[11px] font-medium transition-colors"
          >
            {expanded ? "Show less" : `Show ${rest} more`}
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={onAddChild}
          className="text-brass-strong hover:bg-brass-soft flex items-center gap-1 rounded-control px-2 py-1 text-[11px] font-semibold transition-colors"
        >
          <Plus size={12} />
          Seed a subcategory
        </button>
      </div>
    </div>
  );
}

function Action({
  label,
  title,
  tone,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  tone: "brass" | "gain" | "muted" | "loss";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
        tone === "brass" && "text-brass-strong hover:bg-brass-soft",
        tone === "gain" && "text-gain hover:bg-gain-soft",
        tone === "muted" && "text-muted hover:bg-surface-3 hover:text-foreground",
        tone === "loss" && "text-loss/80 hover:bg-loss-soft hover:text-loss",
      )}
    >
      {children}
    </button>
  );
}
