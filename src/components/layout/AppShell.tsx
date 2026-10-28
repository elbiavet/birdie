'use client';

import React, { createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CalendarClock,
  Compass,
  Flag,
  Home,
  MapPin,
  MessageCircle,
  MessageSquare,
  Newspaper,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import type { ClubConfig, ClubFeatureKey } from '@/types/club';
import type { UserRole } from '@/types/database';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  featureKey?: ClubFeatureKey;
  requiresAdmin?: boolean;
  group: 'core' | 'competition' | 'community' | 'account';
}

export const ALL_NAVIGATION_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Inicio', href: '/', group: 'core' },
  {
    id: 'scorecard',
    label: 'Marcador & GPS',
    href: '/scorecard',
    featureKey: 'scorecard',
    group: 'core',
  },
  {
    id: 'stats',
    label: 'Estadísticas',
    href: '/stats',
    featureKey: 'stats',
    group: 'core',
  },
  {
    id: 'bookings',
    label: 'Reservas Tee',
    href: '/bookings',
    featureKey: 'bookings',
    group: 'competition',
  },
  {
    id: 'calendar',
    label: 'Calendario Partidos',
    href: '/calendar',
    featureKey: 'calendar',
    group: 'competition',
  },
  {
    id: 'tournaments',
    label: 'Torneos y Resultados',
    href: '/tournaments',
    featureKey: 'tournaments',
    group: 'competition',
  },
  {
    id: 'events',
    label: 'Eventos Especiales',
    href: '/events',
    featureKey: 'specialEvents',
    group: 'competition',
  },
  {
    id: 'players',
    label: 'Directorio Jugadores',
    href: '/players',
    featureKey: 'playerDirectory',
    group: 'community',
  },
  {
    id: 'clubs',
    label: 'Directorio Clubes',
    href: '/clubs',
    featureKey: 'clubDirectory',
    group: 'community',
  },
  {
    id: 'news',
    label: 'Noticias',
    href: '/news',
    featureKey: 'news',
    group: 'community',
  },
  {
    id: 'info',
    label: 'Info de Interés',
    href: '/info',
    featureKey: 'clubInfo',
    group: 'community',
  },
  {
    id: 'forum',
    label: 'Foro Social',
    href: '/forum',
    featureKey: 'forum',
    group: 'community',
  },
  {
    id: 'admin-chat',
    label: 'Chat con Admin',
    href: '/admin-chat',
    featureKey: 'adminChat',
    group: 'community',
  },
  {
    id: 'profile',
    label: 'Perfil y Hándicap',
    href: '/profile',
    group: 'account',
  },
  {
    id: 'admin',
    label: 'Panel Admin Club',
    href: '/admin',
    requiresAdmin: true,
    group: 'account',
  },
] as const;

/**
 * Determina si una ruta corresponde al Inicio o a un alias/prefijo de idioma de inicio
 * (por ejemplo '/', '/home', '/home/', '/en', '/en/', '/en/home', '/en/home/', '/es/home/').
 */
export function isHomeAliasPath(pathname?: string | null): boolean {
  if (!pathname || pathname === '/') {
    return true;
  }
  return /^\/(?:home\/?|(?:[a-z]{2}(?:-[a-zA-Z]{2})?)(?:\/home)?\/?)$/.test(
    pathname.trim()
  );
}

/**
 * Filtra los elementos de navegación según las funcionalidades ('features') activas en la
 * configuración white-label del club y el rol del usuario autenticado.
 */
export function resolveNavigationItems(
  club: ClubConfig,
  role: UserRole
): NavItem[] {
  const isAdmin = role === 'club_admin' || role === 'superadmin';
  return ALL_NAVIGATION_ITEMS.filter((item) => {
    if (item.requiresAdmin && !isAdmin) {
      return false;
    }
    if (item.featureKey && !club.features[item.featureKey]) {
      return false;
    }
    return true;
  });
}

function getNavIcon(id: string) {
  switch (id) {
    case 'dashboard':
      return Home;
    case 'scorecard':
      return Flag;
    case 'stats':
      return Activity;
    case 'bookings':
      return CalendarClock;
    case 'calendar':
      return Calendar;
    case 'tournaments':
      return Award;
    case 'events':
      return Sparkles;
    case 'players':
      return Users;
    case 'clubs':
      return MapPin;
    case 'news':
      return Newspaper;
    case 'info':
      return BookOpen;
    case 'forum':
      return MessageSquare;
    case 'admin-chat':
      return MessageCircle;
    case 'profile':
      return User;
    case 'admin':
      return ShieldCheck;
    default:
      return Compass;
  }
}

