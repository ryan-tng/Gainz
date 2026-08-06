import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage } from '@/lib/storage';
import type { Profile } from '@/lib/types';

interface ProfileContextValue {
  loaded: boolean;
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  clearProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      setProfileState(await storage.loadProfile());
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) void storage.saveProfile(profile);
  }, [profile, loaded]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      loaded,
      profile,
      setProfile: (p) => setProfileState(p),
      updateProfile: (patch) =>
        setProfileState((cur) => ({ name: '', ...cur, ...patch })),
      clearProfile: () => setProfileState(null),
    }),
    [loaded, profile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
