"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Tags,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichSelect } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  CategoryArt,
  CategoryIcon,
  categoryLabel,
  toneColor,
} from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import {
  KIND_META,
  KIND_ORDER,
  byCatalogueOrder,
  isDuplicateName,
  isParent,
  makeCategoryId,
  type Category,
  type CategoryKind,
} from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

import type { SelectOption } from "@/components/ui/select";

/**
 * A curated glyph set for household-made subcategories.
 *
 * Not the whole of Lucide: a picker with 1,600 options is a search problem, and
 * the point of the icon is to make a row recognisable at a glance, which a
 * near-duplicate of its neighbour does not do. These are the shapes that
 * actually recur in a Pakistani household ledger.
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

export type CategoryDraft = {
  id: string;
  name: string;
  name_ur: string | null;
  icon: string;
  parent_id: string | null;
  kind: CategoryKind;
};

/**
 * Create or rename a household's own SUBcategory.
 *
 * Three things this deliberately does not ask:
 *
 * 1. THE KEY. There was a required "Category Key (ID)" field here. It is the
 *    primary key — an implementation detail wearing the clothes of a question,
 *    and one that let two people pick the same key and collide. It is derived
 *    from the name now, namespaced by household, and de-duplicated.
 * 2. THE TIER. A household cannot create a top-level category, so there is no
 *    "None (top-level)" option to offer. The parent field is required and the
 *    database refuses the row without it.
 * 3. THE TONE. Colour comes from the parent, which is what makes a group read as
 *    a group in the charts and in every list.
 */
