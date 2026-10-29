'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
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

export default function DashboardPage() {
  const { club, profile, isOnline } = useClub();
  const { resolvedTheme } = useTheme();
  const enabledNavItems = resolveNavigationItems(club, profile.role);
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

  const playingHcpYellow = calculatePlayingHandicap({
    handicapIndex: profile.handicapIndex,
    slopeRating: 128,
    courseRating: 71.5,
    par: 72,
  });

  return (
    <div className="space-y-6">
      {/* 1. Panel de Bienvenida: Degradado verde #064334 a #0D3028 (Dark) / Beige #F0EBDD a #E8E3D4 (Light) */}
      <section
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #064334 0%, #0D3028 100%)'
            : 'linear-gradient(135deg, #F0EBDD 0%, #E8E3D4 100%)',
          borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(169, 138, 85, 0.3)',
        }}
        className="rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden border transition-colors duration-200"
      >
        {/* Curvas lineales doradas idénticas a la referencia */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-80 md:w-[480px] overflow-hidden opacity-45 md:opacity-80">
          <svg
            viewBox="0 0 500 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full object-cover"
          >
            <path
              d="M140 -40 C220 60, 310 160, 520 200"
              stroke={isDark ? '#C9AD74' : '#A98A55'}
              strokeWidth="1.5"
              strokeOpacity="0.45"
            />
            <path
              d="M260 -60 C310 50, 360 150, 520 150"
              stroke={isDark ? '#C9AD74' : '#A98A55'}
              strokeWidth="1.2"
              strokeOpacity="0.35"
            />
            <path
              d="M60 -60 C180 40, 280 170, 500 270"
              stroke={isDark ? '#C9AD74' : '#A98A55'}
              strokeWidth="1"
              strokeOpacity="0.25"
            />
            <ellipse
              cx="410"
              cy="110"
              rx="135"
              ry="110"
              stroke={isDark ? '#C9AD74' : '#A98A55'}
              strokeWidth="1.2"
              strokeOpacity="0.3"
            />
          </svg>
        </div>

        {/* Contenido del Panel */}
        <div className="relative z-10 max-w-2xl space-y-2">
          {/* Badge GPS del Campo */}
          <div
            style={{
              backgroundColor: isDark ? '#0D3028' : '#FFFDF6',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.3)' : 'rgba(169, 138, 85, 0.35)',
              color: isDark ? '#D5C7A5' : '#0A3A2A',
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border shadow-2xs"
          >
            <MapPin className="w-3.5 h-3.5 text-[#C9AD74]" />
            <span>
              GPS CAMPO: {club.coordinates.lat.toFixed(4)}, {club.coordinates.lng.toFixed(4)}
            </span>
          </div>

          <h1
            style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
            className="text-2xl md:text-3xl font-bold tracking-tight"
          >
            Bienvenido, {profile.fullName}
          </h1>

          <p
            style={{ color: isDark ? '#92A99E' : '#52665B' }}
            className="text-xs md:text-sm font-normal"
          >
            {club.name} - Licencia Federativa{' '}
            <span
              className="font-mono font-semibold"
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
            >
              {profile.federationLicense}
            </span>
          </p>
        </div>

        {/* Fila de 4 Métricas en Tarjetas: Carbón #19191E a #252329 (Dark) / #FFFDF6 (Light) */}
        <div className="relative z-10 mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Métrica 1: Hándicap Exacto */}
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
                : '#FFFDF6',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(169, 138, 85, 0.3)',
            }}
            className="rounded-2xl p-4 border shadow-sm transition-colors"
          >
            <div
              style={{ color: isDark ? '#92A99E' : '#52665B' }}
              className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider"
            >
              Hándicap Exacto
            </div>
            <div
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
              className="text-2xl md:text-3xl font-bold mt-1 tracking-tight"
            >
              {profile.handicapIndex.toFixed(1)}
            </div>
          </div>

          {/* Métrica 2: Hándicap Juego */}
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
                : '#FFFDF6',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(169, 138, 85, 0.3)',
            }}
            className="rounded-2xl p-4 border shadow-sm transition-colors"
          >
            <div
              style={{ color: isDark ? '#92A99E' : '#52665B' }}
              className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider"
            >
              Hándicap Juego (Amarillas)
            </div>
            <div
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
              className="text-2xl md:text-3xl font-bold mt-1 tracking-tight"
            >
              {playingHcpYellow}
            </div>
          </div>

          {/* Métrica 3: Motor Marcador */}
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
                : '#FFFDF6',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(169, 138, 85, 0.3)',
            }}
            className="rounded-2xl p-4 border shadow-sm transition-colors"
          >
            <div
              style={{ color: isDark ? '#92A99E' : '#52665B' }}
              className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider"
            >
              Motor Marcador
            </div>
            <div
              style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
              className="text-base md:text-lg font-bold mt-2"
            >
              {isOnline ? 'Realtime + SQLite' : 'Offline SQLite'}
            </div>
          </div>

          {/* Métrica 4: Módulos Activos */}
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
                : '#FFFDF6',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(169, 138, 85, 0.3)',
            }}
            className="rounded-2xl p-4 border shadow-sm transition-colors"
          >
            <div
              style={{ color: isDark ? '#92A99E' : '#52665B' }}
              className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider"
            >
              Módulos Activos
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

      {/* 2. Tres Tarjetas de Acciones Principales: Carbón #19191E a #252329 con Botones #C9AD74 */}
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
                backgroundColor: isDark ? '#252329' : '#F0EBDD',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(169, 138, 85, 0.4)',
                color: isDark ? '#C9AD74' : '#A98A55',
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
                Iniciar Vuelta (Marcador + GPS)
              </h2>
              <p
                style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
                className="text-xs font-normal mt-1 leading-relaxed"
              >
                Distancias de frente/centro/fondo de green y anotación offline en SQLite.
              </p>
            </div>
          </div>

          <Link
            href="/scorecard"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #C9AD74 0%, #B8995E 100%)'
                : 'linear-gradient(135deg, #A98A55 0%, #997843 100%)',
              color: isDark ? '#0B0C10' : '#FCFAF5',
              fontWeight: 700,
              boxShadow: isDark
                ? '0 3px 12px rgba(201, 173, 116, 0.35)'
                : '0 3px 12px rgba(169, 138, 85, 0.25)',
              border: isDark ? '1px solid #D8BF88' : '1px solid #B49662',
            }}
            className="w-full py-3 px-4 rounded-xl text-center text-xs md:text-sm tracking-wide mt-5 cursor-pointer block transition hover:opacity-95"
          >
            Iniciar Vuelta
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
                backgroundColor: isDark ? '#252329' : '#F0EBDD',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(169, 138, 85, 0.4)',
                color: isDark ? '#C9AD74' : '#A98A55',
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
                Reservar Salida (Tee Time)
              </h2>
              <p
                style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
                className="text-xs font-normal mt-1 leading-relaxed"
              >
                Consulta disponibilidad del campo y reserva de la partida de 1 a 4 jugadores.
              </p>
            </div>
          </div>

          <Link
            href="/bookings"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #C9AD74 0%, #B8995E 100%)'
                : 'linear-gradient(135deg, #A98A55 0%, #997843 100%)',
              color: isDark ? '#0B0C10' : '#FCFAF5',
              fontWeight: 700,
              boxShadow: isDark
                ? '0 3px 12px rgba(201, 173, 116, 0.35)'
                : '0 3px 12px rgba(169, 138, 85, 0.25)',
              border: isDark ? '1px solid #D8BF88' : '1px solid #B49662',
            }}
            className="w-full py-3 px-4 rounded-xl text-center text-xs md:text-sm tracking-wide mt-5 cursor-pointer block transition hover:opacity-95"
          >
            Reservar Salida
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
                backgroundColor: isDark ? '#252329' : '#F0EBDD',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(169, 138, 85, 0.4)',
                color: isDark ? '#C9AD74' : '#A98A55',
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
                Mi Perfil y Hándicap WHS
              </h2>
              <p
                style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
                className="text-xs font-normal mt-1 leading-relaxed"
              >
                Evolución histórica de hándicap, visibilidad del directorio y notificaciones push.
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #C9AD74 0%, #B8995E 100%)'
                : 'linear-gradient(135deg, #A98A55 0%, #997843 100%)',
              color: isDark ? '#0B0C10' : '#FCFAF5',
              fontWeight: 700,
              boxShadow: isDark
                ? '0 3px 12px rgba(201, 173, 116, 0.35)'
                : '0 3px 12px rgba(169, 138, 85, 0.25)',
              border: isDark ? '1px solid #D8BF88' : '1px solid #B49662',
            }}
            className="w-full py-3 px-4 rounded-xl text-center text-xs md:text-sm tracking-wide mt-5 cursor-pointer block transition hover:opacity-95"
          >
            Mi Perfil WHS
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
              Club Ecosystem de Club ({club.shortName})
            </h2>
            <p
              style={{ color: isDark ? '#92A99E' : '#52665B' }}
              className="text-xs font-normal"
            >
              Secciones habilitadas dinámicamente según <code>/clubs/{club.clubId}/config.json</code>
            </p>
          </div>

          <span
            style={{
              backgroundColor: isDark ? '#19191E' : '#E8ECE9',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : '#CBD7CC',
              color: isDark ? '#D5C7A5' : '#0A3A2A',
            }}
            className="inline-flex items-center text-xs font-mono px-3 py-1 rounded-full border font-medium self-start sm:self-auto"
          >
            Golf API ID: {club.defaultCourseExternalId}
          </span>
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
