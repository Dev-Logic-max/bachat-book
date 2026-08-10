import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from '../../types/database';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// No hardcoded fallbacks. A baked-in project URL ships one developer's backend
// to every build, and an empty-string key fails later with an opaque 401 that
// looks like an auth bug rather than a missing .env. Fail here instead, where
// the message names the fix.
if (!URL || !KEY) {
  throw new Error(
    'Missing Supabase configuration. Copy app/.env.example to app/.env and set ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart the bundler ' +
      '(EXPO_PUBLIC_ vars are inlined at build time, so a running Metro will not pick them up).'
  );
}

export const supabase = createClient<Database>(URL, KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // REQUIRED: without this sign-in hangs on native
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
