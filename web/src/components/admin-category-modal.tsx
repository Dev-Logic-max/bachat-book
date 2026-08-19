"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { CategoryArt, CategoryIcon, toneColor } from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import {
  KIND_META,
  KIND_ORDER,
  byCatalogueOrder,
  type Category,
  type CategoryKind,
} from "@/lib/categories";
import { cn } from "@/lib/utils";

import type { SelectOption } from "@/components/ui/select";

/**
 * A wider glyph set than the household form gets.
 *
 * A household picks an icon for one row it invented; an operator is picking the
 * face of a category that appears in every screenshot, every report and every
 * picker on the platform. The extra shapes are the ones a top-level category
 * needs and a subcategory rarely does.
 */
const ICON_CHOICES = [
  "Tag", "ShoppingBasket", "UtensilsCrossed", "Carrot", "Beef", "Milk",
  "CupSoda", "CakeSlice", "Zap", "Flame", "Droplets", "Wifi",
  "Smartphone", "Fuel", "Car", "Bike", "Bus", "Wrench",
  "House", "KeyRound", "Armchair", "Hammer", "Shirt", "ShoppingBag",
  "Gift", "Package", "Stethoscope", "Pill", "HeartPulse", "GraduationCap",
  "BookOpen", "NotebookPen", "Users", "Baby", "PawPrint", "Scissors",
  "Dumbbell", "Sparkles", "Tv", "Gamepad2", "Plane", "Hotel",
  "Moon", "PartyPopper", "HandHeart", "HandCoins", "Landmark", "Percent",
  "CreditCard", "Briefcase", "Store", "Laptop", "TrendingUp", "PiggyBank",
  "Banknote", "Wallet", "ReceiptText", "FileText", "Globe", "Wheat",
];

/** The tones `toneColor` knows about. Colour is a real field at this tier. */
const TONE_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Create or edit a PLATFORM category — a row every household on the service
 * shares.
 *
 * Three fields exist here that the household form deliberately hides, because at
 * this tier they are genuine decisions rather than implementation details:
 *
 *  - THE KEY. It is the primary key, it is referenced by seeds and migrations,
 *    and it is what an operator greps for. It is asked for on create and locked
 *    on edit — renaming a key would orphan every transaction pointing at it, and
 *    Postgres would not stop you.
 *  - SORT ORDER. The seed encodes how often a Pakistani household reaches for
 *    each category: Food at 10, Tax at 160. Nothing may sort this catalogue by
 *    name, so the number is the only thing deciding what a picker opens on.
 *  - TONE. At the parent tier colour is inherited by every child, so it is what
 *    makes a group read as one block in the charts.
 */
