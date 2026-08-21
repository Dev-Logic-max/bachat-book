"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  ArrowLeftRight,
  Armchair,
  Baby,
  Banknote,
  Beef,
  Bike,
  BookMarked,
  BookOpen,
  Briefcase,
  Building,
  Bus,
  CakeSlice,
  Car,
  CarFront,
  Carrot,
  CircleParking,
  Clapperboard,
  CreditCard,
  CupSoda,
  Droplets,
  Dumbbell,
  Eye,
  FileText,
  Flame,
  Flower,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Hammer,
  HandCoins,
  HandHeart,
  Heart,
  HeartPulse,
  Hotel,
  House,
  KeyRound,
  Landmark,
  Laptop,
  Map,
  MapPinned,
  Milk,
  Moon,
  NotebookPen,
  Package,
  Palette,
  PartyPopper,
  PawPrint,
  Percent,
  Vault,
  Pill,
  Plane,
  ReceiptText,
  School,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Tag,
  TestTube,
  Ticket,
  TrendingUp,
  TriangleAlert,
  Tv,
  Undo2,
  Users,
  UtensilsCrossed,
  Wallet,
  WashingMachine,
  Wheat,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

/**
 * categories.icon holds a Lucide component NAME as text. Mapped explicitly rather
 * than resolved dynamically: a dynamic lookup would pull the entire Lucide bundle
 * into the client for the sake of eighty glyphs.
 *
 * Every name below is one that actually exists in the categories table. If a
 * category is seeded with an unmapped icon it falls back to Tag rather than
 * rendering nothing.
 */
const ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Armchair,
  Baby,
  Banknote,
  Beef,
  Bike,
  BookMarked,
  BookOpen,
  Briefcase,
  Building,
  Bus,
  CakeSlice,
  Car,
  CarFront,
  Carrot,
  CircleParking,
  Clapperboard,
  CreditCard,
  CupSoda,
  Droplets,
  Dumbbell,
  Eye,
  FileText,
  Flame,
  Flower,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Hammer,
  HandCoins,
  HandHeart,
  Heart,
  HeartPulse,
  Hotel,
  House,
  KeyRound,
  Landmark,
  Laptop,
  Map,
  MapPinned,
  Milk,
  Moon,
  NotebookPen,
  Package,
  Palette,
  PartyPopper,
  PawPrint,
  Percent,
  Vault,
  Pill,
  Plane,
  ReceiptText,
  School,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Tag,
  TestTube,
  Ticket,
  TrendingUp,
  TriangleAlert,
  Tv,
  Undo2,
  Users,
  UtensilsCrossed,
  Wallet,
  WashingMachine,
  Wheat,
  Wifi,
  Wrench,
  Zap,
};

/** categories.tone is 1–6 and maps onto the chart palette. */
export function toneColor(tone: number | null | undefined): string {
  const n = tone && tone >= 1 && tone <= 6 ? tone : 1;
  return `var(--chart-${n})`;
}

/** The shape every category surface needs. Accepts a full row or a subset. */
export type CategoryLike = {
  name: string;
  name_ur?: string | null;
  icon?: string | null;
  art_path?: string | null;
  tone?: number | null;
};

/**
 * The label to render, for the active language.
 *
 * Urdu lives in the DATABASE, not in `messages/ur.json`: a household invents its
 * own subcategories at runtime, and a string bundle compiled at build time can
 * never contain "Chai Dhaba". `name_ur` is NULL for exactly those rows, so they
 * fall back to what the user typed rather than rendering blank when the language
 * is switched — which is what a missing bundle key would have done.
 */
export function categoryLabel(
  category: CategoryLike | null | undefined,
  locale: string,
): string {
  if (!category) return "";
  if (locale === "ur" && category.name_ur) return category.name_ur;
  return category.name;
}

/** Hook form, for components that already re-render on locale change. */
export function useCategoryLabel() {
  const locale = useLocale();
  return React.useCallback(
    (category: CategoryLike | null | undefined) =>
      categoryLabel(category, locale),
    [locale],
  );
}

