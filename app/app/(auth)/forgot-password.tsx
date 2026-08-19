import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { AuthShell, AuthLink } from '../../src/components/ui/AuthShell';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const handleReset = async () => {
    if (!email.trim()) {
      setNotice('Enter the email address you signed up with.');
      return;
    }

    setNotice('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // Registered in app.json as `scheme`. The root layout listens for this
        // and routes a `recovery` link to the reset screen.
        redirectTo: 'bachatbook://auth/callback',
      });

      setNotice(
        error ? error.message : 'Check your email — we sent a link to reset your password.',
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not send the reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a link to set a new one"
      error={notice}
      footer={
        <AuthLink
          prefix="Remembered it?"
          action="Back to sign in"
          onPress={() => router.push('/(auth)/sign-in')}
        />
      }
    >
      <Input
        label="Email"
        placeholder="name@domain.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <Button block size="lg" title="Send reset link" onPress={handleReset} loading={loading} />
    </AuthShell>
  );
}
