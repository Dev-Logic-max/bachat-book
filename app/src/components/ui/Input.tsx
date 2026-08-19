import React, { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { usePalette } from '../../providers/theme-provider';
import { NUMERIC } from './Money';
import { radii, spacing, typography } from '../../theme/tokens';
import { T } from '../T';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  isPassword?: boolean;
  /** Leading affordance — a currency symbol, a search glass. */
  prefix?: React.ReactNode;
  /** Forces LTR + tabular figures. On for anything numeric. */
  numeric?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  error,
  hint,
  isPassword = false,
  prefix,
  numeric = false,
  containerStyle,
  style,
  secureTextEntry,
  ...props
}: InputProps) {
  const palette = usePalette();
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const isSecure = isPassword ? !showPassword : secureTextEntry;
  const borderColor = error ? palette.loss : focused ? palette.brass : palette.border;

  return (
    <View style={[{ gap: spacing.sm }, containerStyle]}>
      {label ? (
        <T
          style={{
            fontSize: typography.fontSize.sm,
            fontWeight: '600',
            color: palette.foreground2,
          }}
        >
          {label}
        </T>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: palette.surface,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor,
          borderRadius: radii.control,
          paddingHorizontal: spacing.lg,
        }}
      >
        {prefix}
        <TextInput
          style={[
            {
              flex: 1,
              height: 52,
              fontSize: typography.fontSize.base,
              color: palette.foreground,
            } as TextStyle,
            // Urdu bidi would otherwise push a leading minus to the trailing
            // edge inside the field itself, not just when rendering it back.
            numeric ? NUMERIC : null,
            style,
          ]}
          placeholderTextColor={palette.faint}
          secureTextEntry={isSecure}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff size={20} color={palette.muted} />
            ) : (
              <Eye size={20} color={palette.muted} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={{ fontSize: typography.fontSize.xs, color: palette.loss }}>{error}</Text>
      ) : hint ? (
        <T style={{ fontSize: typography.fontSize.xs, color: palette.muted }}>{hint}</T>
      ) : null}
    </View>
  );
}
