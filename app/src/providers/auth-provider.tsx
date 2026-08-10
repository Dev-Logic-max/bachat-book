import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/query-client';
import type { Tables } from '../../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Tables<'profiles'> | null;
  householdId: string | null;
  isLoading: boolean;
  setHouseholdId: (id: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  householdId: null,
  isLoading: true,
  setHouseholdId: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserData(session.user.id);
        } else {
          setProfile(null);
          setHouseholdId(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile (using profiles.locale as verified in MOBILE-PLAN.md §0.5)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Resolve the household the SAME way the web does (web/src/lib/session.ts):
      // preferences.default_household_id first, membership only as a fallback.
      // Reading membership with a bare limit(1) and no ordering meant a user in
      // more than one household could land in a different workspace on mobile
      // than on web — and the web workspace switcher writes exactly this column.
      const { data: prefs } = await supabase
        .from('preferences')
        .select('default_household_id')
        .eq('user_id', userId)
        .maybeSingle();

      let resolved = prefs?.default_household_id ?? null;

      if (resolved) {
        // Confirm the user is still a member — a stale default (removed from the
        // household on another device) would otherwise scope every query to a
        // household RLS refuses, giving empty lists and no error anywhere.
        const { data: check } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', userId)
          .eq('household_id', resolved)
          .maybeSingle();
        if (!check) resolved = null;
      }

      if (!resolved) {
        // Deliberately unordered. The live table's timestamp column is
        // `created_at`, but types.ts declares `joined_at` — see the types-drift
        // note in the audit. Ordering by either is a runtime 400 or a type
        // error until types.ts is regenerated from the live schema.
        const { data: memberData } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', userId)
          .limit(1);

        resolved = memberData?.[0]?.household_id ?? null;
      }

      setHouseholdId(resolved);
    } catch (e) {
      console.warn('Error fetching user auth data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();

    // Purge the persisted read cache (MOBILE-PLAN.md §5.2). Without this the
    // next user on a shared family phone — the normal case in Pakistan — sees
    // the previous user's balances rendered from cache before the first fetch.
    queryClient.clear();
    await AsyncStorage.removeItem('BACHAT_QUERY_CACHE');
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        householdId,
        isLoading,
        setHouseholdId,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  return useContext(AuthContext);
}