export function AdminCategoryModal({
  isOpen,
  onClose,
  categories,
  category = null,
  defaultParentId = null,
  defaultKind = "expense",
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  /** Present = edit mode. */
  category?: Category | null;
  /** Present = creating a subcategory under this parent. */
  defaultParentId?: string | null;
  defaultKind?: CategoryKind;
  onSuccess?: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const isEdit = Boolean(category);

  const [id, setId] = React.useState("");
  const [name, setName] = React.useState("");
  const [nameUr, setNameUr] = React.useState("");
  const [kind, setKind] = React.useState<CategoryKind>(defaultKind);
  const [parentId, setParentId] = React.useState("");
  const [icon, setIcon] = React.useState("Tag");
  const [tone, setTone] = React.useState(1);
  const [sortOrder, setSortOrder] = React.useState("1000");
  const [artPath, setArtPath] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed on open / when the target changes. The component stays mounted
  // between openings, and React Compiler rejects a setState inside useEffect.
  const formKey = `${isOpen}:${category?.id ?? "new"}:${defaultParentId ?? ""}:${defaultKind}`;
  const [seeded, setSeeded] = React.useState(formKey);
  if (seeded !== formKey) {
    setSeeded(formKey);
    setError(null);
    if (isOpen) {
      if (category) {
        setId(category.id);
        setName(category.name);
        setNameUr(category.name_ur ?? "");
        setKind(category.kind);
        setParentId(category.parent_id ?? "");
        setIcon(category.icon);
        setTone(category.tone ?? 1);
        setSortOrder(String(category.sort_order));
        setArtPath(category.art_path ?? "");
      } else {
        const seedParent = defaultParentId
          ? (categories.find((c) => c.id === defaultParentId) ?? null)
          : null;
        setId("");
        setName("");
        setNameUr("");
        setKind(seedParent?.kind ?? defaultKind);
        setParentId(seedParent?.id ?? "");
        setIcon(seedParent?.icon ?? "Tag");
        setTone(seedParent?.tone ?? 1);
        // Subcategories step in tens like the seed; parents land at the end of
        // their kind rather than in the middle of a hand-tuned order.
        setSortOrder(seedParent ? "1000" : "900");
        setArtPath("");
      }
    }
  }

  const parents = React.useMemo(
    () =>
      categories
        .filter((c) => c.household_id === null && !c.parent_id && c.kind === kind)
        .sort(byCatalogueOrder),
    [categories, kind],
  );

  const isSubcategory = Boolean(parentId);
  const selectedParent = parents.find((p) => p.id === parentId) ?? null;

  const parentOptions: SelectOption[] = [
    {
      value: "",
      label: "None — this is a main category",
      description: "Top tier. Reports and budgets group by these.",
    },
    ...parents.map((p) => ({
      value: p.id,
      label: p.name,
      secondaryLabel: p.name_ur ?? undefined,
      icon: <CategoryArt category={p} size={22} rounded="rounded-md" />,
    })),
  ];

  /** Slug suggestion, only ever used to PREFILL an empty key on create. */
  const suggestedId = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  const effectiveId = (id.trim() || suggestedId).toLowerCase();
  const idTaken =
    !isEdit && effectiveId.length > 0 && categories.some((c) => c.id === effectiveId);

  const effectiveTone = selectedParent ? (selectedParent.tone ?? 1) : tone;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give the category a name.");
      return;
    }
    if (!isEdit && !effectiveId) {
      setError("Give the category a key.");
      return;
    }
    if (idTaken) {
      setError(`The key “${effectiveId}” is already taken.`);
      return;
    }
    if (!/^[a-z0-9_]+$/.test(effectiveId)) {
      setError("Keys are lowercase letters, numbers and underscores only.");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: trimmedName,
      name_ur: nameUr.trim() || null,
      icon,
      // A subcategory inherits its parent's colour, so a group stays one block
      // in the charts. Only a top-level row gets to choose.
      tone: effectiveTone,
      parent_id: parentId || null,
      kind,
      sort_order: Number(sortOrder) || 1000,
      art_path: artPath.trim() || null,
    };

    const { error: dbError } = isEdit
      ? await supabase
          .from("categories")
          .update(payload)
          .eq("id", category!.id)
          // Platform rows only. A mis-aimed id must never reach a household's
          // own subcategory from the operator console; RLS allows it, and this
          // screen has no business doing it.
          .is("household_id", null)
      : await supabase
          .from("categories")
          .insert({ ...payload, id: effectiveId, household_id: null });

    setSubmitting(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    showToast({
      type: "success",
      title: isEdit ? "Catalogue updated" : "Category added platform-wide",
      description: `“${trimmedName}” is live for every household.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit platform category" : "New platform category"}
      subtitle={
        isEdit
          ? "Every household sees this change"
          : "Shared by every household on the service"
      }
      icon={<ShieldCheck size={16} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {isEdit ? "Save changes" : "Create category"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="border-brass/40 bg-brass-soft text-foreground-2 flex items-start gap-2 rounded-card border px-3 py-2.5 text-[11.5px] leading-snug">
          <TriangleAlert size={13} className="text-brass-strong mt-0.5 shrink-0" />
          <span>
            This row is shared. Renaming it renames it on every household&apos;s
            screen, and retiring it removes it from every picker — past entries
            keep whatever they were filed under either way.
          </span>
        </p>

        {/* ---- Kind ----------------------------------------------------- */}
        <fieldset className="space-y-1.5">
          <legend className="text-foreground-2 mb-1.5 block text-xs font-medium">
            What kind of movement?
          </legend>
          <div className="bg-surface-subtle grid grid-cols-3 gap-1 rounded-control p-1">
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
                  disabled={isSubcategory}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-[7px] px-2 py-2 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    active
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted hover:text-foreground-2",
                  )}
                >
                  <Glyph
                    size={14}
                    className={
                      k === "income"
                        ? "text-gain"
                        : k === "expense"
                          ? "text-loss"
                          : "text-brass-strong"
                    }
                  />
                  {KIND_META[k].label}
                </button>
              );
            })}
          </div>
          <p className="text-faint text-[11px]">
            {isSubcategory
              ? "Follows the parent — the database refuses a subcategory whose kind disagrees."
              : KIND_META[kind].hint}
          </p>
        </fieldset>

        {/* ---- Tier ------------------------------------------------------ */}
        <RichSelect
          label="Sits under"
          value={parentId}
          onChange={setParentId}
          options={parentOptions}
          searchable={parents.length > 8}
          searchPlaceholder="Search main categories…"
          dense
          hint="Two tiers only. A subcategory of a subcategory breaks every report that groups by parent."
        />

        {/* ---- Names ----------------------------------------------------- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            placeholder="e.g. Bills"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            autoFocus
          />
          <Input
            label="Urdu name"
            placeholder="مثلاً بل"
            value={nameUr}
            onChange={(e) => setNameUr(e.target.value)}
            maxLength={60}
            dir="auto"
            className="copy"
            hint="Shown beside the English name in every picker."
          />
        </div>

        {/* ---- Key ------------------------------------------------------- */}
        <Input
          label="Key"
          placeholder={suggestedId || "e.g. bills"}
          value={id}
          onChange={(e) => setId(e.target.value)}
          disabled={isEdit}
          className="ltr"
          error={idTaken ? `“${effectiveId}” is already taken.` : undefined}
          hint={
            isEdit
              ? "Locked. Changing a key would orphan every entry pointing at it, and Postgres would not stop you."
              : `The primary key — lowercase, underscores. Leave blank to use “${suggestedId || "…"}”.`
          }
        />

        {/* ---- Order and art ---------------------------------------------- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Sort order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="tnum"
            hint="Lower comes first. The seed steps in tens; households default to 1000."
          />
          <Input
            label="Art path (optional)"
            placeholder="/categories/bills.png"
            value={artPath}
            onChange={(e) => setArtPath(e.target.value)}
            className="ltr"
            hint="Falls back to the glyph until the render exists."
          />
        </div>

        {/* ---- Tone ------------------------------------------------------- */}
        <div className="space-y-1.5">
          <span className="text-foreground-2 block text-xs font-medium">
            Colour
          </span>
          <div className="flex flex-wrap gap-1.5">
            {TONE_CHOICES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                disabled={isSubcategory}
                aria-pressed={effectiveTone === t}
                aria-label={`Tone ${t}`}
                className={cn(
                  "size-7 rounded-full transition-transform disabled:cursor-not-allowed disabled:opacity-50",
                  effectiveTone === t && "ring-2 ring-offset-2 ring-offset-transparent",
                )}
                style={{
                  background: toneColor(t),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["--tw-ring-color" as any]: toneColor(t),
                }}
              />
            ))}
          </div>
          <p className="text-faint text-[11px]">
            {isSubcategory
              ? "Inherited from the parent, so the group reads as one block in reports."
              : "Every subcategory under this one inherits it."}
          </p>
        </div>

        {/* ---- Glyph ------------------------------------------------------ */}
        <div className="space-y-1.5">
          <span className="text-foreground-2 block text-xs font-medium">Glyph</span>
          <div
            role="radiogroup"
            aria-label="Category glyph"
            className="border-border bg-surface-subtle/50 scroll-hidden grid max-h-[132px] grid-cols-10 gap-1 overflow-y-auto rounded-control border p-2"
          >
            {ICON_CHOICES.map((choice) => {
              const active = choice === icon;
              return (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={choice}
                  title={choice}
                  onClick={() => setIcon(choice)}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md transition-colors",
                    active
                      ? "ring-2"
                      : "text-muted hover:bg-surface hover:text-foreground-2",
                  )}
                  style={
                    active
                      ? {
                          background: `color-mix(in oklab, ${toneColor(effectiveTone)} 16%, transparent)`,
                          color: toneColor(effectiveTone),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          ["--tw-ring-color" as any]: toneColor(effectiveTone),
                        }
                      : undefined
                  }
                >
                  <CategoryIcon icon={choice} size={15} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Preview ----------------------------------------------------- */}
        {name.trim() && (
          <div className="border-border bg-surface-subtle rounded-card border p-3">
            <p className="text-faint mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
              Preview
            </p>
            <div className="flex items-center gap-2.5">
              <CategoryArt
                category={{
                  name: name.trim(),
                  icon,
                  art_path: artPath.trim() || null,
                  tone: effectiveTone,
                }}
                size={34}
              />
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-[12.5px] font-medium">
                  {name.trim()}
                </span>
                <span className="text-faint ltr block truncate text-[10.5px]">
                  {effectiveId || "no key yet"}
                  {selectedParent ? ` · under ${selectedParent.name}` : " · main category"}
                </span>
              </span>
              {nameUr.trim() && (
                <span dir="auto" className="copy text-faint shrink-0 text-[11.5px]">
                  {nameUr.trim()}
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="text-loss text-[11.5px] font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
