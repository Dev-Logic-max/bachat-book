"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { CategoryFormModal } from "@/components/category-form-modal";
import {
  CategoryArt,
  CategoryIcon,
  categoryLabel,
  toneColor,
} from "@/components/category-icon";
import { Reveal } from "@/components/reveal";
import { Skeleton } from "@/components/skeleton";
import { createClient } from "@/lib/supabase/client";
import {
  KIND_META,
  KIND_ORDER,
  groupCatalogue,
  type Category,
  type CategoryKind,
} from "@/lib/categories";
import { cn } from "@/lib/utils";

import type { CategoryDraft } from "@/components/category-form-modal";

/**
 * Settings → Categories.
 *
 * The catalogue has two tiers and they are owned by different people, so the
 * screen has to make that obvious without saying it twice on every row:
 *
 *   MAIN categories are the platform's — 16 for expense, 6 for income, 4 for
 *   transfer. They carry the rendered art, they are what reports group by, and
 *   the only affordance on them here is a lock chip explaining why.
 *   SUBCATEGORIES are the household's tier. Its own are editable and deletable;
 *   the seeded defaults can be switched off, because 126 of them is a list you
 *   stop reading rather than one you prune.
 *
 * Ordered by `sort_order`, NOT alphabetically. The seed puts Food first and Tax
 * last because that is the order people reach for them; sorting by name would
 * open the screen on "Bills" and bury the category most sessions start with.
 */
export default function CategorySettingsPage() {
  const supabase = createClient();
  const session = useSession();
  const { showToast } = useToast();
  const locale = useLocale();

  const householdId = session.household?.id ?? "";
  const readOnly = session.workspace ? !session.workspace.is_active : false;

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [kind, setKind] = React.useState<CategoryKind>("expense");
  const [query, setQuery] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryDraft | null>(null);
  const [formParentId, setFormParentId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<Category | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const reload = () => setRefreshKey((k) => k + 1);

  React.useEffect(() => {
    if (!householdId) return;
    let active = true;

    async function load() {
      const [catRes, hiddenRes] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("household_hidden_categories")
          .select("category_id")
          .eq("household_id", householdId),
      ]);

      if (!active) return;

      // Surfaced separately from "no rows": a failed query wearing the empty
      // state's clothes is how Transactions rendered "none found" for every
      // household for a week.
      if (catRes.error) {
        showToast({
          type: "error",
          title: "Could not load categories",
          description: catRes.error.message,
        });
        setLoading(false);
        return;
      }

      setCategories(catRes.data ?? []);
      setHidden(new Set((hiddenRes.data ?? []).map((r) => r.category_id)));
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [householdId, supabase, refreshKey, showToast]);

  const counts = React.useMemo(() => {
    const out = {} as Record<CategoryKind, number>;
    for (const k of KIND_ORDER) {
      out[k] = categories.filter((c) => c.kind === k && !c.parent_id).length;
    }
    return out;
  }, [categories]);

  /*
   * Hidden rows are INCLUDED here — this is the one screen that must show them,
   * because it is the only place they can be switched back on. Every picker
   * passes `hiddenIds` and drops them.
   */
  const groups = React.useMemo(() => {
    const all = groupCatalogue(categories, { kind });
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

  const toggleHidden = async (category: Category) => {
    const isHidden = hidden.has(category.id);

    // Optimistic: this is a visibility preference, and a picker that lags a
    // click behind feels broken in a way a toast cannot repair.
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
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", deleting.id)
      .eq("household_id", householdId);

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
      title: "Category deleted",
      description: `“${deleting.name}” is gone. Past entries kept their record and now show no category.`,
    });
    setDeleting(null);
    reload();
  };

  const openNew = (parentId: string | null) => {
    setEditing(null);
    setFormParentId(parentId);
    setFormOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing({
      id: c.id,
      name: c.name,
      name_ur: c.name_ur,
      icon: c.icon,
      parent_id: c.parent_id,
      kind: c.kind,
    });
    setFormParentId(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* ---- Header ------------------------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">
            Categories
          </h2>
          <p className="text-muted mt-0.5 text-[12.5px]">
            Main categories are set by Bachat Book. Everything under them is
            yours to shape.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNew(null)}
          disabled={readOnly}
          title={
            readOnly
              ? "This workspace is read-only on your current plan"
              : undefined
          }
          className="bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900 flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-medium transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} />
          New category
        </button>
      </div>

      {/* ---- Kind + search ----------------------------------------------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                <span>{KIND_META[k].label}</span>
                <span className="text-faint tnum text-[10.5px]">
                  {counts[k] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-64">
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
      </div>

      {/* ---- Catalogue ---------------------------------------------------- */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-panel" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-muted border-border rounded-panel border border-dashed py-10 text-center text-xs">
          Nothing matches “{query}”.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map(({ parent, children }, i) => (
            <Reveal key={parent.id} index={Math.min(i, 8)}>
              <ParentCard
                parent={parent}
                subcategories={children}
                hidden={hidden}
                locale={locale}
                householdId={householdId}
                readOnly={readOnly}
                onAdd={() => openNew(parent.id)}
                onEdit={openEdit}
                onDelete={setDeleting}
                onToggleHidden={toggleHidden}
              />
            </Reveal>
          ))}
        </div>
      )}

      <p className="text-faint text-[11px] italic leading-snug">
        Main categories are the same for everyone so reports and tax summaries
        compare like with like. Switching a default subcategory off removes it
        from your pickers — anything already filed under it keeps its record.
      </p>

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
        onSuccess={reload}
      />

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete this category?"
        recordLabel={deleting ? categoryLabel(deleting, locale) : ""}
        // The cascades are real and worth naming: budgets and rules pointing at
        // this category go with it, while transactions survive and simply lose
        // their label. Guessing which of those happens is not the user's job.
        recordMeta={
          deleting
            ? "Entries filed here keep their record and show no category. Any budget or rule on it is removed."
            : undefined
        }
        confirmLabel="Delete category"
      />
    </div>
  );
}