export function CategoryFormModal({
  isOpen,
  onClose,
  categories,
  householdId,
  category = null,
  defaultParentId = null,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The full catalogue — needed for the parent list and the duplicate check. */
  categories: Category[];
  householdId: string;
  /** Present = edit mode. */
  category?: CategoryDraft | null;
  defaultParentId?: string | null;
  onSuccess?: () => void;
}) {
  const isEdit = Boolean(category);
  const supabase = createClient();
  const { showToast } = useToast();
  const locale = useLocale();

  const [name, setName] = React.useState("");
  const [nameUr, setNameUr] = React.useState("");
  const [kind, setKind] = React.useState<CategoryKind>("expense");
  const [parentId, setParentId] = React.useState("");
  const [icon, setIcon] = React.useState("Tag");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /*
   * Re-seed on open, and whenever the caller switches which row is being
   * edited. A state initialiser cannot do it — the component stays mounted
   * between openings — and React Compiler rejects setState inside useEffect.
   */
  const formKey = `${isOpen}:${category?.id ?? "new"}:${defaultParentId ?? ""}`;
  const [seededKey, setSeededKey] = React.useState(formKey);
  if (seededKey !== formKey) {
    setSeededKey(formKey);
    setError(null);
    if (isOpen) {
      if (category) {
        setName(category.name);
        setNameUr(category.name_ur ?? "");
        setKind(category.kind);
        setParentId(category.parent_id ?? "");
        setIcon(category.icon);
      } else {
        const seedParent = defaultParentId
          ? categories.find((c) => c.id === defaultParentId)
          : null;
        setName("");
        setNameUr("");
        setKind(seedParent?.kind ?? "expense");
        setParentId(seedParent?.id ?? "");
        setIcon(seedParent?.icon ?? "Tag");
      }
    }
  }

  const parents = React.useMemo(
    () =>
      categories
        .filter((c) => isParent(c) && c.kind === kind && c.is_active)
        .sort(byCatalogueOrder),
    [categories, kind],
  );

  const selectedParent = parents.find((p) => p.id === parentId) ?? null;

  /*
   * Switching kind orphans the chosen parent — Food is not on the income list.
   * Resolved by DERIVING during render rather than by an effect that calls
   * setParentId, which would be a synchronous setState in useEffect.
   */
  const effectiveParentId = selectedParent ? parentId : (parents[0]?.id ?? "");
  const effectiveParent =
    parents.find((p) => p.id === effectiveParentId) ?? null;

  const parentOptions: SelectOption[] = parents.map((p) => ({
    value: p.id,
    label: categoryLabel(p, locale),
    description: p.name_ur && locale !== "ur" ? p.name_ur : undefined,
    icon: <CategoryArt category={p} size={22} rounded="rounded-md" />,
    meta: (
      <span className="text-faint text-[10px]">
        {categories.filter((c) => c.parent_id === p.id).length}
      </span>
    ),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the category a name.");
      return;
    }
    if (!effectiveParentId) {
      setError("Choose which main category this sits under.");
      return;
    }
    if (isDuplicateName(categories, effectiveParentId, trimmed, category?.id)) {
      setError(
        `“${trimmed}” already exists under ${effectiveParent ? categoryLabel(effectiveParent, locale) : "this category"}.`,
      );
      return;
    }

    setSubmitting(true);

    const payload = {
      name: trimmed,
      // Empty means "no translation", which must be NULL so the label falls
      // back to the English name rather than rendering an empty string in Urdu.
      name_ur: nameUr.trim() || null,
      icon,
      // Colour follows the parent, so a group reads as a group in the charts.
      tone: effectiveParent?.tone ?? 1,
      parent_id: effectiveParentId,
      kind,
    };

    const { error: dbError } = isEdit
      ? await supabase
          .from("categories")
          .update(payload)
          .eq("id", category!.id)
          // Belt and braces against a mis-typed id reaching a platform row; RLS
          // refuses it anyway.
          .eq("household_id", householdId)
      : await supabase.from("categories").insert({
          ...payload,
          id: makeCategoryId(
            householdId,
            trimmed,
            new Set(categories.map((c) => c.id)),
          ),
          household_id: householdId,
        });

    setSubmitting(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    showToast({
      type: "success",
      title: isEdit ? "Category updated" : "Category added",
      description: `“${trimmed}” is under ${effectiveParent ? categoryLabel(effectiveParent, locale) : "its category"}.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit category" : "New category"}
      subtitle={
        isEdit
          ? "Your own category — rename it, move it, or change its glyph"
          : "Sits under one of the main categories"
      }
      icon={<Tags size={16} />}
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
        {/* ---- Kind: a segmented control, not a dropdown ------------------
            Three options with real consequences (which parents are offered,
            and which way the money moves) deserve to be visible at once
            rather than hidden behind a click. */}
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
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-[7px] px-2 py-2 text-[11.5px] font-medium transition-colors",
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
          <p className="text-faint text-[11px]">{KIND_META[kind].hint}</p>
        </fieldset>

        {/* ---- Parent -------------------------------------------------- */}
        <RichSelect
          label="Main category"
          value={effectiveParentId}
          onChange={setParentId}
          options={parentOptions}
          placeholder="Choose a main category…"
          emptyMessage="No main categories for this kind"
          hint="Set by the platform, so reports mean the same thing for everyone."
        />

        {/* ---- Names --------------------------------------------------- */}
        <Input
          label="Name"
          placeholder="e.g. Chai Dhaba"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
        />

        <Input
          label="Urdu name (optional)"
          placeholder="مثلاً چائے ڈھابہ"
          value={nameUr}
          onChange={(e) => setNameUr(e.target.value)}
          maxLength={60}
          dir="auto"
          className="copy"
          // Left blank the row shows its English name in Urdu too, which is the
          // honest outcome — better than a blank cell.
        />

        {/* ---- Icon ----------------------------------------------------- */}
        <div className="space-y-1.5">
          <span className="text-foreground-2 block text-xs font-medium">
            Glyph
          </span>
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
                          background: `color-mix(in oklab, ${toneColor(effectiveParent?.tone)} 16%, transparent)`,
                          color: toneColor(effectiveParent?.tone),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          ["--tw-ring-color" as any]: toneColor(
                            effectiveParent?.tone,
                          ),
                        }
                      : undefined
                  }
                >
                  <CategoryIcon icon={choice} size={15} />
                </button>
              );
            })}
          </div>
          <p className="text-faint text-[11px]">
            Colour comes from the main category, so the group stays readable as
            one block in reports.
          </p>
        </div>

        {/* ---- Preview --------------------------------------------------
            The row exactly as it will appear in the entry form's picker. A
            name plus a glyph plus an inherited tone is three decisions whose
            combined result is not obvious from three separate controls. */}
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
                  art_path: null,
                  tone: effectiveParent?.tone ?? 1,
                }}
                size={30}
                rounded="rounded-full"
              />
              <span className="min-w-0">
                <span className="text-foreground block truncate text-[12.5px] font-medium">
                  {locale === "ur" && nameUr.trim()
                    ? nameUr.trim()
                    : name.trim()}
                </span>
                <span className="text-faint block truncate text-[10.5px]">
                  {effectiveParent
                    ? categoryLabel(effectiveParent, locale)
                    : "No main category"}
                </span>
              </span>
              <Check size={14} className="text-brass-strong ms-auto shrink-0" />
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
