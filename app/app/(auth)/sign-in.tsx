import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Shield } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Surfaces';
import { T } from '../../src/components/T';
import { usePalette, useTheme } from '../../src/providers/theme-provider';
import { elevation } from '../../src/theme/use-styles';
import { radii, spacing, typography } from '../../src/theme/tokens';
import {
  checkBiometricHardware,
  incrementSignInCount,
  isBiometricEnabled,
  setBiometricEnabled,
} from '../../src/lib/biometrics';

export default function SignInScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMsg('Enter your email and password to continue.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      // Offer the biometric lock on the SECOND sign-in, not the first. Asking
      // before the user has seen anything is a permission prompt with no context
      // attached, and it gets declined.
      const count = await incrementSignInCount();
      const alreadyEnabled = await isBiometricEnabled();
      const { hasHardware, isEnrolled } = await checkBiometricHardware();

      setLoading(false);
      if (count >= 2 && !alreadyEnabled && hasHardware && isEnrolled) {
        setShowBiometricModal(true);
      } else {
        router.replace('/(tabs)');
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not sign in. Please try again.');
      setLoading(false);
    }
  };

  const resolveBiometrics = async (enable: boolean) => {
    await setBiometricEnabled(enable);
    setShowBiometricModal(false);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.xxxl }}>
          <View
            style={[
              {
                width: 64,
                height: 64,
                borderRadius: radii.lg,
                backgroundColor: palette.navy900,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.lg,
              },
              elevation(palette, 'md'),
            ]}
          >
            <Text style={{ color: palette.brass, fontSize: 25, fontWeight: '800' }}>BB</Text>
          </View>
          <T
            style={{
              fontSize: typography.fontSize.xxl,
              fontWeight: '700',
              color: palette.foreground,
            }}
          >
            Bachat Book
          </T>
          <T
            style={{ fontSize: typography.fontSize.sm, color: palette.muted, marginTop: 4 }}
          >
            Your money, your household, one book
          </T>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <T
            style={{
              fontSize: typography.fontSize.xl,
              fontWeight: '700',
              color: palette.foreground,
            }}
          >
            Sign in
          </T>

          {errorMsg ? (
            <View
              style={{
                backgroundColor: palette.lossSoft,
                borderRadius: radii.sm,
                borderWidth: 1,
                borderColor: palette.loss,
                padding: spacing.md,
              }}
            >
              <Text style={{ color: palette.loss, fontSize: typography.fontSize.sm }}>
                {errorMsg}
              </Text>
            </View>
          ) : null}

          <Input
            label="Email"
            placeholder="name@domain.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            isPassword
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={{ alignSelf: 'flex-end' }}
            hitSlop={8}
          >
            <T
              style={{
                fontSize: typography.fontSize.sm,
                color: palette.brassStrong,
                fontWeight: '600',
              }}
            >
              Forgot password?
            </T>
          </Pressable>

          <Button block size="lg" title="Sign in" onPress={handleSignIn} loading={loading} />
        </Card>

        <Pressable
          onPress={() => router.push('/(auth)/sign-up')}
          style={{ alignItems: 'center', marginTop: spacing.xxl }}
          hitSlop={8}
        >
          <T style={{ fontSize: typography.fontSize.sm, color: palette.muted }}>
            New here?{' '}
            <Text style={{ color: palette.brassStrong, fontWeight: '600' }}>Create an account</Text>
          </T>
        </Pressable>
      </ScrollView>

      <Modal visible={showBiometricModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: palette.scrim,
            justifyContent: 'center',
            padding: spacing.xl,
          }}
        >
          <Card style={{ alignItems: 'center', gap: spacing.md }}>
            <Shield size={44} color={palette.brass} />
            <T
              style={{
                fontSize: typography.fontSize.xl,
                fontWeight: '700',
                color: palette.foreground,
              }}
            >
              Lock the app?
            </T>
            <T
              style={{
                fontSize: typography.fontSize.sm,
                color: palette.muted,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              Use your fingerprint or face to open Bachat Book. Worth turning on if this phone is
              shared with family.
            </T>

            <View style={{ flexDirection: 'row', gap: spacing.md, width: '100%', marginTop: spacing.sm }}>
              <Button
                title="Not now"
                variant="outline"
                onPress={() => resolveBiometrics(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Turn on"
                variant="brass"
                onPress={() => resolveBiometrics(true)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
