'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
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
  KeyRound,
  LogOut,
  Globe,
  Settings2,
  X,
} from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/components/providers/LanguageProvider';
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
    id: 'course',
    label: 'Recorrido',
    href: '/course',
    group: 'core',
  },
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
    case 'course':
      return Compass;
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
  const {
    club,
    availableClubIds,
    switchClub,
    profile,
    authenticatedProfile,
    canSimulateRoles,
    setRole,
    logout,
    isOnline,
  } = useClub();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const navItems = resolveNavigationItems(club, profile?.role || 'player');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeMobileItemRef = useRef<HTMLAnchorElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const updateScrollIndicators = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  }, []);

  const scrollByAmount = (offset: number) => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollIndicators();
    el.addEventListener('scroll', updateScrollIndicators, { passive: true });
    window.addEventListener('resize', updateScrollIndicators);
    return () => {
      el.removeEventListener('scroll', updateScrollIndicators);
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [updateScrollIndicators, navItems.length]);

  useEffect(() => {
    if (activeMobileItemRef.current) {
      activeMobileItemRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
      const timer = setTimeout(updateScrollIndicators, 350);
      return () => clearTimeout(timer);
    }
  }, [pathname, updateScrollIndicators]);

  // Cerrar el menú de ajustes al hacer clic fuera o pulsar la tecla Escape
  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

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
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            {/* Identidad del Club (Logo + Nombre + Lema) con espacio prioritario */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                style={{
                  background: '#FFFFFF',
                  color: '#0B0C10',
                  fontWeight: 800,
                  boxShadow: isDark
                    ? '0 3px 12px rgba(0, 0, 0, 0.35)'
                    : '0 3px 12px rgba(169, 138, 85, 0.22)',
                  border: isDark ? '1px solid rgba(201, 173, 116, 0.35)' : '1px solid #CBD7CC',
                }}
                className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs tracking-wider relative overflow-hidden p-1 bg-white shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/clubs/${club.clubId}/logo.svg`}
                  alt={`Logo oficial de ${club.name}`}
                  className="w-full h-full object-contain relative z-10"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (img.src.includes('/clubs/')) {
                      img.src = '/club-logo.svg';
                    } else {
                      img.style.display = 'none';
                      const fallback = img.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.opacity = '1';
                    }
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-[11px] opacity-0">
                  {club.shortName.slice(0, 3).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
                    className="font-bold text-base md:text-lg tracking-tight truncate block"
                  >
                    {club.name}
                  </span>
                </div>
                <p
                  style={{ color: isDark ? '#92A99E' : '#52665B' }}
                  className="text-xs font-normal truncate"
                >
                  {club.tagline || 'Tradición y deporte desde 1968'}
                  {profile?.role === 'superadmin' && (
                    <>
                      {' · App ID: '}
                      <code className="font-mono">{club.appId}</code>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Controles Principales y Menú de Ajustes Compacto */}
            <div className="flex items-center gap-2 text-xs shrink-0">
              {/* Indicador de conexión: solo visible de forma discreta si se pierde la conexión */}
              {!isOnline && (
                <span
                  style={{
                    backgroundColor: isDark ? '#3D2808' : '#FEF3C7',
                    borderColor: isDark ? '#78350F' : '#FCD34D',
                    color: isDark ? '#FDE68A' : '#92400E',
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border shadow-2xs"
                  role="status"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="hidden sm:inline">{t('header.offline')}</span>
                </span>
              )}

              {/* Badge de Hándicap (visible con sesión) */}
              {profile && (
                <Link
                  href="/profile"
                  style={{
                    backgroundColor: isDark ? '#0C3029' : '#0A3A2A',
                    color: isDark ? '#E4D3AC' : '#FCFAF5',
                    borderColor: isDark ? 'rgba(201, 173, 116, 0.45)' : '#0A3A2A',
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full font-bold border shadow-2xs transition hover:opacity-90 inline-flex items-center"
                >
                  HCP {profile.handicapIndex.toFixed(1)}
                </Link>
              )}

              {/* Menú de Ajustes Compacto (Idioma, Tema, Club, Rol) */}
              <div ref={settingsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  aria-expanded={isSettingsOpen}
                  aria-haspopup="dialog"
                  aria-controls="header-settings-menu"
                  aria-label={t('common.settings', 'Ajustes')}
                  title={t('common.settings', 'Ajustes')}
                  style={{
                    backgroundColor: isDark ? '#0C3029' : '#FCFAF5',
                    borderColor: isDark
                      ? isSettingsOpen
                        ? '#DFCB9E'
                        : '#104238'
                      : isSettingsOpen
                        ? '#CCB88E'
                        : '#CBD7CC',
                    color: isDark
                      ? isSettingsOpen
                        ? '#E4D3AC'
                        : '#92A99E'
                      : isSettingsOpen
                        ? '#0A3A2A'
                        : '#52665B',
                  }}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-full border shadow-2xs transition flex items-center gap-1.5 cursor-pointer hover:border-[#C9AD74]"
                >
                  <Settings2
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isDark ? 'text-[#C9AD74]' : 'text-[#A98A55]'
                    } ${isSettingsOpen ? 'rotate-45' : ''}`}
                  />
                  <span className="hidden md:inline font-medium text-[11px]">
                    {t('common.settings', 'Ajustes')}
                  </span>
                </button>

                {/* Backdrop en móvil para cerrar al tocar fuera */}
                {isSettingsOpen && (
                  <div
                    className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:hidden"
                    onClick={() => setIsSettingsOpen(false)}
                    aria-hidden="true"
                  />
                )}

                {/* Panel de Ajustes Desplegable */}
                <div
                  id="header-settings-menu"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t('header.settingsTitle', 'Ajustes y Preferencias')}
                  style={{
                    backgroundColor: isDark ? '#202127' : '#FCFAF5',
                    borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : '#CBD7CC',
                    boxShadow: isDark
                      ? '0 12px 32px rgba(0, 0, 0, 0.65)'
                      : '0 12px 32px rgba(169, 138, 85, 0.22)',
                  }}
                  className={`absolute right-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] max-w-xs sm:w-80 rounded-2xl border p-4 transition-all duration-150 ${
                    isSettingsOpen ? 'block' : 'hidden'
                  }`}
                >
                  {/* Cabecera del Panel */}
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--theme-border)] mb-3">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-[var(--theme-accent-primary)]" />
                      <span
                        style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
                        className="font-bold text-xs sm:text-sm tracking-tight"
                      >
                        {t('header.settingsTitle', 'Ajustes y Preferencias')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(false)}
                      aria-label={t('header.closeSettings', 'Cerrar ajustes')}
                      style={{
                        color: isDark ? '#92A99E' : '#52665B',
                      }}
                      className="p-1 rounded-full hover:bg-[var(--theme-surface-subtle)] transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    {/* Sección 1: Tema Visual (Dark / Light) */}
                    <div>
                      <span
                        style={{ color: isDark ? '#92A99E' : '#52665B' }}
                        className="block text-[11px] font-medium mb-1.5"
                      >
                        {t('header.theme', 'Tema visual')}
                      </span>
                      <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={`Cambiar a modo ${isDark ? 'Light' : 'Dark'}`}
                        title={`Cambiar a modo ${isDark ? 'Light' : 'Dark'}`}
                        style={{
                          backgroundColor: isDark ? '#0C3029' : '#FFFFFF',
                          borderColor: isDark ? '#104238' : '#CBD7CC',
                          color: isDark ? '#E4D3AC' : '#0A3A2A',
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border shadow-2xs font-medium cursor-pointer transition hover:border-[#C9AD74]"
                      >
                        <span className="flex items-center gap-2">
                          {isDark ? (
                            <Sun className="w-4 h-4 text-[#C9AD74]" />
                          ) : (
                            <Moon className="w-4 h-4 text-[#A98A55]" />
                          )}
                          <span>
                            {isDark
                              ? t('header.themeDark', 'Modo Oscuro')
                              : t('header.themeLight', 'Modo Claro')}
                          </span>
                        </span>
                        <span
                          style={{
                            backgroundColor: isDark ? '#202127' : '#DCE6DD',
                            color: isDark ? '#D5C7A5' : '#0A3A2A',
                          }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        >
                          {isDark ? 'Dark' : 'Light'}
                        </span>
                      </button>
                    </div>

                    {/* Sección 2: Idioma de la Plataforma */}
                    <div>
                      <span
                        style={{ color: isDark ? '#92A99E' : '#52665B' }}
                        className="block text-[11px] font-medium mb-1.5"
                      >
                        {t('common.language', 'Idioma')}
                      </span>
                      <div
                        style={{
                          backgroundColor: isDark ? '#0C3029' : '#FFFFFF',
                          borderColor: isDark ? '#104238' : '#CBD7CC',
                        }}
                        className="grid grid-cols-2 rounded-xl border p-1 shadow-2xs gap-1"
                        role="group"
                        aria-label={t('common.language')}
                      >
                        <button
                          type="button"
                          onClick={() => setLanguage('es')}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            language === 'es'
                              ? isDark
                                ? 'bg-[#D4BA80] text-stone-900 shadow-xs'
                                : 'bg-[#BEA16D] text-stone-900 shadow-xs'
                              : isDark
                                ? 'text-[#92A99E] hover:text-[#E4D3AC]'
                                : 'text-[#52665B] hover:text-[#0A3A2A]'
                          }`}
                          aria-pressed={language === 'es'}
                          aria-label="Cambiar a Español"
                        >
                          <span>{t('common.spanish', 'Español')}</span>
                          <span className="text-[10px] opacity-80">(ES)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLanguage('en')}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            language === 'en'
                              ? isDark
                                ? 'bg-[#D4BA80] text-stone-900 shadow-xs'
                                : 'bg-[#BEA16D] text-stone-900 shadow-xs'
                              : isDark
                                ? 'text-[#92A99E] hover:text-[#E4D3AC]'
                                : 'text-[#52665B] hover:text-[#0A3A2A]'
                          }`}
                          aria-pressed={language === 'en'}
                          aria-label="Switch to English"
                        >
                          <span>{t('common.english', 'Inglés')}</span>
                          <span className="text-[10px] opacity-80">(EN)</span>
                        </button>
                      </div>
                    </div>

                    {/* Sección 3: Selector de Club White-Label */}
                    <div>
                      <label
                        htmlFor="header-club-select"
                        style={{ color: isDark ? '#92A99E' : '#52665B' }}
                        className="block text-[11px] font-medium mb-1.5"
                      >
                        {t('header.club', 'Club de Golf')}
                      </label>
                      <select
                        id="header-club-select"
                        aria-label="Selector de club white-label"
                        value={club.clubId}
                        onChange={(e) => switchClub(e.target.value)}
                        style={{
                          backgroundColor: isDark ? '#0C3029' : '#FFFFFF',
                          borderColor: isDark ? '#104238' : '#CBD7CC',
                          color: isDark ? '#D5C7A5' : '#0A3A2A',
                        }}
                        className="w-full rounded-xl px-3 py-2 text-xs border font-medium focus:outline-none shadow-2xs cursor-pointer"
                      >
                        {availableClubIds.map((id) => (
                          <option key={id} value={id} className="text-slate-900 bg-white">
                            Club: {id}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sección 4: Selector de Rol o Badge */}
                    {profile && (
                      <div>
                        <span
                          style={{ color: isDark ? '#92A99E' : '#52665B' }}
                          className="block text-[11px] font-medium mb-1.5"
                        >
                          {t('header.role', 'Rol de Usuario')}
                        </span>
                        {canSimulateRoles ? (
                          <select
                            aria-label="Selector de rol RLS"
                            value={profile.role}
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            style={{
                              backgroundColor: isDark ? '#0C3029' : '#FFFFFF',
                              borderColor: isDark ? '#104238' : '#CBD7CC',
                              color: isDark ? '#D5C7A5' : '#0A3A2A',
                            }}
                            className="w-full rounded-xl px-3 py-2 text-xs border font-medium focus:outline-none shadow-2xs cursor-pointer"
                          >
                            <option value="player" className="text-slate-900 bg-white">
                              {language === 'en' ? 'Simulate: Member (player)' : 'Simular: jugador (player)'}
                            </option>
                            <option value="club_admin" className="text-slate-900 bg-white">
                              {language === 'en' ? 'Simulate: Club admin (club_admin)' : 'Simular: admin club (club_admin)'}
                            </option>
                            <option value="superadmin" className="text-slate-900 bg-white">
                              {language === 'en' ? 'Simulate: Superadmin' : 'Simular: superadmin'}
                            </option>
                          </select>
                        ) : (
                          <div
                            style={{
                              backgroundColor: isDark ? '#0C3029' : '#FFFFFF',
                              borderColor: isDark ? '#104238' : '#CBD7CC',
                              color: isDark ? '#92A99E' : '#0A3A2A',
                            }}
                            className="px-3 py-2 rounded-xl font-medium border shadow-2xs"
                          >
                            Rol: {profile.role === 'club_admin' ? (language === 'en' ? 'Club Admin' : 'Admin Club') : (language === 'en' ? 'Player' : 'Jugador')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Botón Acceso */}
              <Link
                href="/login"
                style={{
                  backgroundColor: isDark ? '#0C3029' : '#0A3A2A',
                  borderColor: isDark ? 'rgba(201, 173, 116, 0.45)' : '#0A3A2A',
                  color: isDark ? '#E4D3AC' : '#FCFAF5',
                }}
                className="px-2.5 sm:px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-2xs transition hover:opacity-90 inline-flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {profile ? t('common.demoAccess') : t('common.login')}
                </span>
              </Link>

              {/* Botón Cerrar Sesión universal (visible cuando hay sesión activa) */}
              {profile && (
                <button
                  type="button"
                  onClick={() => logout()}
                  title={t('common.logout')}
                  aria-label="Cerrar sesión"
                  style={{
                    backgroundColor: isDark ? '#0C3029' : '#FCFAF5',
                    borderColor: isDark ? '#104238' : '#CBD7CC',
                    color: isDark ? '#92A99E' : '#52665B',
                  }}
                  className="p-1.5 rounded-full border shadow-2xs transition flex items-center justify-center cursor-pointer hover:text-rose-400 hover:border-rose-400/40"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Cuerpo Principal con Sidebar Flotante Redondeada y Contenido */}
        <div className="app-content-container flex-1 max-w-7xl w-full mx-auto flex gap-6 px-4 py-5">
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
                const navKey = item.id === 'admin-chat' ? 'adminChat' : item.id;

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
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full text-xs md:text-sm transition ${isActive
                      ? 'font-bold'
                      : isDark
                        ? 'text-[#92A99E] hover:text-[#E4D3AC] hover:bg-[#2A2B33] font-medium'
                        : 'text-[#52665B] hover:text-[#0A3A2A] hover:bg-[#E8E3D4] font-medium'
                      }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${isActive
                        ? 'text-[#0B0C10]'
                        : isDark
                          ? 'text-[#C9AD74]'
                          : 'text-[#A98A55]'
                        }`}
                    />
                    <span>{t(`nav.${navKey}`, item.label)}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0">{children}</main>
        </div>

        {/* Barra de Navegación Inferior para Móvil / APK Android */}
        <nav
          aria-label="Navegación principal móvil"
          style={{
            backgroundColor: isDark ? '#202127' : '#FCFAF5',
            borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : '#D8DFD9',
          }}
          className="mobile-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-30 border-t shadow-lg select-none"
        >
          <div className="relative w-full flex items-center">
            {/* Botón de desplazamiento hacia la izquierda */}
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollByAmount(-180)}
                aria-label="Desplazar secciones a la izquierda"
                style={{
                  backgroundColor: isDark ? 'rgba(32, 33, 39, 0.95)' : 'rgba(252, 250, 245, 0.95)',
                  borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : '#CBD7CC',
                  color: isDark ? '#D4BA80' : '#0A3A2A',
                }}
                className="absolute left-1 z-20 w-6 h-6 rounded-full border shadow-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Máscara de degradado izquierda */}
            {canScrollLeft && (
              <div
                style={{
                  background: isDark
                    ? 'linear-gradient(to right, #202127 0%, rgba(32, 33, 39, 0) 100%)'
                    : 'linear-gradient(to right, #FCFAF5 0%, rgba(252, 250, 245, 0) 100%)',
                }}
                className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10"
                aria-hidden="true"
              />
            )}

            {/* Contenedor desplazable horizontalmente con todas las secciones */}
            <div
              ref={scrollContainerRef}
              onScroll={updateScrollIndicators}
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
              className="w-full flex items-center gap-1.5 overflow-x-auto px-3 py-1.5 scroll-smooth overscroll-x-contain [&::-webkit-scrollbar]:hidden"
            >
              {navItems.map((item) => {
                const Icon = getNavIcon(item.id);
                const isActive =
                  item.href === '/'
                    ? isHomeAliasPath(pathname)
                    : pathname === item.href || Boolean(pathname?.startsWith(item.href));
                const navKey = item.id === 'admin-chat' ? 'adminChat' : item.id;
                const label = t(`nav.${navKey}`, item.label);

                return (
                  <Link
                    key={item.id}
                    ref={isActive ? activeMobileItemRef : undefined}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    title={label}
                    style={
                      isActive
                        ? {
                            background: isDark
                              ? 'linear-gradient(135deg, rgba(212, 186, 128, 0.22) 0%, rgba(201, 173, 116, 0.12) 100%)'
                              : 'linear-gradient(135deg, rgba(190, 161, 109, 0.22) 0%, rgba(172, 142, 88, 0.12) 100%)',
                            borderColor: isDark ? 'rgba(212, 186, 128, 0.45)' : 'rgba(190, 161, 109, 0.45)',
                            color: isDark ? '#E4D3AC' : '#0A3A2A',
                            boxShadow: isDark
                              ? '0 2px 8px rgba(201, 173, 116, 0.15)'
                              : '0 2px 8px rgba(169, 138, 85, 0.12)',
                          }
                        : {
                            color: isDark ? '#92A99E' : '#52665B',
                            borderColor: 'transparent',
                          }
                    }
                    className={`shrink-0 min-w-[70px] sm:min-w-[76px] max-w-[96px] px-2 py-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-150 ${
                      isActive
                        ? 'font-bold'
                        : 'font-medium hover:opacity-90'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive
                          ? isDark
                            ? 'text-[#D4BA80]'
                            : 'text-[#0A3A2A]'
                          : isDark
                            ? 'text-[#92A99E]'
                            : 'text-[#52665B]'
                      }`}
                    />
                    <span className="text-[10px] sm:text-[11px] leading-tight text-center truncate w-full">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Máscara de degradado derecha */}
            {canScrollRight && (
              <div
                style={{
                  background: isDark
                    ? 'linear-gradient(to left, #202127 0%, rgba(32, 33, 39, 0) 100%)'
                    : 'linear-gradient(to left, #FCFAF5 0%, rgba(252, 250, 245, 0) 100%)',
                }}
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10"
                aria-hidden="true"
              />
            )}

            {/* Botón de desplazamiento hacia la derecha */}
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollByAmount(180)}
                aria-label="Desplazar secciones a la derecha"
                style={{
                  backgroundColor: isDark ? 'rgba(32, 33, 39, 0.95)' : 'rgba(252, 250, 245, 0.95)',
                  borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : '#CBD7CC',
                  color: isDark ? '#D4BA80' : '#0A3A2A',
                }}
                className="absolute right-1 z-20 w-6 h-6 rounded-full border shadow-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </nav>
      </div>
    </AppShellNestedContext.Provider>
  );
}
