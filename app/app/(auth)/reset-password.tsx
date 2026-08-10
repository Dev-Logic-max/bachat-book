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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long');
      setIsSuccess(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      setIsSuccess(false);
      return;
    }

    setMessage('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage(error.message);
        setIsSuccess(false);
      } else {
        setMessage('Password updated successfully!');
        setIsSuccess(true);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1500);
      }
    } catch (e: any) {
      setMessage(e.message || 'Failed to update password');
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
          <T style={styles.title}>Set New Password</T>
          <T style={styles.subtitle}>Enter your new account password</T>
        </View>

        <View style={styles.formCard}>
          {!!message && (
            <View style={[styles.msgBox, isSuccess ? styles.successBox : styles.errorBox]}>
              <Text style={isSuccess ? styles.successText : styles.errorText}>{message}</Text>
            </View>
          )}

          <Input
            label="New Password"
            placeholder="••••••••"
            isPassword
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <Input
            label="Confirm New Password"
            placeholder="••••••••"
            isPassword
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Button
            title="Update Password"
            onPress={handleUpdatePassword}
            loading={loading}
            style={styles.submitBtn}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
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
