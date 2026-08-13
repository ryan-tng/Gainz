import type { User } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { storage } from '@/lib/storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { restoreFromCloud } from '@/lib/sync';

interface AuthContextValue {
  /** Whether Supabase credentials are present in this build. */
  configured: boolean;
  loading: boolean;
  user: User | null;
  /** Bumped on sign-out to remount (and reset) the whole data/UI tree. */
  resetKey: number;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true if a session started, false if email confirmation is required. */
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  // The user id whose cloud data we've already pulled this run.
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    // Initial launch: if there's a session, pull the account's cloud data into
    // local storage BEFORE the app mounts, so it loads with their data.
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      if (u) {
        await restoreFromCloud().catch(() => {});
        syncedRef.current = u.id;
      }
      setUser(u);
      setLoading(false);
    })();

    // Subsequent auth changes (in-app sign-in on a new account): pull, then
    // remount the tree so every store reloads with the pulled data.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      if (u && u.id !== syncedRef.current) {
        await restoreFromCloud().catch(() => {});
        syncedRef.current = u.id;
        setUser(u);
        setResetKey((k) => k + 1);
      } else if (!u) {
        syncedRef.current = null;
        setUser(null);
      } else {
        setUser(u); // token refresh / same account
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      user,
      resetKey,
      signIn: async (email, password) => {
        if (!supabase) throw new Error('Cloud accounts are not configured.');
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message);
      },
      signUp: async (email, password) => {
        if (!supabase) throw new Error('Cloud accounts are not configured.');
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(error.message);
        return data.session !== null; // false → needs email confirmation
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        // Wipe all on-device personalization/data, then remount the app tree.
        await storage.clearAll();
        syncedRef.current = null;
        setUser(null);
        setResetKey((k) => k + 1);
      },
    }),
    [loading, user, resetKey],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
