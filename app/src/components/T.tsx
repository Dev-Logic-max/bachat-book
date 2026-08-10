import React from 'react';
import { Text as RNText, TextProps, StyleProp, TextStyle } from 'react-native';
import { t } from '../i18n';

interface TProps extends TextProps {
  children?: React.ReactNode;
  txKey?: string;
  txOptions?: Record<string, any>;
  style?: StyleProp<TextStyle>;
}

/**
 * Text component wrapper for i18n copy.
 * CRITICAL RULE (CLAUDE.md & MOBILE-PLAN.md §8):
 * Layout NEVER mirrors. Layout stays LTR.
 * Urdu changes text direction inside text nodes ONLY via `writingDirection: 'auto'`.
 * Numbers, money, and brand names do NOT go through this wrapper.
 */
export function T({ children, txKey, txOptions, style, ...props }: TProps) {
  let content = children;

  if (txKey) {
    content = t(txKey, txOptions);
  }

  return (
    <RNText style={[{ writingDirection: 'auto' }, style]} {...props}>
      {content}
    </RNText>
  );
}
