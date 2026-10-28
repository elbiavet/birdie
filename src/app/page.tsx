'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  Award,
  CalendarClock,
  Compass,
  Flag,
  MapPin,
  MessageCircle,
  Newspaper,
  User,
} from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import { isHomeAliasPath, resolveNavigationItems } from '@/components/layout/AppShell';
import { calculatePlayingHandicap } from '@/lib/supabase/client';

export default function DashboardPage() {
  const { club, profile, isOnline } = useClub();
  const enabledNavItems = resolveNavigationItems(club, profile.role);

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
      {/* Banner Principal White-Label del Club */}
      <section
        style={{
          backgroundColor: club.theme.primary,
          color: club.theme.primaryForeground,
        }}
        className="rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden"
      >
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5" />
            <span>
              GPS Campo: {club.coordinates.lat.toFixed(4)}, {club.coordinates.lng.toFixed(4)}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Bienvenido, {profile.fullName}
          </h1>
          <p className="text-sm opacity-90">
            {club.name} · Licencia Federativa{' '}
            <span className="font-mono font-semibold">{profile.federationLicense}</span>
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-black/20 p-3.5 border border-white/10">
            <div className="text-[11px] uppercase opacity-75">Hándicap Exacto</div>
            <div className="text-2xl font-extrabold mt-0.5">
              {profile.handicapIndex.toFixed(1)}
            </div>
          </div>
          <div className="rounded-2xl bg-black/20 p-3.5 border border-white/10">
            <div className="text-[11px] uppercase opacity-75">Hándicap Juego (Amarillas)</div>
            <div className="text-2xl font-extrabold mt-0.5">{playingHcpYellow}</div>
          </div>
          <div className="rounded-2xl bg-black/20 p-3.5 border border-white/10">
            <div className="text-[11px] uppercase opacity-75">Motor Marcador</div>
            <div className="text-sm font-bold mt-1.5">
              {isOnline ? 'Realtime + SQLite' : 'Modo Offline SQLite'}
            </div>
          </div>
          <div className="rounded-2xl bg-black/20 p-3.5 border border-white/10">
            <div className="text-[11px] uppercase opacity-75">Módulos Activos</div>
            <div className="text-2xl font-extrabold mt-0.5">{enabledNavItems.length}</div>
          </div>
        </div>
      </section>

      {/* Accesos Rápidos Deportivos */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/scorecard"
          className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-600 transition shadow-xs flex items-start gap-4"
        >
          <div
            style={{
              backgroundColor: club.theme.primary,
              color: club.theme.primaryForeground,
            }}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          >
            <Flag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Iniciar Vuelta (Marcador + GPS)</h2>
            <p className="text-xs text-slate-600 mt-1">
              Distancias a frente/centro/fondo de green y anotación offline en SQLite.
            </p>
          </div>
        </Link>

        <Link
          href="/bookings"
          className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-600 transition shadow-xs flex items-start gap-4"
        >
          <div
            style={{
              backgroundColor: club.theme.accent,
              color: '#ffffff',
            }}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          >
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Reservar Salida (Tee Time)</h2>
            <p className="text-xs text-slate-600 mt-1">
              Consulta disponibilidad del campo y reserva para tu partida de 1 a 4 jugadores.
            </p>
          </div>
        </Link>

        <Link
          href="/profile"
          className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-600 transition shadow-xs flex items-start gap-4"
        >
          <div
            style={{
              backgroundColor: club.theme.secondary,
              color: '#0f172a',
            }}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          >
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Mi Perfil y Hándicap WHS</h2>
            <p className="text-xs text-slate-600 mt-1">
              Evolución histórica de hándicap, visibilidad en el directorio y notificaciones push.
            </p>
          </div>
        </Link>
      </section>

      {/* Resumen de Módulos Configurados para este Club */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Ecosistema del Club ({club.shortName})
            </h2>
            <p className="text-xs text-slate-500">
              Secciones habilitadas dinámicamente según <code>/clubs/{club.clubId}/config.json</code>
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700">
            Golf API ID: {club.defaultCourseExternalId}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {enabledNavItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200/90 hover:bg-slate-50 text-xs font-semibold text-slate-800 transition"
            >
              <Compass className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
