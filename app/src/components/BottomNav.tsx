import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  LayoutDashboard,
  NotebookPen,
  Plus,
  Wallet,
  LayoutGrid,
  type LucideProps,
} from 'lucide-react-native';
import { usePalette } from '../providers/theme-provider';
import { elevation } from '../theme/use-styles';
import { radii, spacing, typography } from '../theme/tokens';

type Destination = {
  key: string;
  label: string;
  route: string;
  Icon: React.ComponentType<LucideProps>;
};

/**
 * Four destinations plus a centre ACTION.
 *
 * The labels and routes come from `lib/modules.ts` conceptually — this list is
 * the four that earn a permanent slot, and everything else is reached through
 * More, which reads the registry itself. What must never happen is a second
 * hardcoded catalogue: the web bottom bar once offered "Activity" and "Wealth",
 * modules that existed nowhere else in the product, precisely because each
 * surface kept its own array.
 */
const LEFT: Destination[] = [
  { key: 'dashboard', label: 'Overview', route: '/', Icon: LayoutDashboard },
  { key: 'entries', label: 'Entries', route: '/entries', Icon: NotebookPen },
];

const RIGHT: Destination[] = [
  { key: 'accounts', label: 'Accounts', route: '/accounts', Icon: Wallet },
  { key: 'more', label: 'More', route: '/more', Icon: LayoutGrid },
];

export function BottomNav() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (route: string) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route);

  const go = (route: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(route as never);
  };

  const openAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/entry/new' as never);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: spacing.lg,
        paddingBottom: Math.max(insets.bottom, spacing.md),
        alignItems: 'center',
      }}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: palette.surface,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: palette.border,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            gap: spacing.xs,
          },
          elevation(palette, 'island'),
        ]}
      >
        {LEFT.map((d) => (
          <NavItem key={d.key} destination={d} active={isActive(d.route)} onPress={() => go(d.route)} />
        ))}

        {/* The centre is an ACTION, not a route. Logging money should not
            require navigating to a page in order to press a button on it. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add an entry"
          onPress={openAdd}
          style={({ pressed }) => [
            {
              width: 52,
              height: 52,
              borderRadius: radii.full,
              backgroundColor: palette.brass,
              alignItems: 'center',
              justifyContent: 'center',
              marginHorizontal: spacing.xs,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
            elevation(palette, 'md'),
          ]}
        >
          <Plus size={26} color={palette.navy900} strokeWidth={2.6} />
        </Pressable>

        {RIGHT.map((d) => (
          <NavItem key={d.key} destination={d} active={isActive(d.route)} onPress={() => go(d.route)} />
        ))}
      </View>
    </View>
  );
}

/**
 * Active items carry their label; inactive ones are the glyph alone.
 *
 * That is what lets five slots fit on a 360px handset without truncating — and
 * the label is on the one item where "where am I" is the question being asked.
 */
function NavItem({
  destination,
  active,
  onPress,
}: {
  destination: Destination;
  active: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const { Icon, label } = destination;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        paddingHorizontal: active ? spacing.lg : spacing.md,
        height: 44,
        borderRadius: radii.full,
        backgroundColor: active ? palette.navy900 : 'transparent',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon
        size={21}
        color={active ? palette.onNavy : palette.muted}
        strokeWidth={active ? 2.4 : 2}
      />
      {active ? (
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            fontWeight: '600',
            color: palette.onNavy,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
