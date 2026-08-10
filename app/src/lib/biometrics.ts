import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'BACHAT_BIOMETRIC_ENABLED';
const SIGN_IN_COUNT_KEY = 'BACHAT_SIGN_IN_COUNT';

/**
 * Check if the device has hardware & enrolled biometrics (Fingerprint/FaceID)
 */
export async function checkBiometricHardware(): Promise<{
  hasHardware: boolean;
  isEnrolled: boolean;
}> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return { hasHardware, isEnrolled };
  } catch (e) {
    return { hasHardware: false, isEnrolled: false };
  }
}

/**
 * Check if the user has opted-in to Biometric unlock
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Set Biometric opt-in preference
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
}

/**
 * Increment and check sign-in count for the "prompt after 2nd sign-in" rule (MOBILE-PLAN.md §1 & §11)
 */
export async function incrementSignInCount(): Promise<number> {
  try {
    const currentStr = await AsyncStorage.getItem(SIGN_IN_COUNT_KEY);
    const count = (parseInt(currentStr || '0', 10) || 0) + 1;
    await AsyncStorage.setItem(SIGN_IN_COUNT_KEY, count.toString());
    return count;
  } catch {
    return 1;
  }
}

/**
 * Authenticate user via Biometrics (Face ID / Fingerprint)
 */
export async function authenticateWithBiometrics(promptMessage = 'Unlock Bachat Book'): Promise<boolean> {
  try {
    const { hasHardware, isEnrolled } = await checkBiometricHardware();
    if (!hasHardware || !isEnrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Password',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (e) {
    console.warn('Biometric authentication failed:', e);
    return false;
  }
}
