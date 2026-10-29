'use client';

import React, { useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  filterCalendarMatches,
  INITIAL_CALENDAR_MATCHES,
  joinOpenMatch,
  resolvePersistenceMetadata,
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
import { useTheme } from '@/components/providers/ThemeProvider';

export default function MatchCalendarPage() {
  const { profile } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
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
      const meta = resolvePersistenceMetadata();
      setMatches(updated);
      setBanner({
        type: 'ok',
        message: `Unido a la partida con hándicap ${profile.handicapIndex}. ${meta.notice}`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'No se pudo unir a la partida.',
      });
    }
  };

  return (
    <div className="space-y-6">
        {/* Cabecera y Filtros */}
        <section className="hero-banner-luxury p-6 shadow-sm relative overflow-hidden transition-all duration-200">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center relative z-10">
            <div>
              <span
                style={{
                  backgroundColor: isDark ? 'rgba(42, 36, 20, 0.85)' : 'rgba(255, 255, 255, 0.7)',
                  borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(197, 160, 89, 0.45)',
                  color: isDark ? '#E4D3AC' : '#0A3A2A',
                }}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-xs"
              >
                <Calendar className="h-3.5 w-3.5" />
                Partidas Abiertas y Salidas Sociales
              </span>
              <h2 className="mt-2 text-2xl font-bold">
                Calendario de Partidos
              </h2>
              <p className="text-sm font-normal opacity-90">
                Encuentra compañeros de partida por nivel de hándicap, modalidad y mes.
              </p>
            </div>

            <label
              style={{
                backgroundColor: isDark ? '#19191E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.3)' : 'rgba(197, 160, 89, 0.35)',
                color: isDark ? '#E4D3AC' : '#0A3A2A',
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold"
            >
              <input
                type="checkbox"
                checked={onlyOpenSpots}
                onChange={(e) => setOnlyOpenSpots(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--theme-accent)]"
              />
              Solo partidas con plazas libres
            </label>
          </div>

          {banner && (
            <div
              role="status"
              className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${
                banner.type === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              }`}
            >
              {banner.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-500" />
              )}
              <span>{banner.message}</span>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[var(--theme-text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, campo, modalidad u organizador..."
                aria-label="Buscar partida en el calendario"
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] py-2.5 pl-10 pr-4 text-sm focus:border-[var(--theme-accent)] focus:outline-none"
              />
            </div>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Filtrar por mes"
              className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3.5 py-2.5 text-sm focus:border-[var(--theme-accent)] focus:outline-none"
            >
              <option value="" className="bg-[var(--theme-surface)]">Todos los meses</option>
              <option value="2026-11" className="bg-[var(--theme-surface)]">Noviembre 2026</option>
              <option value="2026-12" className="bg-[var(--theme-surface)]">Diciembre 2026</option>
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
                className="card-luxury flex flex-col justify-between p-6 shadow-xs transition-colors"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-bold text-[var(--theme-accent)]">
                      {match.formatLabel}
                    </span>
                    <span className="text-xs font-semibold text-[var(--theme-text-secondary)]">
                      HCP máx: {match.maxHandicapAllowed ?? 'Sin límite'}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-[var(--theme-text-primary)]">{match.title}</h3>
                  <div className="mt-2 space-y-1 text-xs text-[var(--theme-text-secondary)] font-normal">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                      <span>
                        {match.matchDate} · Salida {match.teeTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Flag className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                      <span>{match.courseName}</span>
                    </div>
                  </div>

                  {/* Jugadores inscritos */}
                  <div className="mt-4 border-t border-[var(--theme-border)] pt-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--theme-text-primary)]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                        Jugadores ({match.enrolledPlayers.length}/{match.maxPlayers})
                      </span>
                      <span className="text-[var(--theme-accent)] font-bold">{seatsLeft} plaza(s) libre(s)</span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {match.enrolledPlayers.map((p) => (
                        <span
                          key={p.playerId}
                          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--theme-text-primary)]"
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
                    className="btn-gold-gradient inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs transition hover:opacity-95 disabled:opacity-40 cursor-pointer"
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
  );
}
