import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { shadows } from '../theme/shadows';
import { LayoutDashboard, Receipt, Landmark, Calendar, Users, Plus } from 'lucide-react-native';

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { name: 'overview', route: '/(tabs)', label: 'Overview', Icon: LayoutDashboard },
    { name: 'transactions', route: '/(tabs)/transactions', label: 'Entries', Icon: Receipt },
    { name: 'fab', route: '/entry/new', label: 'Add', isFab: true },
    { name: 'accounts', route: '/(tabs)/accounts', label: 'Accounts', Icon: Landmark },
    { name: 'calendar', route: '/(tabs)/calendar', label: 'Calendar', Icon: Calendar },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          if (tab.isFab) {
            return (
              <TouchableOpacity
                key="fab"
                style={styles.fabButton}
                onPress={() => router.push('/entry/new')}
                activeOpacity={0.85}
              >
                <Plus size={24} color={colors.light.navy900} strokeWidth={2.5} />
              </TouchableOpacity>
            );
          }

          const IconComponent = tab.Icon!;
          const isActive =
            pathname === tab.route ||
            (tab.route === '/(tabs)' && pathname === '/') ||
            (tab.route !== '/(tabs)' && pathname.startsWith(tab.route));

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
                <IconComponent
                  size={20}
                  color={isActive ? colors.light.navy900 : colors.light.onNavyMuted}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.light.navy900,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: '100%',
    ...shadows.floatingNav,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    flex: 1,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconWrapper: {
    backgroundColor: colors.light.brass,
  },
  tabLabel: {
    fontSize: 10,
    color: colors.light.onNavyMuted,
    marginTop: 2,
    fontWeight: typography.fontWeight.medium,
  },
  activeTabLabel: {
    color: colors.light.brass,
    fontWeight: typography.fontWeight.semibold,
  },
  fabButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.light.brass,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
    ...shadows.md,
  },
});
