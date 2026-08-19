import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { usePalette, useTheme } from '../../providers/theme-provider';
import { Card } from './Surfaces';
import { T } from '../T';
import { radii, spacing, typography } from '../../theme/tokens';

/**
 * The chrome every auth screen shares: canvas, keyboard avoidance, a title
 * block, a card for the fields and a footer link.
 *
 * Three screens repeating the same 90 lines of `StyleSheet.create` is how they
 * all ended up hardcoded to the light palette — one copy each, none of them
 * reading the theme.
 */
export function AuthShell({
  title,
  subtitle,
  error,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  error?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const palette = usePalette();
  const { isDark } = useTheme();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: spacing.xl }}>
          <T
            style={{
              fontSize: typography.fontSize.xxl,
              fontWeight: '700',
              color: palette.foreground,
            }}
          >
            {title}
          </T>
          {subtitle ? (
            <T
              style={{ fontSize: typography.fontSize.sm, color: palette.muted, marginTop: spacing.xs }}
            >
              {subtitle}
            </T>
          ) : null}
        </View>

        <Card style={{ gap: spacing.lg }}>
          {error ? <AuthNotice message={error} /> : null}
          {children}
        </Card>

        {footer ? <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Success and failure share one slot, so the tone is read off the message.
 *
 * "Verification link sent" arriving in a red error box is the specific bug this
 * avoids — the sign-up screen used the error state for its happy path.
 */
export function AuthNotice({ message }: { message: string }) {
  const palette = usePalette();
  const positive = /sent|check your (email|inbox)|updated|success/i.test(message);
  const ink = positive ? palette.gain : palette.loss;
  const fill = positive ? palette.gainSoft : palette.lossSoft;

  return (
    <View
      style={{
        backgroundColor: fill,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: ink,
        padding: spacing.md,
      }}
    >
      <Text style={{ color: ink, fontSize: typography.fontSize.sm }}>{message}</Text>
    </View>
  );
}

export function AuthLink({
  prefix,
  action,
  onPress,
}: {
  prefix: string;
  action: string;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <T style={{ fontSize: typography.fontSize.sm, color: palette.muted }}>
        {prefix} <Text style={{ color: palette.brassStrong, fontWeight: '600' }}>{action}</Text>
      </T>
    </Pressable>
  );
}
