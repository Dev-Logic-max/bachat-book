import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import { Shield } from 'lucide-react-native';
import { AuthProvider, useSession } from '../src/providers/auth-provider';
import { QueryProvider } from '../src/providers/query-provider';
import { ThemeProvider, usePalette } from '../src/providers/theme-provider';
import { handleDeepLink } from '../src/lib/deep-links';
import { setI18nLocale } from '../src/i18n';
import { authenticateWithBiometrics, isBiometricEnabled } from '../src/lib/biometrics';
import { Button } from '../src/components/ui/Button';
import { NavyPanel } from '../src/components/ui/Surfaces';
import { T } from '../src/components/T';
import { spacing, typography } from '../src/theme/tokens';

function RootLayoutNav() {
  const palette = usePalette();
  const { session, profile, isLoading, signOut } = useSession();
  const segments = useSegments();
  const router = useRouter();

  const [biometricLocked, setBiometricLocked] = useState(false);

  // The locale lives on `profiles.locale`. NOT `preferences.locale` — that
  // column does not exist, and querying it returns an error rather than a
  // fallback, so the app would render English while reporting no problem.
  useEffect(() => {
    if (profile?.locale) setI18nLocale(profile.locale);
  }, [profile?.locale]);

  useEffect(() => {
    const processUrl = async (url: string | null) => {
      if (!url) return;
      const res = await handleDeepLink(url);
      if (res.success && res.type === 'recovery') {
        router.replace('/(auth)/reset-password');
      }
    };

    Linking.getInitialURL().then(processUrl);
    const sub = Linking.addEventListener('url', (event) => processUrl(event.url));
    return () => sub.remove();
  }, [router]);

  // Biometrics gate the app SHELL, not the Supabase session — locking the
  // session would force a full re-auth every time the phone is put down.
  useEffect(() => {
    if (!session) {
      setBiometricLocked(false);
      return;
    }

    let active = true;
    isBiometricEnabled().then((enabled) => {
      if (!active || !enabled) return;
      setBiometricLocked(true);
      authenticateWithBiometrics().then((ok) => {
        if (active && ok) setBiometricLocked(false);
      });
    });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (isLoading || biometricLocked) return;

    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, biometricLocked, router]);

  if (isLoading || biometricLocked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.canvas,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        {biometricLocked ? (
          <NavyPanel style={{ width: '100%', alignItems: 'center' }}>
            <Shield size={44} color={palette.brass} />
            <T
              style={{
                fontSize: typography.fontSize.xl,
                fontWeight: '700',
                color: palette.onNavy,
                marginTop: spacing.md,
              }}
            >
              Bachat Book is locked
            </T>
            <T
              style={{
                fontSize: typography.fontSize.sm,
                color: palette.onNavyMuted,
                textAlign: 'center',
                marginTop: spacing.xs,
              }}
            >
              Use your fingerprint or face to continue
            </T>
            <Button
              block
              title="Unlock"
              variant="brass"
              style={{ marginTop: spacing.xl }}
              onPress={async () => {
                const ok = await authenticateWithBiometrics();
                if (ok) setBiometricLocked(false);
              }}
            />
            <Button
              block
              title="Sign out instead"
              variant="ghost"
              style={{ marginTop: spacing.sm }}
              textStyle={{ color: palette.onNavyMuted }}
              onPress={async () => {
                setBiometricLocked(false);
                await signOut();
              }}
            />
          </NavyPanel>
        ) : (
          <ActivityIndicator size="large" color={palette.brass} />
        )}
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="entry/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="entry/[id]" />
      <Stack.Screen name="account/[id]" />
      <Stack.Screen name="committee/[id]" />
      <Stack.Screen name="settings/index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
