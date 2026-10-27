import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { HandicapHistoryEntry, PlayerProfile, UserRole } from '@/types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let cachedClient: SupabaseClient | null = null;

/**
 * Comprueba si las credenciales de Supabase del club están configuradas con valores reales.
 */
export function isSupabaseConfigured(
  url = SUPABASE_URL,
  anonKey = SUPABASE_ANON_KEY
): boolean {
  return (
    Boolean(url) &&
    Boolean(anonKey) &&
    !url.includes('your-club-staging-project') &&
    anonKey !== 'your-supabase-anon-key'
  );
}

/**
 * Devuelve la instancia singleton del cliente de Supabase para el club activo.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return cachedClient;
}

/**
 * Perfiles de demostración por rol (player, club_admin, superadmin) para previsualización local y staging.
 */
export const DEMO_PROFILES_BY_ROLE: Record<UserRole, PlayerProfile> = {
  player: {
    id: 'aaaa0000-0000-0000-0000-000000000001',
    email: 'carlos.mendoza@socio.es',
    fullName: 'Carlos Mendoza',
    federationLicense: 'AM-284910',
    handicapIndex: 11.4,
    role: 'player',
    phone: '+34 600 123 456',
    bio: 'Socio jugador habitual los fines de semana. Salidas de mañana.',
    isDirectoryVisible: true,
    updatedAt: '2026-10-27T10:00:00Z',
  },
  club_admin: {
    id: 'aaaa0000-0000-0000-0000-000000000003',
    email: 'comite@rcgvalleverde.es',
    fullName: 'Laura Gómez (Comité y Gerencia)',
    federationLicense: 'AM-102938',
    handicapIndex: 5.2,
    role: 'club_admin',
    phone: '+34 910 000 100',
    bio: 'Dirección deportiva y administración del club.',
    isDirectoryVisible: true,
    updatedAt: '2026-10-27T10:00:00Z',
  },
  superadmin: {
    id: 'aaaa0000-0000-0000-0000-000000000004',
    email: 'ops@birdie.app',
    fullName: ' Javier Ruiz (Birdie Superadmin)',
    federationLicense: 'PRO-001122',
    handicapIndex: 1.8,
    role: 'superadmin',
    phone: '+34 699 000 999',
    bio: 'Administración global multi-club Birdie.',
    isDirectoryVisible: false,
    updatedAt: '2026-10-27T10:00:00Z',
  },
};

export const DEMO_HANDICAP_HISTORY: HandicapHistoryEntry[] = [
  {
    id: 'hc-1',
    userId: 'aaaa0000-0000-0000-0000-000000000001',
    previousHandicap: 12.1,
    newHandicap: 11.4,
    reason: 'Torneo de Otoño — 39 pts Stableford',
    effectiveDate: '2026-10-18',
  },
  {
    id: 'hc-2',
    userId: 'aaaa0000-0000-0000-0000-000000000001',
    previousHandicap: 12.6,
    newHandicap: 12.1,
    reason: 'Vuelta Valedera Mensual — 37 pts Stableford',
    effectiveDate: '2026-09-22',
  },
  {
    id: 'hc-3',
    userId: 'aaaa0000-0000-0000-0000-000000000001',
    previousHandicap: 12.4,
    newHandicap: 12.6,
    reason: 'Revisión WHS — Copa Verano',
    effectiveDate: '2026-08-14',
  },
];

/**
 * Calcula el Playing Handicap (Hándicap de Juego WHS) para unas barras de salida concretas:
 * Playing Handicap = round(Handicap Index * (Slope Rating / 113) + (Course Rating - Par))
 */
export function calculatePlayingHandicap(params: {
  handicapIndex: number;
  slopeRating: number;
  courseRating: number;
  par: number;
}): number {
  const { handicapIndex, slopeRating, courseRating, par } = params;
  const raw = handicapIndex * (slopeRating / 113) + (courseRating - par);
  return Math.round(raw);
}