export function CategoryIcon({
  icon,
  size = 15,
  className,
}: {
  icon: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const Icon = (icon && ICONS[icon]) || Tag;
  return <Icon size={size} strokeWidth={1.75} className={className} />;
}

/**
 * Icon in a tinted round chip, tinted by the category's tone. This is the
 * treatment used in dropdown options and list rows so a category is recognisable
 * by shape and colour before the label is read.
 */
export function CategoryChip({
  icon,
  tone,
  size = 28,
  iconSize = 14,
}: {
  icon: string | null | undefined;
  tone: number | null | undefined;
  size?: number;
  iconSize?: number;
}) {
  const color = toneColor(tone);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        color,
      }}
    >
      <CategoryIcon icon={icon} size={iconSize} />
    </span>
  );
}

/**
 * A parent category's rendered ART, on a tone-tinted plate.
 *
 * Three things here are deliberate:
 *
 * 1. THE PLATE IS A COLOUR-MIX AGAINST `transparent`, not a fixed grey. It
 *    composites over whatever surface it lands on, so the same component works
 *    on cream, on `bg-surface-subtle`, and on the navy band — and it survives
 *    dark mode, where a baked-in light-grey square would glow. This is why the
 *    art is asked for as a TRANSPARENT png: a render that ships its own grey
 *    background cannot do any of that.
 * 2. A MISSING FILE DEGRADES, it does not hole. `art_path` is NULL for every
 *    category until the render exists, and a 404 on one that does is caught by
 *    `onError` — both land on the Lucide glyph in the identical plate, so a
 *    half-populated catalogue looks intentional rather than broken.
 * 3. THE FALLBACK IS NOT A GREY BOX. Same rule as MerchantMark: a placeholder
 *    that says nothing reads as a rendering fault.
 */
/**
 * BELOW THIS, THE ART IS NEVER USED — the glyph is.
 *
 * The renders are photographic dioramas: `food` is a karahi, naan, a glass, a
 * spoon and a fork. At 22px that is ~480 pixels to say all of it, and it
 * resolves to a brown smudge. A Lucide glyph is *designed* for that size —
 * single weight, single colour, and it takes the category's tone.
 *
 * This is not a quality problem that a better render fixes; it is a resolution
 * one. So the choice is made here, once, on size — rather than by asking twelve
 * call sites to remember which representation they should be passing.
 */
const ART_MIN_SIZE = 56;

export function CategoryArt({
  category,
  size = 44,
  className,
  rounded = "rounded-card",
  plate,
}: {
  category: CategoryLike | null | undefined;
  size?: number;
  className?: string;
  /** The plate's corner. Round for list rows, `rounded-card` for tiles. */
  rounded?: string;
  /**
   * The tinted backing. Defaults ON for the glyph (which needs a ground to sit
   * on) and OFF for the art (which is a finished object with its own shadow —
   * a tinted square behind it just boxes it in).
   */
  plate?: boolean;
}) {
  const color = toneColor(category?.tone);

  // Small renders ignore `art_path` entirely: no request, no decode, no smudge.
  const art = size >= ART_MIN_SIZE ? (category?.art_path ?? null) : null;

  /*
   * Reset the failure flag when the art changes. Done in render rather than an
   * effect: React Compiler rejects a synchronous setState inside useEffect, and
   * this is the pattern the rest of the codebase uses for the same problem.
   */
  const [failedFor, setFailedFor] = React.useState<string | null>(null);
  const [trackedArt, setTrackedArt] = React.useState(art);
  if (trackedArt !== art) {
    setTrackedArt(art);
    setFailedFor(null);
  }

  const showArt = Boolean(art) && failedFor !== art;
  const showPlate = plate ?? !showArt;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden ${rounded} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: showPlate
          ? `color-mix(in oklab, ${color} 14%, transparent)`
          : undefined,
        color,
      }}
    >
      {showArt ? (
        <img
          src={art!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedFor(art)}
          /*
           * Fills its box when there is no plate. The 0.74 inset existed to keep
           * the object sitting ON the tinted square rather than bleeding to its
           * edge — with the plate gone that inset is just wasted space, and the
           * whole reason to show art at all is that it is big enough to read.
           */
          style={
            showPlate
              ? { width: size * 0.74, height: size * 0.74 }
              : { width: size, height: size }
          }
          className="object-contain"
        />
      ) : (
        <CategoryIcon icon={category?.icon} size={Math.round(size * 0.42)} />
      )}
    </span>
  );
}
