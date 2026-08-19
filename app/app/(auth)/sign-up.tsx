import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { AuthShell, AuthLink } from '../../src/components/ui/AuthShell';

export default function SignUpScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const handleSignUp = async () => {
    if (!firstName.trim() || !email.trim() || !password) {
      setNotice('First name, email and password are all required.');
      return;
    }

    setNotice('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // `handle_new_user` reads these to seed the profile and the first
          // workspace. That trigger's REST endpoint is revoked from public, so
          // this is the only path that reaches it.
          data: { first_name: firstName.trim(), last_name: lastName.trim() },
        },
      });

      if (error) {
        setNotice(error.message);
      } else if (data.session) {
        router.replace('/(tabs)');
      } else {
        setNotice('Check your email — we sent a link to confirm your address.');
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="One book for your money, your household and your bills"
      error={notice}
      footer={
        <AuthLink
          prefix="Already have an account?"
          action="Sign in"
          onPress={() => router.push('/(auth)/sign-in')}
        />
      }
    >
      <Input label="First name" placeholder="Ali" value={firstName} onChangeText={setFirstName} />
      <Input label="Last name" placeholder="Khan" value={lastName} onChangeText={setLastName} />
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
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        hint="At least 8 characters."
      />
      <Button block size="lg" title="Create account" onPress={handleSignUp} loading={loading} />
    </AuthShell>
  );
}
