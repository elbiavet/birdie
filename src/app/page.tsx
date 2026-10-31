'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  CalendarClock,
  Calendar,
  Flag,
  MapPin,
  Trophy,
} from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import { isHomeAliasPath, resolveNavigationItems } from '@/components/layout/AppShell';
import { calculatePlayingHandicap } from '@/lib/supabase/client';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/components/providers/LanguageProvider';

export default function DashboardPage() {
  const router = useRouter();
  const { club, profile, isOnline, isAuthenticated } = useClub();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const enabledNavItems = resolveNavigationItems(club, profile?.role || 'player');
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== '/' &&
      isHomeAliasPath(window.location.pathname)
    ) {
      window.history.replaceState(null, '', '/');
    }
  }, []);

  // Al navegar a la dirección principal del sitio, muestra la página de acceso si el usuario no tiene una sesión válida
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  const playingHcpYellow = profile
    ? calculatePlayingHandicap({
      handicapIndex: profile.handicapIndex,
      slopeRating: 128,
      courseRating: 71.5,
      par: 72,
    })
    : 0;

  return (
    <div className="space-y-6">
      {/* 1. Panel de Bienvenida: Verde bosque #064334 a #0D3028 (Dark) / Degradado dorado champán #F2ECE0 a #DECBA4 (Light) */}
      <section
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #064334 0%, #0D3028 100%)'
            : 'linear-gradient(135deg, #F2ECE0 0%, #E9DECA 40%, #DECBA4 100%)',
          borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(197, 160, 89, 0.45)',
          boxShadow: isDark
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.35)'
            : '0 10px 25px -5px rgba(180, 150, 100, 0.18), 0 8px 10px -6px rgba(180, 150, 100, 0.12)',
        }}
        className="rounded-3xl p-6 md:p-8 relative overflow-hidden border transition-all duration-200"
      >
        {/* Curvas lineales doradas */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-80 md:w-[480px] overflow-hidden opacity-50 md:opacity-85">
          <svg
            viewBox="0 0 500 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full object-cover"
          >
            <path
              d="M140 -40 C220 60, 310 160, 520 200"
              stroke={isDark ? '#C9AD74' : '#C5A059'}
              strokeWidth="1.5"
              strokeOpacity={isDark ? '0.45' : '0.55'}
            />
            <path
              d="M260 -60 C310 50, 360 150, 520 150"
              stroke={isDark ? '#C9AD74' : '#B8934A'}
              strokeWidth="1.3"
              strokeOpacity={isDark ? '0.35' : '0.45'}
            />
            <path
              d="M60 -60 C180 40, 280 170, 500 270"
              stroke={isDark ? '#C9AD74' : '#D4AF37'}
              strokeWidth="1.1"
              strokeOpacity={isDark ? '0.25' : '0.35'}
            />
            <ellipse
              cx="410"
              cy="110"
              rx="135"
              ry="110"
              stroke={isDark ? '#C9AD74' : '#C5A059'}
              strokeWidth="1.3"
              strokeOpacity={isDark ? '0.3' : '0.4'}
            />
          </svg>
        </div>

        {/* Contenido del Panel */}
        <div className="relative z-10 max-w-2xl space-y-2">
          <h1
            style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
            className="text-2xl md:text-3xl font-bold tracking-tight"
          >
            {t('home.welcome')}, {profile ? profile.fullName : t('common.guest')}
          </h1>

          <p
            style={{ color: isDark ? '#92A99E' : '#42584A' }}
            className="text-xs md:text-sm font-normal"
          >
            {club.name} - {t('home.federationLicense')}{' '}
            <span
              className="font-mono font-semibold"
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
            >
              {profile ? profile.federationLicense : t('common.notAuthenticated')}
            </span>
          </p>
        </div>

        {/* Fila de 4 Métricas en Tarjetas: Carbón #19191E a #252329 (Dark) / Blanco marfil puro (Light) */}
        <div className="relative z-10 mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Métrica 1: Hándicap Exacto */}
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
                : '#FFFFFF',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(197, 160, 89, 0.35)',
              boxShadow: isDark
                ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                : '0 4px 12px rgba(180, 150, 100, 0.08)',
            }}
            className="rounded-2xl p-4 border shadow-sm transition-colors"
          >
            <div
              style={{ color: isDark ? '#92A99E' : '#5A6F62' }}
              className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider"
            >
              {t('home.exactHandicap')}
            </div>
            <div
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
              className="text-2xl md:text-3xl font-bold mt-1 tracking-tight"
            >
              {profile ? profile.handicapIndex.toFixed(1) : '--'}
            </div>
          </div>

          {/* Métrica 2: Hándicap Juego */}
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
                : '#FFFFFF',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(197, 160, 89, 0.35)',
              boxShadow: isDark
                ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                : '0 4px 12px rgba(180, 150, 100, 0.08)',
            }}
            className="rounded-2xl p-4 border shadow-sm transition-colors"
          >
            <div
              style={{ color: isDark ? '#92A99E' : '#5A6F62' }}
              className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider"
            >
              {t('common.hcp')} ({t('course.yellowTees')})
            </div>
            <div
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
              className="text-2xl md:text-3xl font-bold mt-1 tracking-tight"
            >
              {profile ? playingHcpYellow : '--'}
            </div>
          </div>

          {/* Métrica 3: Motor Marcador */}
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
                : '#FFFFFF',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(197, 160, 89, 0.35)',
              boxShadow: isDark
                ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                : '0 4px 12px rgba(180, 150, 100, 0.08)',
            }}
            className="rounded-2xl p-4 border shadow-sm transition-colors"
          >
            <div
              style={{ color: isDark ? '#92A99E' : '#5A6F62' }}
              className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider"
            >
              {t('home.scoreEngine')}
            </div>
            <div
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
              className="text-base md:text-lg font-bold mt-2"
            >
              {isOnline ? t('home.scoreEngineOnline') : t('home.scoreEngineOffline')}
            </div>
          </div>

          {/* Métrica 4: Módulos Activos */}
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
                : '#FFFFFF',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(197, 160, 89, 0.35)',
              boxShadow: isDark
                ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                : '0 4px 12px rgba(180, 150, 100, 0.08)',
            }}
            className="rounded-2xl p-4 border shadow-sm transition-colors"
          >
            <div
              style={{ color: isDark ? '#92A99E' : '#5A6F62' }}
              className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider"
            >
              {t('home.activeModules')}
            </div>
            <div
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
              className="text-2xl md:text-3xl font-bold mt-1 tracking-tight"
            >
              {enabledNavItems.length}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Tres Tarjetas de Acciones Principales: Botones dorados brillantes con degradado metálico */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Acción 1: Iniciar Vuelta */}
        <div
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
              : '#FFFDF6',
            borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(169, 138, 85, 0.3)',
          }}
          className="rounded-3xl p-6 border shadow-sm flex flex-col justify-between transition hover:border-[#C9AD74]/60"
        >
          <div className="flex items-start gap-3.5">
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #2D271D 0%, #1F1E24 100%)'
                  : 'linear-gradient(135deg, #FAF4E8 0%, #EFE5D0 100%)',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.45)' : 'rgba(169, 138, 85, 0.5)',
                color: isDark ? '#E5C365' : '#8C6F32',
                boxShadow: isDark
                  ? '0 2px 10px rgba(201, 173, 116, 0.18)'
                  : '0 2px 8px rgba(169, 138, 85, 0.15)',
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border shadow-2xs"
            >
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h2
                style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
                className="font-bold text-sm md:text-base"
              >
                {t('home.startRoundTitle')}
              </h2>
              <p
                style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
                className="text-xs font-normal mt-1 leading-relaxed"
              >
                {t('home.startRoundDesc')}
              </p>
            </div>
          </div>

          <Link
            href="/scorecard"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
              color: '#0B0C10',
              fontWeight: 700,
              boxShadow: isDark
                ? '0 4px 14px rgba(201, 173, 116, 0.22)'
                : '0 4px 14px rgba(169, 138, 85, 0.18)',
              border: isDark ? '1px solid #DFCB9E' : '1px solid #CCB88E',
            }}
            className="w-full py-3 px-4 rounded-xl text-center text-xs md:text-sm tracking-wide mt-5 cursor-pointer block transition hover:opacity-95"
          >
            {t('home.startRoundBtn')}
          </Link>
        </div>

        {/* Acción 2: Reservar Salida */}
        <div
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
              : '#FFFDF6',
            borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(169, 138, 85, 0.3)',
          }}
          className="rounded-3xl p-6 border shadow-sm flex flex-col justify-between transition hover:border-[#C9AD74]/60"
        >
          <div className="flex items-start gap-3.5">
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #2D271D 0%, #1F1E24 100%)'
                  : 'linear-gradient(135deg, #FAF4E8 0%, #EFE5D0 100%)',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.45)' : 'rgba(169, 138, 85, 0.5)',
                color: isDark ? '#E5C365' : '#8C6F32',
                boxShadow: isDark
                  ? '0 2px 10px rgba(201, 173, 116, 0.18)'
                  : '0 2px 8px rgba(169, 138, 85, 0.15)',
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border shadow-2xs"
            >
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2
                style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
                className="font-bold text-sm md:text-base"
              >
                {t('home.bookTeeTitle')}
              </h2>
              <p
                style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
                className="text-xs font-normal mt-1 leading-relaxed"
              >
                {t('home.bookTeeDesc')}
              </p>
            </div>
          </div>

          <Link
            href="/bookings"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
              color: '#0B0C10',
              fontWeight: 700,
              boxShadow: isDark
                ? '0 4px 14px rgba(201, 173, 116, 0.22)'
                : '0 4px 14px rgba(169, 138, 85, 0.18)',
              border: isDark ? '1px solid #DFCB9E' : '1px solid #CCB88E',
            }}
            className="w-full py-3 px-4 rounded-xl text-center text-xs md:text-sm tracking-wide mt-5 cursor-pointer block transition hover:opacity-95"
          >
            {t('home.bookTeeBtn')}
          </Link>
        </div>

        {/* Acción 3: Mi Perfil y Hándicap WHS */}
        <div
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
              : '#FFFDF6',
            borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(169, 138, 85, 0.3)',
          }}
          className="rounded-3xl p-6 border shadow-sm flex flex-col justify-between transition hover:border-[#C9AD74]/60"
        >
          <div className="flex items-start gap-3.5">
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #2D271D 0%, #1F1E24 100%)'
                  : 'linear-gradient(135deg, #FAF4E8 0%, #EFE5D0 100%)',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.45)' : 'rgba(169, 138, 85, 0.5)',
                color: isDark ? '#E5C365' : '#8C6F32',
                boxShadow: isDark
                  ? '0 2px 10px rgba(201, 173, 116, 0.18)'
                  : '0 2px 8px rgba(169, 138, 85, 0.15)',
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border shadow-2xs"
            >
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2
                style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
                className="font-bold text-sm md:text-base"
              >
                {t('home.profileTitle')}
              </h2>
              <p
                style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
                className="text-xs font-normal mt-1 leading-relaxed"
              >
                {t('home.profileDesc')}
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
              color: '#0B0C10',
              fontWeight: 700,
              boxShadow: isDark
                ? '0 4px 14px rgba(201, 173, 116, 0.22)'
                : '0 4px 14px rgba(169, 138, 85, 0.18)',
              border: isDark ? '1px solid #DFCB9E' : '1px solid #CCB88E',
            }}
            className="w-full py-3 px-4 rounded-xl text-center text-xs md:text-sm tracking-wide mt-5 cursor-pointer block transition hover:opacity-95"
          >
            {t('home.profileBtn')}
          </Link>
        </div>
      </section>

      {/* 3. Panel Inferior: Carbón #202127 (Dark) / Blanco Cálido #FCFAF5 (Light) */}
      <section
        style={{
          backgroundColor: isDark ? '#202127' : '#FCFAF5',
          borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : '#D8DFD9',
        }}
        className="rounded-3xl border p-6 shadow-sm transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h2
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
              className="text-base md:text-lg font-bold"
            >
              {t('home.ecosystemTitle')} ({club.shortName})
            </h2>
          </div>


        </div>

        {/* Las 3 Tarjetas de Módulos: Verde #0C3029 a #104238 (Dark) / Salvia #D8E4D9 (Light) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tarjeta 1: Calendario Partidos */}
          <Link
            href="/calendar"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #0C3029 0%, #104238 100%)'
                : '#D8E4D9',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : '#C4D4C5',
            }}
            className="rounded-2xl p-5 border shadow-sm transition hover:border-[#C9AD74]/60 group"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C9AD74]" />
              <h3
                style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
                className="font-bold text-sm md:text-base"
              >
                Calendario Partidos
              </h3>
            </div>
            <p
              style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
              className="text-xs font-normal mt-2 leading-relaxed"
            >
              Calendario de partidos abiertos, búsqueda de compañeros y encuentros amistosos.
            </p>
          </Link>

          {/* Tarjeta 2: Torneos Especiales */}
          <Link
            href="/tournaments"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #0C3029 0%, #104238 100%)'
                : '#D8E4D9',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : '#C4D4C5',
            }}
            className="rounded-2xl p-5 border shadow-sm transition hover:border-[#C9AD74]/60 group"
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#C9AD74]" />
              <h3
                style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
                className="font-bold text-sm md:text-base"
              >
                Torneos Especiales
              </h3>
            </div>
            <p
              style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
              className="text-xs font-normal mt-2 leading-relaxed"
            >
              Consulta disponibilidad del campo y reserva de la partida de 1 a 4 jugadores.
            </p>
          </Link>

          {/* Tarjeta 3: Mi Perfil y Hándicap WHS */}
          <Link
            href="/profile"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #0C3029 0%, #104238 100%)'
                : '#D8E4D9',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : '#C4D4C5',
            }}
            className="rounded-2xl p-5 border shadow-sm transition hover:border-[#C9AD74]/60 group"
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#C9AD74]" />
              <h3
                style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
                className="font-bold text-sm md:text-base"
              >
                Mi Perfil y Hándicap WHS
              </h3>
            </div>
            <p
              style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
              className="text-xs font-normal mt-2 leading-relaxed"
            >
              Evolución histórica de hándicap, visibilidad de notificaciones push.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