const AppShellNestedContext = createContext<boolean>(false);

export function AppShell({ children }: { children: React.ReactNode }) {
  const isAlreadyInsideAppShell = useContext(AppShellNestedContext);
  const pathname = usePathname();
  const { club, availableClubIds, switchClub, profile, setRole, isOnline } = useClub();
  const navItems = resolveNavigationItems(club, profile.role);

  if (isAlreadyInsideAppShell) {
    return <>{children}</>;
  }

  return (
    <AppShellNestedContext.Provider value={true}>
      <div className="min-h-screen flex flex-col bg-[var(--club-bg)] text-slate-900">
      {/* Cabecera White-Label del Club */}
      <header
        style={{
          backgroundColor: club.theme.primary,
          color: club.theme.primaryForeground,
        }}
        className="sticky top-0 z-30 border-b border-white/15 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: club.theme.secondary,
                color: '#0f172a',
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-inner"
            >
              {club.shortName.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base md:text-lg tracking-tight">
                  {club.name}
                </span>
                <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15 font-medium">
                  {club.clubId}
                </span>
              </div>
              <p className="text-xs opacity-80">
                {club.tagline || 'Plataforma Oficial del Socio'} · App ID:{' '}
                <code className="font-mono">{club.appId}</code>
              </p>
            </div>
          </div>

          {/* Controles de Estado Offline/Online, Rol, Handicap y Selector Multi-Club */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30'
                  : 'bg-amber-500/25 text-amber-100 border border-amber-400/40'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'Online · Supabase Sync' : 'Offline · SQLite Local'}
            </span>

            <Link
              href="/profile"
              style={{
                backgroundColor: club.theme.secondary,
                color: '#0f172a',
              }}
              className="px-2.5 py-1 rounded-full font-bold shadow-xs"
            >
              HCP {profile.handicapIndex.toFixed(1)}
            </Link>

            <select
              aria-label="Selector de club white-label"
              value={club.clubId}
              onChange={(e) => switchClub(e.target.value)}
              className="bg-black/25 text-white border border-white/20 rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              {availableClubIds.map((id) => (
                <option key={id} value={id} className="text-slate-900">
                  Club: {id}
                </option>
              ))}
            </select>

            <select
              aria-label="Selector de rol RLS"
              value={profile.role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="bg-black/25 text-white border border-white/20 rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              <option value="player" className="text-slate-900">
                Rol: Jugador (player)
              </option>
              <option value="club_admin" className="text-slate-900">
                Rol: Admin Club (club_admin)
              </option>
              <option value="superadmin" className="text-slate-900">
                Rol: Superadmin
              </option>
            </select>

            <Link
              href="/login"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition"
            >
              Acceso
            </Link>
          </div>
        </div>
      </header>

      {/* Cuerpo Principal con Sidebar en Escritorio y Contenido */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex gap-6 px-4 py-6 pb-24 md:pb-8">
        <aside className="hidden md:flex flex-col w-60 shrink-0">
          <nav className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-1">
            {navItems.map((item) => {
              const Icon = getNavIcon(item.id);
              const isActive =
                item.href === '/'
                  ? isHomeAliasPath(pathname)
                  : pathname === item.href || Boolean(pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={
                    isActive
                      ? {
                          backgroundColor: club.theme.primary,
                          color: club.theme.primaryForeground,
                        }
                      : undefined
                  }
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Barra de Navegación Inferior para Móvil / APK Android */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-2 py-1.5 flex justify-around items-center shadow-lg">
        {navItems.slice(0, 5).map((item) => {
          const Icon = getNavIcon(item.id);
          const isActive =
            item.href === '/'
              ? isHomeAliasPath(pathname)
              : pathname === item.href || Boolean(pathname?.startsWith(item.href));
          return (
            <Link
              key={item.id}
              href={item.href}
              style={isActive ? { color: club.theme.primary } : undefined}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium ${
                isActive ? 'font-bold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-[68px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      </div>
    </AppShellNestedContext.Provider>
  );
}
