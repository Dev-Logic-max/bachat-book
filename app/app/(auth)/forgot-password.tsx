import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { T } from '../../src/components/T';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      setMessage('Please enter your email address');
      setIsSuccess(false);
      return;
    }

    setMessage('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'bachatbook://auth/callback',
      });

      if (error) {
        setMessage(error.message);
        setIsSuccess(false);
      } else {
        setMessage('Password reset link sent to your email.');
        setIsSuccess(true);
      }
    } catch (e: any) {
      setMessage(e.message || 'Failed to send reset link');
      setIsSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <T style={styles.title}>Reset Password</T>
          <T style={styles.subtitle}>Enter your email to receive a reset link</T>
        </View>

        <View style={styles.formCard}>
          {!!message && (
            <View style={[styles.msgBox, isSuccess ? styles.successBox : styles.errorBox]}>
              <Text style={isSuccess ? styles.successText : styles.errorText}>{message}</Text>
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

          <Button
            title="Send Reset Link"
            onPress={handleReset}
            loading={loading}
            style={styles.submitBtn}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
            <T style={styles.footerLink}>← Back to Sign In</T>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.light.muted,
    marginTop: 4,
    textAlign: 'center',
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
  msgBox: {
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.light.lossSoft,
  },
  successBox: {
    backgroundColor: colors.light.gainSoft,
  },
  errorText: {
    color: colors.light.loss,
    fontSize: typography.fontSize.sm,
  },
  successText: {
    color: colors.light.gain,
    fontSize: typography.fontSize.sm,
  },
  submitBtn: {
    marginTop: spacing.md,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  footerLink: {
    color: colors.light.brassStrong,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
});
