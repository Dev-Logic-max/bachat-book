import { Platform, ViewStyle } from 'react-native';

export const shadows = {
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
  lg: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
    default: {},
  }),
  floatingNav: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0B1A33',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.20,
      shadowRadius: 20,
    },
    android: {
      elevation: 12,
    },
    default: {},
  }),
};
