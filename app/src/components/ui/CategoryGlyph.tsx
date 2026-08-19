import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import * as Lucide from 'lucide-react-native';
import { usePalette } from '../../providers/theme-provider';
import { radii, toneOf } from '../../theme/tokens';

/**
 * The 80 Lucide names the seeded catalogue actually uses.
 *
 * Named explicitly rather than reached through `Lucide[icon]` on the whole
 * module: a dynamic index defeats Metro's tree-shaking and pulls the entire
 * ~1,500-icon set into the bundle. Anything unrecognised — including a
 * household's own subcategory, which may carry whatever its parent had —
 * falls through to `Tag`.
 */
const ICONS: Record<string, React.ComponentType<Lucide.LucideProps>> = {
  Armchair: Lucide.Armchair,
  ArrowLeftRight: Lucide.ArrowLeftRight,
  Baby: Lucide.Baby,
  Banknote: Lucide.Banknote,
  Beef: Lucide.Beef,
  Bike: Lucide.Bike,
  BookMarked: Lucide.BookMarked,
  BookOpen: Lucide.BookOpen,
  Briefcase: Lucide.Briefcase,
  Building: Lucide.Building,
  Bus: Lucide.Bus,
  CakeSlice: Lucide.CakeSlice,
  Car: Lucide.Car,
  CarFront: Lucide.CarFront,
  Carrot: Lucide.Carrot,
  CircleParking: Lucide.CircleParking,
  Clapperboard: Lucide.Clapperboard,
  CreditCard: Lucide.CreditCard,
  CupSoda: Lucide.CupSoda,
  Droplets: Lucide.Droplets,
  Dumbbell: Lucide.Dumbbell,
  Eye: Lucide.Eye,
  FileText: Lucide.FileText,
  Flame: Lucide.Flame,
  Flower: Lucide.Flower,
  Footprints: Lucide.Footprints,
  Fuel: Lucide.Fuel,
  Gamepad2: Lucide.Gamepad2,
  Gift: Lucide.Gift,
  Globe: Lucide.Globe,
  GraduationCap: Lucide.GraduationCap,
  Hammer: Lucide.Hammer,
  HandCoins: Lucide.HandCoins,
  HandHeart: Lucide.HandHeart,
  Heart: Lucide.Heart,
  HeartPulse: Lucide.HeartPulse,
  Hotel: Lucide.Hotel,
  House: Lucide.House,
  KeyRound: Lucide.KeyRound,
  Landmark: Lucide.Landmark,
  Laptop: Lucide.Laptop,
  Map: Lucide.Map,
  MapPinned: Lucide.MapPinned,
  Milk: Lucide.Milk,
  Moon: Lucide.Moon,
  NotebookPen: Lucide.NotebookPen,
  Package: Lucide.Package,
  Palette: Lucide.Palette,
  PartyPopper: Lucide.PartyPopper,
  PawPrint: Lucide.PawPrint,
  Percent: Lucide.Percent,
  PiggyBank: Lucide.PiggyBank,
  Pill: Lucide.Pill,
  Plane: Lucide.Plane,
  ReceiptText: Lucide.ReceiptText,
  School: Lucide.School,
  Scissors: Lucide.Scissors,
  ShieldCheck: Lucide.ShieldCheck,
  Shirt: Lucide.Shirt,
  ShoppingBag: Lucide.ShoppingBag,
  ShoppingBasket: Lucide.ShoppingBasket,
  Smartphone: Lucide.Smartphone,
  Sparkles: Lucide.Sparkles,
  Stethoscope: Lucide.Stethoscope,
  Store: Lucide.Store,
  Tag: Lucide.Tag,
  TestTube: Lucide.TestTube,
  Ticket: Lucide.Ticket,
  TrendingUp: Lucide.TrendingUp,
  TriangleAlert: Lucide.TriangleAlert,
  Tv: Lucide.Tv,
  Undo2: Lucide.Undo2,
  Users: Lucide.Users,
  UtensilsCrossed: Lucide.UtensilsCrossed,
  Wallet: Lucide.Wallet,
  WashingMachine: Lucide.WashingMachine,
  Wheat: Lucide.Wheat,
  Wifi: Lucide.Wifi,
  Wrench: Lucide.Wrench,
  Zap: Lucide.Zap,
};

/** The Lucide glyph for a category icon name, falling back to a generic tag. */
export function categoryIcon(name: string | null | undefined) {
  return (name && ICONS[name]) || Lucide.Tag;
}

/**
 * The mark for a category: rendered art when the row has it, the Lucide glyph on
 * a tone-tinted plate when it does not.
 *
 * `art_path` comes from the ROW, never a local map, so adding a category on the
 * web does not require an app release. The art does not exist yet — the whole
 * catalogue points at `/categories/*.png` and only a README is there — so this
 * degrades by design rather than holing. Do NOT substitute a grey box.
 */
export function CategoryGlyph({
  icon,
  tone,
  artPath,
  size = 44,
  style,
}: {
  icon?: string | null;
  tone?: number | null;
  artPath?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const role = toneOf(palette, tone);
  const Glyph = categoryIcon(icon);
  const source = resolveArt(artPath);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size >= 40 ? radii.md : radii.sm,
          backgroundColor: role.fill,
          borderWidth: 1,
          borderColor: role.edge,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: size * 0.78, height: size * 0.78 }}
          contentFit="contain"
          transition={160}
        />
      ) : (
        <Glyph size={size * 0.46} color={role.ink} strokeWidth={2} />
      )}
    </View>
  );
}

/**
 * Category art is served by the web app, so a stored `/categories/food.png` has
 * to become an absolute URL before a native `Image` can fetch it. Without a
 * configured origin there is nothing to resolve against and the glyph fallback
 * stands, which is the correct outcome rather than a broken image box.
 */
function resolveArt(artPath: string | null | undefined) {
  if (!artPath) return null;
  if (artPath.startsWith('http')) return { uri: artPath };

  const origin = process.env.EXPO_PUBLIC_WEB_URL;
  if (!origin) return null;

  return { uri: `${origin.replace(/\/$/, '')}${artPath.startsWith('/') ? '' : '/'}${artPath}` };
}
