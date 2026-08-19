import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, type Palette } from '../theme/tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'bb-theme-mode';

type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  theme: Palette;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  isDark: false,
  theme: colors.light,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Restoring the saved choice is genuinely asynchronous, so this is not the
  // synchronous setState in useEffect that React Compiler rejects. Until it
  // resolves the app follows the OS, which is the same answer for most people
  // and never a flash of the wrong theme for the rest.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!active) return;
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      })
      .catch(() => {
        // A read failure means the default. Never block the shell on it.
      });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemColorScheme === 'dark');

  const value = useMemo(
    () => ({ mode, isDark, theme: isDark ? colors.dark : colors.light, setMode }),
    [mode, isDark, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Just the palette, for the common case. */
export function usePalette(): Palette {
  return useContext(ThemeContext).theme;
}
