'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  buildClubCssVariables,
  getActiveClubConfig,
  getClubConfig,
  listRegisteredClubIds,
} from '@/lib/club-config';
import { DEMO_PROFILES_BY_ROLE } from '@/lib/supabase/client';
import type { ClubConfig } from '@/types/club';
import type { PlayerProfile, UserRole } from '@/types/database';

interface ClubContextValue {
  club: ClubConfig;
  availableClubIds: string[];
  switchClub: (clubId: string) => void;
  profile: PlayerProfile;
  setRole: (role: UserRole) => void;
  updateProfile: (patch: Partial<PlayerProfile>) => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
}

const ClubContext = createContext<ClubContextValue | null>(null);

const ROLE_STORAGE_KEY = 'birdie_active_role_v1';
const CLUB_OVERRIDE_STORAGE_KEY = 'birdie_active_club_override_v1';

export function ClubProvider({
  children,
  initialClubId,
}: {
  children: React.ReactNode;
  initialClubId?: string;
}) {
  const defaultClub = useMemo(
    () => (initialClubId ? getClubConfig(initialClubId) : getActiveClubConfig()),
    [initialClubId]
  );

  const [club, setClub] = useState<ClubConfig>(defaultClub);
  const [profile, setProfile] = useState<PlayerProfile>(DEMO_PROFILES_BY_ROLE.player);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedClub = window.localStorage.getItem(CLUB_OVERRIDE_STORAGE_KEY);
    if (savedClub && listRegisteredClubIds().includes(savedClub)) {
      setClub(getClubConfig(savedClub));
    }

    const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null;
    if (savedRole && DEMO_PROFILES_BY_ROLE[savedRole]) {
      setProfile(DEMO_PROFILES_BY_ROLE[savedRole]);
    }

    setIsOnline(window.navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cssVars = buildClubCssVariables(club);
    for (const [key, value] of Object.entries(cssVars)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [club]);

  const switchClub = (clubId: string) => {
    const nextClub = getClubConfig(clubId);
    setClub(nextClub);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CLUB_OVERRIDE_STORAGE_KEY, nextClub.clubId);
    }
  };

  const setRole = (role: UserRole) => {
    const nextProfile = DEMO_PROFILES_BY_ROLE[role];
    setProfile(nextProfile);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    }
  };

  const updateProfile = (patch: Partial<PlayerProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  };

  const value: ClubContextValue = {
    club,
    availableClubIds: listRegisteredClubIds(),
    switchClub,
    profile,
    setRole,
    updateProfile,
    isOnline,
    setIsOnline,
  };

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub(): ClubContextValue {
  const ctx = useContext(ClubContext);
  if (!ctx) {
    throw new Error('useClub() debe utilizarse dentro de un <ClubProvider>.');
  }
  return ctx;
}
