import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { AuthProvider, useSession } from '../src/providers/auth-provider';
import { QueryProvider } from '../src/providers/query-provider';
import { ThemeProvider } from '../src/providers/theme-provider';
import { colors, radii, spacing, typography } from '../src/theme/tokens';
import { handleDeepLink } from '../src/lib/deep-links';
import { setI18nLocale } from '../src/i18n';
import {
  isBiometricEnabled,
  authenticateWithBiometrics,
} from '../src/lib/biometrics';
import { Button } from '../src/components/ui/Button';
import { T } from '../src/components/T';
import { Shield } from 'lucide-react-native';

function RootLayoutNav() {
  const { session, profile, isLoading, signOut } = useSession();
  const segments = useSegments();
  const router = useRouter();

  const [biometricLocked, setBiometricLocked] = useState(false);

  // Sync i18n locale whenever profile updates (L6 fix)
  useEffect(() => {
    if (profile?.locale) {
      setI18nLocale(profile.locale);
    }
  }, [profile?.locale]);

  // Handle incoming deep links (e.g. bachatbook://auth/callback) (L7 fix)
  useEffect(() => {
    const processUrl = async (url: string | null) => {
      if (!url) return;
      const res = await handleDeepLink(url);
      if (res.success && res.type === 'recovery') {
        router.replace('/(auth)/reset-password');
      }
    };

    Linking.getInitialURL().then(processUrl);

    const sub = Linking.addEventListener('url', (event) => {
      processUrl(event.url);
    });

    return () => sub.remove();
  }, []);

  // Check biometric lock on app active / session change (Item 8 fix)
  useEffect(() => {
    if (!session) {
      setBiometricLocked(false);
      return;
    }

    isBiometricEnabled().then((enabled) => {
      if (enabled) {
        setBiometricLocked(true);
        authenticateWithBiometrics().then((success) => {
          if (success) setBiometricLocked(false);
        });
      }
    });
  }, [session]);

  // Auth Redirection Gate
  useEffect(() => {
    if (isLoading || biometricLocked) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, biometricLocked]);

  if (isLoading || biometricLocked) {
    return (
      <View style={styles.loadingContainer}>
        {biometricLocked ? (
          <View style={styles.lockCard}>
            <Shield size={48} color={colors.light.brass} />
            <T style={styles.lockTitle}>App Locked</T>
            <T style={styles.lockSub}>Authenticate using Biometrics to continue</T>
            <Button
              title="Unlock with Biometrics"
              variant="brass"
              onPress={async () => {
                const ok = await authenticateWithBiometrics();
                if (ok) setBiometricLocked(false);
              }}
              style={{ marginTop: spacing.lg }}
            />
            <Button
              title="Sign out and use password"
              variant="secondary"
              onPress={async () => {
                setBiometricLocked(false);
                await signOut();
              }}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : (
          <ActivityIndicator size="large" color={colors.light.brass} />
        )}
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="entry/new" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="entry/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="account/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="committee/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="settings/index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <StatusBar style="auto" />
            <RootLayoutNav />
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.light.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockCard: {
    alignItems: 'center',
    backgroundColor: colors.light.navy900,
    borderRadius: radii.card,
    padding: spacing.xxl,
    width: '100%',
  },
  lockTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.onNavy,
    marginTop: spacing.md,
  },
  lockSub: {
    fontSize: typography.fontSize.sm,
    color: colors.light.onNavyMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
