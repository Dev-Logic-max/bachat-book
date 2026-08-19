import React from 'react';
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette, useTheme } from '../../providers/theme-provider';
import { layout, spacing } from '../../theme/tokens';

/**
 * Every screen's ground.
 *
 * Owns three things nothing else should have to remember: the canvas colour
 * (warm cream, never white), the safe-area inset at the top, and the clearance
 * at the bottom for the floating nav island. A scroller that forgets the last of
 * those ends with its final row permanently behind the island.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  /** Off for screens with their own full-bleed header band. */
  topInset = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingHorizontal: padded ? layout.screenPadding : 0,
    paddingTop: topInset ? insets.top + spacing.sm : 0,
    paddingBottom: layout.navIslandClearance + insets.bottom,
  };

  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.canvas }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[padding, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brass}
              colors={[palette.brass]}
              progressBackgroundColor={palette.surface}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}
