import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { T } from '../../src/components/T';
import {
  incrementSignInCount,
  checkBiometricHardware,
  isBiometricEnabled,
  setBiometricEnabled,
} from '../../src/lib/biometrics';
import { Shield } from 'lucide-react-native';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Biometric prompt modal (after 2nd sign-in)
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMsg('Please enter email and password');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      // Check sign-in count for biometric prompt (MOBILE-PLAN.md §1 & §11)
      const count = await incrementSignInCount();
      const alreadyEnabled = await isBiometricEnabled();
      const { hasHardware, isEnrolled } = await checkBiometricHardware();

      if (count >= 2 && !alreadyEnabled && hasHardware && isEnrolled) {
        setLoading(false);
        setShowBiometricModal(true);
      } else {
        setLoading(false);
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  const handleEnableBiometrics = async (enable: boolean) => {
    await setBiometricEnabled(enable);
    setShowBiometricModal(false);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>BB</Text>
          </View>
          <T style={styles.title}>Bachat Book</T>
          <T style={styles.subtitle}>Personal & Household Finance</T>
        </View>

        {/* Card Form */}
        <View style={styles.formCard}>
          <T style={styles.formTitle}>Sign In</T>

          {!!errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{errorMsg}</Text>
            </View>
          )}

          <Input
            label="Email Address"
            placeholder="name@domain.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            isPassword
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <T style={styles.forgotText}>Forgot Password?</T>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleSignIn}
            loading={loading}
            style={styles.submitBtn}
          />
        </View>

        {/* Footer Link */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <T style={styles.footerText}>
              Don't have an account? <Text style={styles.footerLink}>Sign up</Text>
            </T>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Biometric Opt-in Modal (after 2nd sign-in) */}
      <Modal visible={showBiometricModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Shield size={44} color={colors.light.brass} />
            <T style={styles.modalTitle}>Enable Biometric Lock?</T>
            <T style={styles.modalSub}>
              Use Fingerprint or Face ID for faster, secure app unlocks.
            </T>

            <View style={styles.modalActions}>
              <Button
                title="Not Now"
                variant="outline"
                onPress={() => handleEnableBiometrics(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Enable"
                variant="brass"
                onPress={() => handleEnableBiometrics(true)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    backgroundColor: colors.light.navy900,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    color: colors.light.brass,
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.light.muted,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  formTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.foreground,
    marginBottom: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.light.lossSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBoxText: {
    color: colors.light.loss,
    fontSize: typography.fontSize.sm,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotText: {
    fontSize: typography.fontSize.sm,
    color: colors.light.brassStrong,
    fontWeight: typography.fontWeight.medium,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    color: colors.light.muted,
  },
  footerLink: {
    color: colors.light.brassStrong,
    fontWeight: typography.fontWeight.semibold,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 26, 51, 0.6)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.modal,
    padding: spacing.xl,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
    marginTop: spacing.md,
  },
  modalSub: {
    fontSize: typography.fontSize.sm,
    color: colors.light.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
});
