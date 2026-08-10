import {
  ArrowLeftRight,
  Beef,
  Bike,
  Briefcase,
  Building,
  Car,
  CarFront,
  Carrot,
  Droplets,
  Flame,
  Fuel,
  GraduationCap,
  HeartPulse,
  House,
  KeyRound,
  Laptop,
  Milk,
  Pill,
  ReceiptText,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Stethoscope,
  Tag,
  Tv,
  UtensilsCrossed,
  Users,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

/**
 * categories.icon holds a Lucide component NAME as text. Mapped explicitly rather
 * than resolved dynamically: a dynamic lookup would pull the entire Lucide bundle
 * into the client for the sake of 34 glyphs.
 *
 * Every name below is one that actually exists in the categories table. If a new
 * category is seeded with an unmapped icon it falls back to Tag rather than
 * rendering nothing.
 */
const ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Beef,
  Bike,
  Briefcase,
  Building,
  Car,
  CarFront,
  Carrot,
  Droplets,
  Flame,
  Fuel,
  GraduationCap,
  HeartPulse,
  House,
  KeyRound,
  Laptop,
  Milk,
  Pill,
  ReceiptText,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Stethoscope,
  Tag,
  Tv,
  UtensilsCrossed,
  Users,
  Wallet,
  Wifi,
  Wrench,
  Zap,
};

/** categories.tone is 1–6 and maps onto the chart palette. */
export function toneColor(tone: number | null | undefined): string {
  const n = tone && tone >= 1 && tone <= 6 ? tone : 1;
  return `var(--chart-${n})`;
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
