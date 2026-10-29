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
  Sun,
  Moon,
} from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
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
  const { resolvedTheme, toggleTheme } = useTheme();
  const navItems = resolveNavigationItems(club, profile.role);

  if (isAlreadyInsideAppShell) {
    return <>{children}</>;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <AppShellNestedContext.Provider value={true}>
      <div className="min-h-screen flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text-primary)] transition-colors duration-200">
      {/* Cabecera White-Label del Club con Estética de Alta Gama */}
      <header
        style={{
          backgroundColor: isDark ? '#06372D' : '#DCE6DD',
          borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : '#CBD7CC',
          color: isDark ? '#E4D3AC' : '#0A3A2A',
        }}
        className="sticky top-0 z-30 border-b shadow-xs transition-colors duration-200"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                  : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                color: '#0B0C10',
                fontWeight: 800,
                boxShadow: isDark
                  ? '0 3px 12px rgba(201, 173, 116, 0.26)'
                  : '0 3px 12px rgba(169, 138, 85, 0.22)',
                border: isDark ? '1px solid #DFCB9E' : '1px solid #CCB88E',
              }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs tracking-wider"
            >
              {club.shortName.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
                  className="font-bold text-base md:text-lg tracking-tight"
                >
                  {club.name}
                </span>
                <span
                  style={{
                    backgroundColor: isDark ? '#0C3029' : '#C8D6C9',
                    borderColor: isDark ? '#104238' : '#B8C8BA',
                    color: isDark ? '#92A99E' : '#0A3A2A',
                  }}
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-semibold"
                >
                  {club.clubId}
                </span>
              </div>
              <p
                style={{ color: isDark ? '#92A99E' : '#52665B' }}
                className="text-xs font-normal"
              >
                {club.tagline || 'Tradición y deporte desde 1968'} · App ID:{' '}
                <code className="font-mono">{club.appId}</code>
              </p>
            </div>
          </div>

          {/* Controles: Conmutador de Tema, Online/Offline, Rol, Handicap y Multi-Club */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Indicador Online/Offline */}
            <span
              style={{
                backgroundColor: isDark ? '#0C3029' : '#FCFAF5',
                borderColor: isDark ? '#104238' : '#CBD7CC',
                color: isDark ? '#92A99E' : '#0A3A2A',
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium border shadow-2xs"
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {isOnline ? 'Online · Supabase Sync' : 'Offline · SQLite'}
            </span>

            {/* Badge de Hándicap */}
            <Link
              href="/profile"
              style={{
                backgroundColor: isDark ? '#0C3029' : '#0A3A2A',
                color: isDark ? '#E4D3AC' : '#FCFAF5',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.45)' : '#0A3A2A',
              }}
              className="px-3 py-1.5 rounded-full font-bold border shadow-2xs transition hover:opacity-90"
            >
              HCP {profile.handicapIndex.toFixed(1)}
            </Link>

            {/* Selector de Club */}
            <select
              aria-label="Selector de club white-label"
              value={club.clubId}
              onChange={(e) => switchClub(e.target.value)}
              style={{
                backgroundColor: isDark ? '#0C3029' : '#FCFAF5',
                borderColor: isDark ? '#104238' : '#CBD7CC',
                color: isDark ? '#D5C7A5' : '#0A3A2A',
              }}
              className="rounded-full px-3 py-1.5 text-xs border font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              {availableClubIds.map((id) => (
                <option key={id} value={id} className="text-slate-900 bg-white">
                  Club: {id}
                </option>
              ))}
            </select>

            {/* Selector de Rol */}
            <select
              aria-label="Selector de rol RLS"
              value={profile.role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              style={{
                backgroundColor: isDark ? '#0C3029' : '#FCFAF5',
                borderColor: isDark ? '#104238' : '#CBD7CC',
                color: isDark ? '#D5C7A5' : '#0A3A2A',
              }}
              className="rounded-full px-3 py-1.5 text-xs border font-medium focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="player" className="text-slate-900 bg-white">
                Rol: jugador (player)...
              </option>
              <option value="club_admin" className="text-slate-900 bg-white">
                Rol: admin club (club_admin)...
              </option>
              <option value="superadmin" className="text-slate-900 bg-white">
                Rol: superadmin...
              </option>
            </select>

            {/* Conmutador Dark / Light */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Cambiar a modo ${isDark ? 'Light' : 'Dark'}`}
              title={`Cambiar a modo ${isDark ? 'Light' : 'Dark'}`}
              style={{
                backgroundColor: isDark ? '#0C3029' : '#FCFAF5',
                borderColor: isDark ? '#104238' : '#CBD7CC',
              }}
              className="p-1.5 rounded-full border shadow-2xs transition flex items-center justify-center cursor-pointer hover:border-[#C9AD74]"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#C9AD74]" />
              ) : (
                <Moon className="w-4 h-4 text-[#A98A55]" />
              )}
            </button>

            {/* Botón Acceso */}
            <Link
              href="/login"
              style={{
                backgroundColor: isDark ? '#0C3029' : '#0A3A2A',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.45)' : '#0A3A2A',
                color: isDark ? '#E4D3AC' : '#FCFAF5',
              }}
              className="px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-2xs transition hover:opacity-90"
            >
              Acceso
            </Link>
          </div>
        </div>
      </header>

      {/* Cuerpo Principal con Sidebar Flotante Redondeada y Contenido */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex gap-6 px-4 py-5 pb-24 md:pb-8">
        <aside className="hidden md:flex flex-col w-64 shrink-0">
          <nav
            style={{
              backgroundColor: isDark ? '#202127' : '#FCFAF5',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.2)' : '#D8DFD9',
            }}
            className="rounded-3xl border p-3.5 shadow-sm space-y-1.5"
          >
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
                          background: isDark
                            ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                            : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                          color: '#0B0C10',
                          fontWeight: 700,
                          boxShadow: isDark
                            ? '0 3px 14px rgba(201, 173, 116, 0.28)'
                            : '0 3px 14px rgba(169, 138, 85, 0.22)',
                          border: isDark
                            ? '1px solid #DFCB9E'
                            : '1px solid #CCB88E',
                        }
                      : undefined
                  }
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full text-xs md:text-sm transition ${
                    isActive
                      ? 'font-bold'
                      : isDark
                      ? 'text-[#92A99E] hover:text-[#E4D3AC] hover:bg-[#2A2B33] font-medium'
                      : 'text-[#52665B] hover:text-[#0A3A2A] hover:bg-[#E8E3D4] font-medium'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-[#0B0C10]'
                        : isDark
                        ? 'text-[#C9AD74]'
                        : 'text-[#A98A55]'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Barra de Navegación Inferior para Móvil / APK Android */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--theme-surface)] border-t border-[var(--theme-border)] px-2 py-1.5 flex justify-around items-center shadow-lg">
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
              style={
                isActive
                  ? { color: isDark ? '#D4AF37' : '#0A3A2A' }
                  : undefined
              }
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium transition ${
                isActive ? 'font-bold' : 'text-[var(--theme-text-secondary)]'
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
