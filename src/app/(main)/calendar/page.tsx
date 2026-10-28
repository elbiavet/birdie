'use client';

import React, { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useClub } from '@/components/providers/ClubProvider';
import {
  filterCalendarMatches,
  INITIAL_CALENDAR_MATCHES,
  joinOpenMatch,
  type CalendarMatchItem,
} from '@/lib/competition';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';

export default function MatchCalendarPage() {
  const { profile } = useClub();
  const [matches, setMatches] = useState<CalendarMatchItem[]>(INITIAL_CALENDAR_MATCHES);
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [onlyOpenSpots, setOnlyOpenSpots] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [banner, setBanner] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const visibleMatches = useMemo(
    () =>
      filterCalendarMatches(matches, {
        monthPrefix: monthFilter,
        onlyOpenSpots,
        searchQuery,
      }),
    [matches, monthFilter, onlyOpenSpots, searchQuery]
  );

  const handleJoinMatch = (matchId: string) => {
    try {
      const updated = joinOpenMatch(matches, {
        matchId,
        playerId: profile.id,
        playerName: profile.fullName,
        handicapIndex: profile.handicapIndex,
      });
      setMatches(updated);
      setBanner({
        type: 'ok',
        message: `Te has unido correctamente a la partida con hándicap ${profile.handicapIndex}.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'No se pudo unir a la partida.',
      });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Cabecera y Filtros */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <Calendar className="h-3.5 w-3.5" />
                Partidas Abiertas y Salidas Sociales
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Calendario de Partidos
              </h2>
              <p className="text-sm text-slate-600">
                Encuentra compañeros de partida por nivel de hándicap, modalidad y mes.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={onlyOpenSpots}
                onChange={(e) => setOnlyOpenSpots(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              Solo partidas con plazas libres
            </label>
          </div>

          {banner && (
            <div
              role="status"
              className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${
                banner.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {banner.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600" />
              )}
              <span>{banner.message}</span>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, campo, modalidad u organizador..."
                aria-label="Buscar partida en el calendario"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Filtrar por mes"
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Todos los meses</option>
              <option value="2026-11">Noviembre 2026</option>
              <option value="2026-12">Diciembre 2026</option>
            </select>
          </div>
        </section>

        {/* Tarjetas de Partidas Abiertas */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleMatches.map((match) => {
            const seatsLeft = Math.max(0, match.maxPlayers - match.enrolledPlayers.length);
            const alreadyJoined = match.enrolledPlayers.some(
              (p) => p.playerId === profile.id
            );

            return (
              <div
                key={match.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                      {match.formatLabel}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      HCP máx: {match.maxHandicapAllowed ?? 'Sin límite'}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-slate-900">{match.title}</h3>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {match.matchDate} · Salida {match.teeTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Flag className="h-3.5 w-3.5 text-slate-400" />
                      <span>{match.courseName}</span>
                    </div>
                  </div>

                  {/* Jugadores inscritos */}
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-emerald-700" />
                        Jugadores ({match.enrolledPlayers.length}/{match.maxPlayers})
                      </span>
                      <span className="text-emerald-700">{seatsLeft} plaza(s) libre(s)</span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {match.enrolledPlayers.map((p) => (
                        <span
                          key={p.playerId}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                        >
                          {p.playerName} (HCP {p.handicapIndex})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-2">
                  <button
                    type="button"
                    disabled={alreadyJoined || seatsLeft === 0}
                    onClick={() => handleJoinMatch(match.id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-40"
                  >
                    <UserPlus className="h-4 w-4" />
                    {alreadyJoined
                      ? 'Inscrito en la Partida'
                      : seatsLeft === 0
                        ? 'Partida Completa'
                        : 'Unirme a esta Partida'}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
