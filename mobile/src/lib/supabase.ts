import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Supabase client for accounts + cloud backup. Credentials come from public
 * env vars (the anon key is safe to ship — Row Level Security protects data).
 * Set these in mobile/.env:
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        // On native, persist in AsyncStorage. On web, use the default
        // (localStorage) so the email-verification redirect can restore it.
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Web: parse the confirmation/magic-link token from the URL on load.
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

/**
 * Bearer-token header for the current session, attached to calls to our paid
 * AI backend so it can authenticate and rate-limit per user. Returns an empty
 * object when signed out (the backend then rejects with 401).
 */
export async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
