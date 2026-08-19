import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';
import { usePalette } from '../../providers/theme-provider';
import { radii, spacing, typography } from '../../theme/tokens';
import { T } from '../T';

/**
 * Fade + 8px rise, 220ms, staggered 40ms — the same entrance the web app uses.
 *
 * The element TYPE never changes on a client-only condition. `Reveal` on web
 * once picked between `div` and `motion.div` on a reduced-motion hook and the
 * hydration mismatch made React drop the whole subtree. There is no hydration
 * here, but the rule stands for a plainer reason: a component that sometimes
 * animates and sometimes returns a different tree is two components.
 * Reanimated's `ReduceMotion.System` handles the preference inside the
 * animation instead.
 */
export function Reveal({
  children,
  index = 0,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 40,
      withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [index, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));

  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}

/**
 * Loading states are layout-shaped skeletons, never spinners.
 *
 * A spinner says "something is happening"; a skeleton says "a figure goes here,
 * this wide" and the screen does not jump when the data lands.
 */
export function Skeleton({
  width,
  height = 16,
  radius = radii.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const shimmer = useSharedValue(0.5);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
        withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
      ),
      -1,
      false,
    );
  }, [shimmer]);

  const animated = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <Animated.View
      style={[
        animated,
        {
          width: width ?? '100%',
          height,
          borderRadius: radius,
          backgroundColor: palette.surface3,
        },
        style,
      ]}
    />
  );
}

/** A skeleton shaped like a list row: glyph, two lines, a figure. */
export function SkeletonRow() {
  const palette = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <Skeleton width={44} height={44} radius={radii.md} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="32%" height={11} />
      </View>
      <Skeleton width={72} height={18} />
    </View>
  );
}

/**
 * The empty state.
 *
 * Takes a distinct `error` mode because a failed query rendered as "nothing
 * here" is indistinguishable from an empty household — and that is exactly how
 * the web Transactions page showed "No Transactions Found" for every household
 * while a broken embed returned `PGRST201`.
 */
export function EmptyState({
  title,
  body,
  icon,
  action,
  variant = 'empty',
}: {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'empty' | 'error';
}) {
  const palette = usePalette();
  const isError = variant === 'error';

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxxl + spacing.lg,
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radii.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isError ? palette.lossSoft : palette.surfaceSubtle,
            borderWidth: 1,
            borderColor: isError ? palette.loss : palette.border,
          }}
        >
          {icon}
        </View>
      ) : null}

      <T
        style={{
          fontSize: typography.fontSize.lg,
          fontWeight: '700',
          color: isError ? palette.loss : palette.foreground,
          textAlign: 'center',
        }}
      >
        {title}
      </T>

      {body ? (
        <T
          style={{
            fontSize: typography.fontSize.sm,
            color: palette.muted,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 300,
          }}
        >
          {body}
        </T>
      ) : null}

      {action}
    </View>
  );
}
