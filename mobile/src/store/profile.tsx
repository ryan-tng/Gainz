import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, uid } from '@/lib/storage';
import type { BodyWeightEntry, Profile } from '@/lib/types';

interface ProfileContextValue {
  loaded: boolean;
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  clearProfile: () => void;
  /** Body-weight log, newest first. */
  bodyWeights: BodyWeightEntry[];
  addBodyWeight: (weightLb: number) => void;
  deleteBodyWeight: (id: string) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [bodyWeights, setBodyWeights] = useState<BodyWeightEntry[]>([]);

  useEffect(() => {
    (async () => {
      const [p, bw] = await Promise.all([storage.loadProfile(), storage.loadBodyWeights()]);
      setProfileState(p);
      setBodyWeights(bw);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) void storage.saveProfile(profile);
  }, [profile, loaded]);
  useEffect(() => {
    if (loaded) void storage.saveBodyWeights(bodyWeights);
  }, [bodyWeights, loaded]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      loaded,
      profile,
      setProfile: (p) => setProfileState(p),
      updateProfile: (patch) => setProfileState((cur) => ({ name: '', ...cur, ...patch })),
      clearProfile: () => setProfileState(null),
      bodyWeights,
      addBodyWeight: (weightLb) =>
        setBodyWeights((cur) =>
          [{ id: uid('bw'), loggedAt: Date.now(), weightLb }, ...cur].sort(
            (a, b) => b.loggedAt - a.loggedAt,
          ),
        ),
      deleteBodyWeight: (id) => setBodyWeights((cur) => cur.filter((e) => e.id !== id)),
    }),
    [loaded, profile, bodyWeights],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
