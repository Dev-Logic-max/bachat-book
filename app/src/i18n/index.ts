import { I18n } from 'i18n-js';
import en from './en.json';
import ur from './ur.json';

const i18n = new I18n({
  en,
  ur,
});

i18n.defaultLocale = 'en';
i18n.enableFallback = true;

export function setI18nLocale(locale: string) {
  if (locale && (locale === 'ur' || locale.startsWith('ur'))) {
    i18n.locale = 'ur';
  } else {
    i18n.locale = 'en';
  }
}

export function t(key: string, options?: Record<string, any>): string {
  return i18n.t(key, options);
}

export default i18n;
