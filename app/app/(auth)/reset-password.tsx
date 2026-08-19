import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { AuthShell, AuthLink } from '../../src/components/ui/AuthShell';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  // Cleared on unmount so a redirect that fires after the user has navigated
  // away cannot yank them back to the tabs.
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    [],
  );

  const handleUpdatePassword = async () => {
    // Supabase's own minimum is 6, but leaked-password protection and any
    // stricter project policy are enforced server-side — so the message the
    // user sees on failure comes from there, not from a second rule here.
    if (newPassword.length < 8) {
      setNotice('Use at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice('Those two passwords do not match.');
      return;
    }

    setNotice('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setNotice(error.message);
      } else {
        setNotice('Password updated. Taking you back in…');
        redirectTimer.current = setTimeout(() => router.replace('/(tabs)'), 1200);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose something you have not used elsewhere"
      error={notice}
      footer={
        <AuthLink
          prefix="Changed your mind?"
          action="Back to sign in"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      }
    >
      <Input
        label="New password"
        placeholder="••••••••"
        isPassword
        autoComplete="new-password"
        value={newPassword}
        onChangeText={setNewPassword}
        hint="At least 8 characters."
      />
      <Input
        label="Confirm new password"
        placeholder="••••••••"
        isPassword
        autoComplete="new-password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      <Button block size="lg" title="Update password" onPress={handleUpdatePassword} loading={loading} />
    </AuthShell>
  );
}
