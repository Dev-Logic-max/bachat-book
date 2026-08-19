import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Globe, Lock, Moon, Shield, User } from 'lucide-react-native';
import { Screen } from '../../src/components/ui/Screen';
import { Card, SectionHeader, Segmented } from '../../src/components/ui/Surfaces';
import { Button, IconButton } from '../../src/components/ui/Button';
import { Numeric } from '../../src/components/ui/Money';
import { T } from '../../src/components/T';
import { usePalette, useTheme, type ThemeMode } from '../../src/providers/theme-provider';
import { useSession } from '../../src/providers/auth-provider';
import { formatName } from '../../src/lib/format';
import { radii, spacing, typography } from '../../src/theme/tokens';
import {
  checkBiometricHardware,
  isBiometricEnabled,
  setBiometricEnabled,
} from '../../src/lib/biometrics';

export default function SettingsScreen() {
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { user, profile, householdId, signOut } = useSession();
  const { mode, setMode } = useTheme();

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricActive, setBiometricActive] = useState(false);

  // Both reads are asynchronous, so neither is the synchronous setState in
  // useEffect that React Compiler rejects.
  useEffect(() => {
    let active = true;
    checkBiometricHardware().then(({ hasHardware, isEnrolled }) => {
      if (active) setBiometricSupported(hasHardware && isEnrolled);
    });
    isBiometricEnabled().then((enabled) => {
      if (active) setBiometricActive(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleBiometric = async (value: boolean) => {
    setBiometricActive(value);
    await setBiometricEnabled(value);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.sm,
        }}
      >
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={19} color={palette.foreground2} />
        </IconButton>
        <T
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: typography.fontSize.lg,
            fontWeight: '700',
            color: palette.foreground,
          }}
        >
          Settings
        </T>
        <View style={{ width: 40 }} />
      </View>

      <Screen topInset={false}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radii.full,
                backgroundColor: palette.brassSoft,
                borderWidth: 1,
                borderColor: palette.brass,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={23} color={palette.brassStrong} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <T
                style={{
                  fontSize: typography.fontSize.lg,
                  fontWeight: '700',
                  color: palette.foreground,
                }}
              >
                {formatName(profile?.first_name, profile?.last_name)}
              </T>
              <Numeric style={{ fontSize: typography.fontSize.sm, color: palette.muted }}>
                {user?.email ?? '—'}
              </Numeric>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Appearance" />
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Moon size={18} color={palette.foreground2} />
              <T
                style={{ flex: 1, fontSize: typography.fontSize.base, color: palette.foreground }}
              >
                Theme
              </T>
            </View>
            <Segmented<ThemeMode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Card>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Security" />
          <Card padded={false}>
            {biometricSupported ? (
              <SettingRow icon={<Lock size={18} color={palette.foreground2} />} label="Lock with fingerprint or face">
                <Switch
                  value={biometricActive}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: palette.border, true: palette.brass }}
                  thumbColor={palette.surface}
                />
              </SettingRow>
            ) : null}

            <SettingRow icon={<Shield size={18} color={palette.foreground2} />} label="Workspace" last>
              <Numeric style={{ fontSize: typography.fontSize.sm, color: palette.muted }}>
                {householdId ? `${householdId.slice(0, 8)}…` : 'None'}
              </Numeric>
            </SettingRow>
          </Card>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Language" />
          <Card padded={false}>
            <SettingRow icon={<Globe size={18} color={palette.foreground2} />} label="Language" last>
              {/* Read from `profiles.locale`. `preferences.locale` does not
                  exist — querying it returns an error, not a fallback. */}
              <Text style={{ fontSize: typography.fontSize.sm, color: palette.muted }}>
                {profile?.locale === 'ur' ? 'اردو' : 'English'}
              </Text>
            </SettingRow>
          </Card>
          <T
            style={{
              fontSize: typography.fontSize.xs,
              color: palette.faint,
              marginTop: spacing.sm,
            }}
          >
            Change your language on the web app for now.
          </T>
        </View>

        <Button
          block
          variant="danger"
          title="Sign out"
          style={{ marginTop: spacing.xxxl }}
          onPress={signOut}
        />
      </Screen>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  children,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
  last?: boolean;
}) {
  const palette = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      {icon}
      <T style={{ flex: 1, fontSize: typography.fontSize.base, color: palette.foreground }}>
        {label}
      </T>
      {children}
    </View>
  );
}
