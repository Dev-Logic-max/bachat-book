import React from 'react';
import { CalendarDays } from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Surfaces';
import { EmptyState } from '../../src/components/ui/Feedback';
import { T } from '../../src/components/T';
import { usePalette } from '../../src/providers/theme-provider';
import { spacing, typography } from '../../src/theme/tokens';

/**
 * Placeholder, and deliberately honest about it.
 *
 * The calendar is M6 — it needs task generation, the Hijri overlay and
 * complete-with-payment before it shows anything true. A grid of empty day cells
 * would look finished and be a lie about what the app can currently do.
 */
export default function CalendarScreen() {
  const palette = usePalette();

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
        Calendar
      </T>
      <T style={{ fontSize: typography.fontSize.sm, color: palette.muted, marginBottom: spacing.xl }}>
        Everything with a date on it
      </T>

      <Card padded={false}>
        <EmptyState
          icon={<CalendarDays size={26} color={palette.brassStrong} />}
          title="Not on the phone yet"
          body="Bills, committee payouts, salary dates and the Ramadan and Eid shifts are on the web app for now. They arrive here once tasks and reminders land."
        />
      </Card>
    </Screen>
  );
}
