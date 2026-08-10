import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export interface ParsedAuthCallback {
  type?: 'recovery' | 'signup' | 'magiclink' | null;
  success: boolean;
}

/**
 * Handle incoming deep links (e.g. bachatbook://auth/callback)
 * Supports URL fragments (#access_token=...), PKCE (?code=...), and recovery flow (L7 fix).
 */
export async function handleDeepLink(url: string | null): Promise<ParsedAuthCallback> {
  if (!url) return { success: false };

  try {
    const parsed = Linking.parse(url);
    const { path, queryParams, hostname } = parsed;

    // Check if URL is an auth callback
    const isAuthPath = path === 'auth/callback' || hostname === 'auth' || url.includes('auth/callback');
    if (!isAuthPath) return { success: false };

    // 1. Check for URL fragment (#access_token=...&refresh_token=...&type=recovery)
    if (url.includes('#')) {
      const fragment = url.split('#')[1];
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type') as 'recovery' | 'signup' | 'magiclink' | null;

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        return { success: !error, type };
      }
    }

    // 2. Check for PKCE ?code= authorization code
    if (queryParams?.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(queryParams.code as string);
      return { success: !error, type: queryParams.type as any || null };
    }

    // 3. Fallback queryParams checks
    if (queryParams?.access_token && queryParams?.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: queryParams.access_token as string,
        refresh_token: queryParams.refresh_token as string,
      });
      return { success: !error, type: queryParams.type as any || null };
    }
  } catch (e) {
    console.warn('Error parsing deep link URL:', e);
  }

  return { success: false };
}
