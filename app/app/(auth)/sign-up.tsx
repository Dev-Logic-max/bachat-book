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

export default function SignUpScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignUp = async () => {
    if (!email.trim() || !password || !firstName.trim()) {
      setErrorMsg('First name, email and password are required');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.session) {
        // Automatically signed in
        router.replace('/(tabs)');
      } else {
        // Email confirmation enabled state
        setErrorMsg('Verification link sent to your email.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to sign up');
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
        {/* Header */}
        <View style={styles.header}>
          <T style={styles.title}>Create Account</T>
          <T style={styles.subtitle}>Join Bachat Book today</T>
        </View>

        {/* Card Form */}
        <View style={styles.formCard}>
          {!!errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{errorMsg}</Text>
            </View>
          )}

          <Input
            label="First Name"
            placeholder="Ali"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Input
            label="Last Name"
            placeholder="Khan"
            value={lastName}
            onChangeText={setLastName}
          />

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

          <Button
            title="Create Account"
            onPress={handleSignUp}
            loading={loading}
            style={styles.submitBtn}
          />
        </View>

        {/* Footer Link */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
            <T style={styles.footerText}>
              Already have an account? <Text style={styles.footerLink}>Sign in</Text>
            </T>
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
  submitBtn: {
    marginTop: spacing.md,
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
});
