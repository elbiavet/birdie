'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  buildClubCssVariables,
  getActiveClubConfig,
  getClubConfig,
  listRegisteredClubIds,
} from '@/lib/club-config';
import {
  DEMO_PROFILES_BY_ROLE,
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/lib/supabase/client';
import type { ClubConfig } from '@/types/club';
import type { PlayerProfile, UserRole } from '@/types/database';

export interface ClubContextValue {
  club: ClubConfig;
  availableClubIds: string[];
  switchClub: (clubId: string) => void;
  /** Perfil efectivo para la vista actual (puede ser el simulado si el usuario es superadmin), o null si no hay sesión activa */
  profile: PlayerProfile | null;
  /** Perfil real autenticado (fuente legítima de la autorización), o null si no hay sesión activa */
  authenticatedProfile: PlayerProfile | null;
  /** Indica si hay un usuario autenticado con sesión activa */
  isAuthenticated: boolean;
  /** Indica si el usuario autenticado tiene rol superadmin y por tanto permiso de simulación */
  canSimulateRoles: boolean;
  /** Rol simulado actualmente, o null si se utiliza el perfil autenticado real */
  simulatedRole: UserRole | null;
  /** Simula un rol RLS (player, club_admin, superadmin). Retorna true si es autorizado, false si se rechaza */
  setRole: (role: UserRole) => boolean;
  /** Restablece la simulación y vuelve al perfil autenticado original */
  resetSimulatedRole: () => void;
  /** Autentica en modo demo con credenciales autorizadas */
  loginWithDemo: (
    email: string,
    password?: string
  ) => { success: boolean; error?: string; profile?: PlayerProfile };
  /** Asigna directamente el perfil autenticado (ej. tras login real en Supabase) */
  setAuthenticatedProfile: (profile: PlayerProfile | null) => void;
  /** Cierra la sesión activa, limpia todo el almacenamiento local/sesión y no restaura el rol player */
  logout: () => void;
  updateProfile: (patch: Partial<PlayerProfile>) => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
}

const ClubContext = createContext<ClubContextValue | null>(null);

const CLUB_OVERRIDE_STORAGE_KEY = 'birdie_active_club_override_v1';
const DEMO_AUTH_SESSION_KEY = 'birdie_demo_auth_session_v1';
const SIMULATED_ROLE_STORAGE_KEY = 'birdie_simulated_role_v1';
const LOGGED_OUT_STORAGE_KEY = 'birdie_session_logged_out_v1';

/**
 * Resuelve un perfil de demostración autorizado a partir de su correo oficial.
 */
export function resolveAuthorizedDemoProfile(email: string): PlayerProfile | null {
  const normalized = email.trim().toLowerCase();
  if (normalized === DEMO_PROFILES_BY_ROLE.superadmin.email.toLowerCase()) {
    return DEMO_PROFILES_BY_ROLE.superadmin;
  }
  if (normalized === DEMO_PROFILES_BY_ROLE.club_admin.email.toLowerCase()) {
    return DEMO_PROFILES_BY_ROLE.club_admin;
  }
  if (normalized === DEMO_PROFILES_BY_ROLE.player.email.toLowerCase()) {
    return DEMO_PROFILES_BY_ROLE.player;
  }
  return null;
}

export function ClubProvider({
  children,
  initialClubId,
  initialProfile,
}: {
  children: React.ReactNode;
  initialClubId?: string;
  initialProfile?: PlayerProfile | null;
}) {
  const defaultClub = useMemo(
    () => (initialClubId ? getClubConfig(initialClubId) : getActiveClubConfig()),
    [initialClubId]
  );

  const [club, setClub] = useState<ClubConfig>(defaultClub);

  // Perfil autenticado real (fuente de verdad de autorización)
  const [authenticatedProfile, setAuthenticatedProfileState] = useState<PlayerProfile | null>(() => {
    if (initialProfile !== undefined) {
      return initialProfile;
    }
    if (typeof window !== 'undefined') {
      try {
        if (window.sessionStorage.getItem(LOGGED_OUT_STORAGE_KEY) === 'true') {
          return null;
        }
        const savedSessionEmail = window.sessionStorage.getItem(DEMO_AUTH_SESSION_KEY);
        if (savedSessionEmail) {
          const authorized = resolveAuthorizedDemoProfile(savedSessionEmail);
          if (authorized) {
            return authorized;
          }
        }
      } catch {
        // Ignorar
      }
    }
    // REGLA DE SEGURIDAD: Nunca auto-restaurar una sesión estándar ni simular sesión demo sin autenticación
    return null;
  });

  // Rol simulado (únicamente permitido cuando authenticatedProfile?.role === 'superadmin')
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);

  // Perfil efectivo (vista activa)
  const [profile, setProfile] = useState<PlayerProfile | null>(authenticatedProfile);

  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Sincronizar el perfil efectivo cuando cambia el perfil autenticado o la simulación
  useEffect(() => {
    if (!authenticatedProfile) {
      setProfile(null);
      return;
    }
    if (simulatedRole && authenticatedProfile.role === 'superadmin') {
      const demoCandidate = DEMO_PROFILES_BY_ROLE[simulatedRole];
      if (demoCandidate) {
        setProfile(demoCandidate);
        return;
      }
    }
    // Si no hay simulación autorizada, el perfil efectivo es exactamente el autenticado
    setProfile(authenticatedProfile);
  }, [authenticatedProfile, simulatedRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Limpieza de claves obsoletas de localStorage que confiaban ciegamente en roles
    try {
      window.localStorage.removeItem('birdie_active_role_v1');
    } catch {
      // Ignorar si el almacenamiento local está bloqueado por el navegador
    }

    // 2. Club override
    try {
      const savedClub = window.localStorage.getItem(CLUB_OVERRIDE_STORAGE_KEY);
      if (savedClub && listRegisteredClubIds().includes(savedClub)) {
        setClub(getClubConfig(savedClub));
      }
    } catch {
      // Ignorar
    }

    // 3. Restaurar sesión demo autorizada (si no se inyectó initialProfile explícito en props)
    if (initialProfile === undefined) {
      try {
        const isLoggedOut = window.sessionStorage.getItem(LOGGED_OUT_STORAGE_KEY) === 'true';
        if (isLoggedOut) {
          setAuthenticatedProfileState(null);
          setProfile(null);
        } else {
          const savedSessionEmail = window.sessionStorage.getItem(DEMO_AUTH_SESSION_KEY);
          if (savedSessionEmail) {
            const authorized = resolveAuthorizedDemoProfile(savedSessionEmail);
            if (authorized) {
              setAuthenticatedProfileState(authorized);

              // Si es superadmin, verificar si había una simulación guardada en la misma sesión
              if (authorized.role === 'superadmin') {
                const savedSim = window.sessionStorage.getItem(
                  SIMULATED_ROLE_STORAGE_KEY
                ) as UserRole | null;
                if (savedSim && DEMO_PROFILES_BY_ROLE[savedSim]) {
                  setSimulatedRole(savedSim);
                }
              }
            }
          }
        }
      } catch {
        // Ignorar
      }
    }

    // 4. Si Supabase está configurado con credenciales reales, sincronizar sesión
    let authSubscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
              .then(({ data, error }) => {
                if (data && !error) {
                  const role = (data.role ||
                    session.user.app_metadata?.role ||
                    'player') as UserRole;
                  const realProfile: PlayerProfile = {
                    id: data.id,
                    email: data.email || session.user.email || '',
                    fullName: data.full_name || '',
                    federationLicense: data.federation_license || '',
                    handicapIndex: Number(data.handicap_index) || 0,
                    role,
                    phone: data.phone || '',
                    bio: data.bio || '',
                    avatarUrl: data.avatar_url,
                    isDirectoryVisible: Boolean(data.is_directory_visible),
                    updatedAt: data.updated_at || new Date().toISOString(),
                  };
                  setAuthenticatedProfileState(realProfile);
                }
              });
          }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === 'SIGNED_OUT' || !session?.user) {
              setAuthenticatedProfileState(null);
              setSimulatedRole(null);
              setProfile(null);
            } else if (
              event === 'SIGNED_IN' ||
              event === 'TOKEN_REFRESHED' ||
              event === 'USER_UPDATED'
            ) {
              const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              if (data) {
                const role = (data.role ||
                  session.user.app_metadata?.role ||
                  'player') as UserRole;
                setAuthenticatedProfileState({
                  id: data.id,
                  email: data.email || session.user.email || '',
                  fullName: data.full_name || '',
                  federationLicense: data.federation_license || '',
                  handicapIndex: Number(data.handicap_index) || 0,
                  role,
                  phone: data.phone || '',
                  bio: data.bio || '',
                  avatarUrl: data.avatar_url,
                  isDirectoryVisible: Boolean(data.is_directory_visible),
                  updatedAt: data.updated_at || new Date().toISOString(),
                });
              }
            }
          }
        );
        authSubscription = authListener.subscription;
      }
    }

    // 5. Estado de red
    setIsOnline(window.navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      authSubscription?.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [initialProfile]);

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
      try {
        window.localStorage.setItem(CLUB_OVERRIDE_STORAGE_KEY, nextClub.clubId);
      } catch {
        // Ignorar
      }
    }
  };

  /**
   * Cambia o simula el rol activo.
   * REGLA DE SEGURIDAD: Solo un usuario cuyo rol autenticado sea 'superadmin' puede simular roles.
   * Cualquier intento por parte de otro rol es rechazado tajantemente en la lógica.
   */
  const setRole = (role: UserRole): boolean => {
    if (!authenticatedProfile || authenticatedProfile.role !== 'superadmin') {
      console.warn(
        `[Birdie RBAC] Intento denegado: el usuario autenticado (${authenticatedProfile?.email ?? 'sin sesión'}, rol "${authenticatedProfile?.role ?? 'ninguno'}") no tiene privilegios de superadmin para simular el rol "${role}".`
      );
      return false;
    }

    const nextProfile = DEMO_PROFILES_BY_ROLE[role];
    if (!nextProfile) {
      return false;
    }

    setSimulatedRole(role);
    setProfile(nextProfile);

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(SIMULATED_ROLE_STORAGE_KEY, role);
      } catch {
        // Ignorar
      }
    }
    return true;
  };

  const resetSimulatedRole = () => {
    setSimulatedRole(null);
    setProfile(authenticatedProfile);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
      } catch {
        // Ignorar
      }
    }
  };

  /**
   * Inicio de sesión en modo de demostración.
   * Valida explícitamente el correo contra los perfiles autorizados del sistema.
   * Para obtener rol 'superadmin' se debe ingresar el correo 'ops@birdie.app'.
   */
  const loginWithDemo = (
    email: string,
    _password?: string
  ): { success: boolean; error?: string; profile?: PlayerProfile } => {
    const authorized = resolveAuthorizedDemoProfile(email);
    if (!authorized) {
      return {
        success: false,
        error:
          'Credenciales no autorizadas. En modo demo utilice un perfil registrado: ops@birdie.app (superadmin), comite@rcgvalleverde.es (club_admin) o carlos.mendoza@socio.es (jugador).',
      };
    }

    setAuthenticatedProfileState(authorized);
    setSimulatedRole(null);
    setProfile(authorized);

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(LOGGED_OUT_STORAGE_KEY);
        window.sessionStorage.setItem(DEMO_AUTH_SESSION_KEY, authorized.email);
        window.sessionStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
      } catch {
        // Ignorar
      }
    }

    return {
      success: true,
      profile: authorized,
    };
  };

  const setAuthenticatedProfile = (newAuthProfile: PlayerProfile | null) => {
    setAuthenticatedProfileState(newAuthProfile);
    setSimulatedRole(null);
    setProfile(newAuthProfile);
    if (typeof window !== 'undefined') {
      try {
        if (newAuthProfile) {
          window.sessionStorage.removeItem(LOGGED_OUT_STORAGE_KEY);
        } else {
          window.sessionStorage.setItem(LOGGED_OUT_STORAGE_KEY, 'true');
        }
      } catch {
        // Ignorar
      }
    }
  };

  const logout = () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          supabase.auth.signOut().catch(() => {});
        }
      } catch {
        // Ignorar
      }
    }

    // Invalida el estado en memoria: NO restaura el perfil estándar 'player'
    setAuthenticatedProfileState(null);
    setSimulatedRole(null);
    setProfile(null);

    // Limpia y purga el almacenamiento local/sesión para evitar restaurar la sesión
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(DEMO_AUTH_SESSION_KEY);
        window.sessionStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
        window.sessionStorage.setItem(LOGGED_OUT_STORAGE_KEY, 'true');

        window.localStorage.removeItem('birdie_active_role_v1');
        window.localStorage.removeItem('birdie_demo_auth_session_v1');
        window.localStorage.removeItem('birdie_simulated_role_v1');
      } catch {
        // Ignorar
      }

      // Redirige al usuario a la página de inicio de sesión
      try {
        if (window.location && window.location.pathname !== '/login') {
          if (typeof window.location.assign === 'function') {
            window.location.assign('/login');
          } else {
            window.location.href = '/login';
          }
        }
      } catch {
        // Ignorar en entornos donde window.location sea inmutable
      }
    }
  };

  const updateProfile = (patch: Partial<PlayerProfile>) => {
    if (!profile) return;
    const updatedAt = new Date().toISOString();
    setProfile((prev) => (prev ? { ...prev, ...patch, updatedAt } : null));
    setAuthenticatedProfileState((prev) =>
      prev ? { ...prev, ...patch, updatedAt } : null
    );
  };

  const canSimulateRoles = authenticatedProfile?.role === 'superadmin';
  const isAuthenticated = authenticatedProfile !== null;

  const value: ClubContextValue = {
    club,
    availableClubIds: listRegisteredClubIds(),
    switchClub,
    profile,
    authenticatedProfile,
    isAuthenticated,
    canSimulateRoles,
    simulatedRole,
    setRole,
    resetSimulatedRole,
    loginWithDemo,
    setAuthenticatedProfile,
    logout,
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
