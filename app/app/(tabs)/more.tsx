import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Lucide from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card, SectionHeader } from '../../src/components/ui/Surfaces';
import { T } from '../../src/components/T';
import { usePalette, useTheme } from '../../src/providers/theme-provider';
import { useSession } from '../../src/providers/auth-provider';
import {
  MODULES,
  moduleRoute,
  resolveModules,
  type ModuleDef,
  type WorkspacePreset,
} from '../../src/lib/modules';
import { formatName } from '../../src/lib/format';
import { radii, spacing, toneOf, typography } from '../../src/theme/tokens';

/**
 * Named explicitly rather than indexed off the whole Lucide module — a dynamic
 * lookup defeats tree-shaking and drags ~1,500 icons into the bundle.
 */
const MODULE_ICONS: Record<string, React.ComponentType<Lucide.LucideProps>> = {
  LayoutDashboard: Lucide.LayoutDashboard,
  NotebookPen: Lucide.NotebookPen,
  Wallet: Lucide.Wallet,
  ArrowLeftRight: Lucide.ArrowLeftRight,
  ListChecks: Lucide.ListChecks,
  CalendarDays: Lucide.CalendarDays,
  CircleDollarSign: Lucide.CircleDollarSign,
  TrendingUp: Lucide.TrendingUp,
  Users: Lucide.Users,
  HandHeart: Lucide.HandHeart,
  Contact: Lucide.Contact,
  PieChart: Lucide.PieChart,
  Landmark: Lucide.Landmark,
  FileSpreadsheet: Lucide.FileSpreadsheet,
  ScanLine: Lucide.ScanLine,
  Bot: Lucide.Bot,
  BookUser: Lucide.BookUser,
  Truck: Lucide.Truck,
  Package: Lucide.Package,
  CalendarCheck: Lucide.CalendarCheck,
  Sprout: Lucide.Sprout,
  Map: Lucide.Map,
  Droplets: Lucide.Droplets,
  Scale: Lucide.Scale,
  Wheat: Lucide.Wheat,
  Handshake: Lucide.Handshake,
  FileText: Lucide.FileText,
  Globe: Lucide.Globe,
  Factory: Lucide.Factory,
  UsersRound: Lucide.UsersRound,
  Calculator: Lucide.Calculator,
  Building: Lucide.Building,
  KeyRound: Lucide.KeyRound,
  ReceiptText: Lucide.ReceiptText,
  Settings: Lucide.Settings,
};

const GROUP_TITLE: Record<string, string> = {
  core: 'Everyday',
  finance: 'Money',
  vertical: 'For this workspace',
};

export default function MoreScreen() {
  const palette = usePalette();
  const router = useRouter();
  const { profile, signOut } = useSession();
  const { mode, setMode, isDark } = useTheme();

  // Read the ONE registry, resolved against the workspace preset. A second
  // hardcoded array here is exactly how the web bottom bar ended up offering
  // "Activity" and "Wealth", modules that existed nowhere else in the product.
  const preset = (profile as { preset?: WorkspacePreset } | null)?.preset ?? 'family';
  const modules = resolveModules(preset).filter((m) => m.group !== 'system');

  const groups: Array<[string, ModuleDef[]]> = (['core', 'finance', 'vertical'] as const)
    .map((g) => [g, modules.filter((m) => m.group === g)] as [string, ModuleDef[]])
    .filter(([, list]) => list.length > 0);

  return (
    <Screen>
      <T
        style={{
          fontSize: typography.fontSize.xxl,
          fontWeight: '700',
          color: palette.foreground,
          marginBottom: spacing.xs,
        }}
      >
        More
      </T>
      <T style={{ fontSize: typography.fontSize.sm, color: palette.muted, marginBottom: spacing.xl }}>
        {formatName(profile?.first_name, profile?.last_name)}
      </T>

      {groups.map(([group, list]) => (
        <View key={group} style={{ marginBottom: spacing.xxl }}>
          <SectionHeader title={GROUP_TITLE[group] ?? group} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {list.map((mod) => (
              <ModuleTile key={mod.key} mod={mod} onPress={(route) => router.push(route as never)} />
            ))}
          </View>
        </View>
      ))}

      <SectionHeader title="Settings" />
      <Card padded={false}>
        <Row
          label="Appearance"
          value={mode === 'system' ? `Follow system (${isDark ? 'dark' : 'light'})` : mode === 'dark' ? 'Dark' : 'Light'}
          onPress={() => setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light')}
          icon={<Lucide.Palette size={19} color={palette.foreground2} />}
        />
        <Row
          label="Profile and workspaces"
          onPress={() => router.push('/settings' as never)}
          icon={<Lucide.Settings size={19} color={palette.foreground2} />}
        />
        <Row
          label="Sign out"
          destructive
          onPress={signOut}
          icon={<Lucide.LogOut size={19} color={palette.loss} />}
          last
        />
      </Card>
    </Screen>
  );
}

/**
 * A module with no native screen yet is rendered GREYED with "on the web", not
 * hidden. Hiding it means the user never learns the feature exists at all.
 */
function ModuleTile({ mod, onPress }: { mod: ModuleDef; onPress: (route: string) => void }) {
  const palette = usePalette();
  const route = moduleRoute(mod.key);
  const Icon = MODULE_ICONS[mod.icon] ?? Lucide.Square;

  const unavailable = !route || mod.status === 'soon';
  const role = toneOf(palette, (mod.key.length % 6) + 1);

  return (
    <Pressable
      disabled={unavailable}
      onPress={() => route && onPress(route)}
      style={({ pressed }) => ({
        width: '31%',
        minWidth: 100,
        flexGrow: 1,
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.lg,
        backgroundColor: unavailable ? palette.surfaceSubtle : role.fill,
        borderWidth: 1,
        borderColor: unavailable ? palette.border : role.edge,
        opacity: pressed ? 0.85 : unavailable ? 0.6 : 1,
      })}
    >
      <Icon size={22} color={unavailable ? palette.muted : role.ink} strokeWidth={2} />
      <T
        style={{
          fontSize: typography.fontSize.xs,
          fontWeight: '600',
          color: palette.foreground,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {mod.label}
      </T>
      {unavailable ? (
        <Text style={{ fontSize: 9, color: palette.faint, fontWeight: '600' }}>
          {mod.status === 'soon' ? 'Soon' : 'On the web'}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Row({
  label,
  value,
  icon,
  onPress,
  destructive,
  last,
}: {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
        backgroundColor: pressed ? palette.surfaceSubtle : 'transparent',
      })}
    >
      {icon}
      <T
        style={{
          flex: 1,
          fontSize: typography.fontSize.base,
          fontWeight: '600',
          color: destructive ? palette.loss : palette.foreground,
        }}
      >
        {label}
      </T>
      {value ? (
        <T style={{ fontSize: typography.fontSize.sm, color: palette.muted }}>{value}</T>
      ) : null}
      {!destructive ? <Lucide.ChevronRight size={17} color={palette.faint} /> : null}
    </Pressable>
  );
}
