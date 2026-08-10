import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/providers/auth-provider';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { Button } from '../../src/components/ui/Button';
import { T } from '../../src/components/T';
import { ArrowLeft, User, Shield, Globe, Lock } from 'lucide-react-native';
import {
  checkBiometricHardware,
  isBiometricEnabled,
  setBiometricEnabled,
} from '../../src/lib/biometrics';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, householdId, signOut } = useSession();

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricActive, setBiometricActive] = useState(false);

  useEffect(() => {
    checkBiometricHardware().then(({ hasHardware, isEnrolled }) => {
      setBiometricSupported(hasHardware && isEnrolled);
    });
    isBiometricEnabled().then(setBiometricActive);
  }, []);

  const handleToggleBiometric = async (value: boolean) => {
    setBiometricActive(value);
    await setBiometricEnabled(value);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.light.foreground} />
        </TouchableOpacity>
        <T style={styles.headerTitle}>Settings</T>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatarBg}>
              <User size={24} color={colors.light.navy900} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={styles.userName}>
                {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : 'User'}
              </T>
              <T style={styles.userEmail}>{user?.email || 'No email'}</T>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <T style={styles.sectionHeader}>Security</T>
        <View style={styles.card}>
          {biometricSupported && (
            <>
              <View style={styles.settingRow}>
                <Lock size={18} color={colors.light.navy900} />
                <T style={styles.settingLabel}>Biometric App Lock</T>
                <Switch
                  value={biometricActive}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: colors.light.border, true: colors.light.brass }}
                  thumbColor={colors.light.surface}
                />
              </View>

              <View style={styles.divider} />
            </>
          )}

          <View style={styles.settingRow}>
            <Shield size={18} color={colors.light.navy900} />
            <T style={styles.settingLabel}>Active Household ID</T>
            <Text style={styles.settingValMono} numberOfLines={1}>
              {householdId ? `${householdId.slice(0, 8)}...` : 'None'}
            </Text>
          </View>
        </View>

        {/* Preferences Section */}
        <T style={styles.sectionHeader}>Preferences</T>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <Globe size={18} color={colors.light.navy900} />
            <T style={styles.settingLabel}>Language / Locale</T>
            <T style={styles.settingVal}>{profile?.locale === 'ur' ? 'اردو (Urdu)' : 'English'}</T>
          </View>
        </View>

        <Button
          title="Sign Out"
          variant="danger"
          onPress={signOut}
          style={styles.signOutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.navy900,
  },
  content: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light.brassSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.foreground,
  },
  userEmail: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  settingLabel: {
    fontSize: typography.fontSize.base,
    color: colors.light.foreground,
    flex: 1,
  },
  settingVal: {
    fontSize: typography.fontSize.sm,
    color: colors.light.muted,
    fontWeight: typography.fontWeight.medium,
  },
  settingValMono: {
    fontSize: typography.fontSize.xs,
    color: colors.light.muted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: colors.light.border,
    marginVertical: spacing.xs,
  },
  signOutBtn: {
    marginTop: spacing.md,
  },
});
