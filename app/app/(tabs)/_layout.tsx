import React from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav } from '../../src/components/BottomNav';
import { UnsyncedBanner } from '../../src/components/UnsyncedBanner';
import { usePalette } from '../../src/providers/theme-provider';
import { spacing } from '../../src/theme/tokens';

/**
 * The nav island floats OVER the content rather than sitting below it, so no
 * bottom padding belongs here — each `Screen` reserves its own clearance
 * (`layout.navIslandClearance`). Padding the container instead leaves a dead
 * band of canvas under every short screen.
 *
 * The unsynced banner rides just above the island rather than at the top of the
 * screen: at the top it would either sit under the status bar or fight every
 * `Screen`'s own safe-area inset, and down here it is beside the + button the
 * user just pressed, which is where the question "did that save?" is asked.
 */
export default function TabsLayout() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <Slot />

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: Math.max(insets.bottom, spacing.md) + 76,
          paddingHorizontal: spacing.lg,
        }}
      >
        <UnsyncedBanner />
      </View>

      <BottomNav />
    </View>
  );
}