/** One main category and everything filed under it. */
function ParentCard({
  parent,
  subcategories,
  hidden,
  locale,
  householdId,
  readOnly,
  onAdd,
  onEdit,
  onDelete,
  onToggleHidden,
}: {
  parent: Category;
  subcategories: Category[];
  hidden: ReadonlySet<string>;
  locale: string;
  householdId: string;
  readOnly: boolean;
  onAdd: () => void;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
  onToggleHidden: (c: Category) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const tint = toneColor(parent.tone);

  const liveCount = subcategories.filter((c) => !hidden.has(c.id)).length;
  const hiddenCount = subcategories.length - liveCount;

  // Six is about what fits before the card stops being scannable. The rest are
  // one click away rather than behind a scrollbar inside a card.
  const shown = expanded ? subcategories : subcategories.slice(0, 6);

  return (
    <div className="bg-surface border-border rounded-panel shadow-xs flex h-full flex-col overflow-hidden border">
      {/* Head — the art carries the identity, tinted to the category's tone. */}
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
              className="copy text-foreground truncate text-[13.5px] font-semibold"
            >
              {categoryLabel(parent, locale)}
            </h3>
            <span
              title="Set by Bachat Book — the same for everyone, so reports stay comparable"
              className="text-faint shrink-0"
            >
              <Lock size={10} />
            </span>
          </div>
          <p className="text-faint mt-0.5 truncate text-[10.5px]">
            {/* The other language's name, so the pair is legible either way. */}
            {locale === "ur" ? parent.name : (parent.name_ur ?? "")}
            {(locale === "ur" || parent.name_ur) && " · "}
            <span className="tnum">{liveCount}</span> in use
            {hiddenCount > 0 && (
              <>
                {" · "}
                <span className="tnum">{hiddenCount}</span> off
              </>
            )}
          </p>
        </div>
      </div>

      {/* Subcategories */}
      <ul className="divide-border flex-1 divide-y">
        {shown.map((child) => {
          const isHidden = hidden.has(child.id);
          const isOwn = child.household_id === householdId;

          return (
            <li
              key={child.id}
              className={cn(
                "group/row flex items-center gap-2.5 px-4 py-2 transition-colors",
                isHidden ? "opacity-45" : "hover:bg-surface-subtle/60",
              )}
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `color-mix(in oklab, ${toneColor(child.tone)} 14%, transparent)`,
                  color: toneColor(child.tone),
                }}
              >
                <CategoryIcon icon={child.icon} size={12} />
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
                Actions are always in the DOM and revealed on hover or focus —
                rendering them conditionally changes the row height and makes the
                whole list twitch as the pointer moves down it. They stay visible
                on touch, where there is no hover to reveal them with.
              */}
              <span className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover/row:opacity-100 lg:group-focus-within/row:opacity-100">
                {isOwn ? (
                  <>
                    <IconButton
                      label={`Edit ${child.name}`}
                      onClick={() => onEdit(child)}
                      disabled={readOnly}
                    >
                      <Pencil size={12} />
                    </IconButton>
                    <IconButton
                      label={`Delete ${child.name}`}
                      onClick={() => onDelete(child)}
                      disabled={readOnly}
                      tone="loss"
                    >
                      <Trash2 size={12} />
                    </IconButton>
                  </>
                ) : (
                  <IconButton
                    label={
                      isHidden
                        ? `Switch ${child.name} back on`
                        : `Switch ${child.name} off`
                    }
                    onClick={() => onToggleHidden(child)}
                    disabled={readOnly}
                  >
                    {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                  </IconButton>
                )}
              </span>
            </li>
          );
        })}

        {subcategories.length === 0 && (
          <li className="text-faint px-4 py-3 text-[11px] italic">
            Nothing under this yet.
          </li>
        )}
      </ul>

      {/* Foot */}
      <div className="border-border flex items-center justify-between gap-2 border-t px-2 py-1.5">
        {subcategories.length > 6 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted hover:text-foreground rounded-control px-2 py-1 text-[11px] font-medium transition-colors"
          >
            {expanded ? "Show less" : `Show all ${subcategories.length}`}
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={onAdd}
          disabled={readOnly}
          className="text-brass-strong hover:bg-brass-soft flex items-center gap-1 rounded-control px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "loss";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "loss"
          ? "text-muted hover:bg-loss-soft hover:text-loss"
          : "text-muted hover:bg-surface-3 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
