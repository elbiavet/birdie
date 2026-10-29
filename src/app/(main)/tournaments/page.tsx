'use client';

import React, { useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  INITIAL_TOURNAMENTS,
  rankTournamentLeaderboard,
  registerPlayerInTournament,
  resolvePersistenceMetadata,
  type TournamentDefinition,
  type TournamentScoringMode,
} from '@/lib/competition';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Medal,
  Trophy,
  UserPlus,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function TournamentsAndLeaderboardPage() {
  const { profile } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [tournaments, setTournaments] =
    useState<TournamentDefinition[]>(INITIAL_TOURNAMENTS);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    INITIAL_TOURNAMENTS[0].id
  );
  const [activeScoringView, setActiveScoringView] =
    useState<TournamentScoringMode>('stableford');
  const [banner, setBanner] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const activeTournament = useMemo(
    () =>
      tournaments.find((t) => t.id === selectedTournamentId) ?? tournaments[0],
    [tournaments, selectedTournamentId]
  );

  const rankedLeaderboard = useMemo(
    () =>
      rankTournamentLeaderboard(
        activeTournament.entries,
        activeScoringView,
        activeTournament.coursePar
      ),
    [activeTournament.entries, activeScoringView, activeTournament.coursePar]
  );

  const handleRegister = () => {
    try {
      const updated = registerPlayerInTournament(activeTournament, {
        playerId: profile.id,
        playerName: profile.fullName,
        handicapIndex: profile.handicapIndex,
      });
      const meta = resolvePersistenceMetadata();
      setTournaments((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
      setBanner({
        type: 'ok',
        message: `Inscrito en "${activeTournament.name}" (${profile.fullName}). ${meta.notice}`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Error al inscribirse en el torneo.',
      });
    }
  };

  return (
    <div className="space-y-6">
        {/* Cabecera */}
        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-xs transition-colors">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
                <Trophy className="h-3.5 w-3.5" />
                Competición Oficial · Clasificación WHS en Vivo
              </span>
              <h2 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)]">
                Torneos y Resultados (Leaderboard)
              </h2>
              <p className="text-sm text-[var(--theme-text-secondary)] font-normal">
                Consulta el orden de salidas, inscríbete en campeonatos abiertos y sigue
                la clasificación en tiempo real.
              </p>
            </div>

            {activeTournament.status === 'registration_open' && (
              <button
                type="button"
                onClick={handleRegister}
                style={{
                  backgroundColor: isDark ? '#D4AF37' : '#0A3A2A',
                  color: isDark ? '#08130E' : '#FFFFFF',
                }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs transition hover:opacity-95 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                Inscribirme ({activeTournament.entryFeeEuros} €)
              </button>
            )}
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

          {/* Selector de Torneo */}
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {tournaments.map((t) => {
              const isSelected = t.id === activeTournament.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTournamentId(t.id);
                    setActiveScoringView(t.scoringMode);
                  }}
                  style={
                    isSelected
                      ? {
                          backgroundColor: isDark ? '#16382A' : '#E8ECE9',
                          borderColor: isDark ? '#D4AF37' : '#A38332',
                        }
                      : undefined
                  }
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    isSelected
                      ? 'border-2 shadow-xs'
                      : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] hover:border-[var(--theme-accent)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--theme-text-secondary)]">
                      {t.tournamentDate} · {t.courseName}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        t.status === 'in_progress'
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                          : 'bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-accent)]'
                      }`}
                    >
                      {t.status === 'in_progress'
                        ? 'En Juego (Live)'
                        : 'Inscripción Abierta'}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-[var(--theme-text-primary)]">
                    {t.name}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--theme-text-secondary)] font-normal">
                    Inscritos: {t.entries.length}/{t.maxPlayers} · Derechos de juego:{' '}
                    {t.entryFeeEuros} €
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tabla de Clasificación (Leaderboard) */}
        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-xs transition-colors">
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--theme-border)] pb-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-[var(--theme-accent)]" />
              <div>
                <h3 className="text-lg font-bold text-[var(--theme-text-primary)]">
                  Clasificación Oficial: {activeTournament.name}
                </h3>
                <p className="text-xs text-[var(--theme-text-secondary)] font-normal">
                  Desempate automático por últimos 9 hoyos (Vuelta) y menor Hándicap de
                  Juego.
                </p>
              </div>
            </div>

            {/* Selector de Modalidad de Clasificación */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'stableford', label: 'Stableford Hándicap' },
                  { id: 'stroke_play_net', label: 'Stroke Play Neto' },
                  { id: 'stroke_play_gross', label: 'Scratch (Bruto)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveScoringView(tab.id)}
                  style={
                    activeScoringView === tab.id
                      ? {
                          backgroundColor: isDark ? '#D4AF37' : '#0A3A2A',
                          color: isDark ? '#08130E' : '#FFFFFF',
                          borderColor: isDark ? '#D4AF37' : '#0A3A2A',
                        }
                      : undefined
                  }
                  className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    activeScoringView === tab.id
                      ? 'shadow-xs'
                      : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)]">
                  <th className="px-3 py-2.5 font-bold">Pos.</th>
                  <th className="px-3 py-2.5 font-bold">Jugador</th>
                  <th className="px-3 py-2.5 font-bold">Hora Salida</th>
                  <th className="px-3 py-2.5 text-center font-bold">HCP Juego</th>
                  <th className="px-3 py-2.5 text-center font-bold">Hoyos</th>
                  <th className="px-3 py-2.5 text-center font-bold">Bruto</th>
                  <th className="px-3 py-2.5 text-center font-bold">Neto</th>
                  <th className="px-3 py-2.5 text-center font-bold">Stableford</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)] text-[var(--theme-text-primary)]">
                {rankedLeaderboard.map((row) => {
                  const netDiffText =
                    row.scoreToParNet === 0
                      ? 'E'
                      : row.scoreToParNet > 0
                        ? `+${row.scoreToParNet}`
                        : `${row.scoreToParNet}`;

                  return (
                    <tr
                      key={row.playerId}
                      style={
                        row.position === 1
                          ? {
                              backgroundColor: isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(163, 131, 50, 0.08)',
                            }
                          : undefined
                      }
                      className="transition-colors hover:bg-[var(--theme-surface-subtle)]/50"
                    >
                      <td className="px-3 py-3 font-metric font-bold text-[var(--theme-text-primary)]">
                        <span className="inline-flex items-center gap-1">
                          {row.position === 1 && (
                            <Medal className="h-4 w-4 text-[var(--theme-accent)]" />
                          )}
                          {row.isTied ? `T${row.position}` : row.position}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-[var(--theme-text-primary)]">
                        {row.playerName}
                      </td>
                      <td className="px-3 py-3 text-[var(--theme-text-secondary)]">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-[var(--theme-accent)]" />
                          {row.teeTime}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-[var(--theme-text-secondary)] font-normal">
                        {row.playingHandicap} ({row.handicapIndex})
                      </td>
                      <td className="px-3 py-3 text-center text-[var(--theme-text-secondary)] font-normal">
                        {row.holesCompleted}/18
                      </td>
                      <td className="px-3 py-3 text-center font-metric font-semibold text-[var(--theme-text-primary)]">
                        {row.grossStrokes}
                      </td>
                      <td className="px-3 py-3 text-center font-metric font-semibold text-[var(--theme-accent)]">
                        {row.netStrokes} ({netDiffText})
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          style={{
                            backgroundColor: isDark ? '#16382A' : '#E8ECE9',
                            color: isDark ? '#D4AF37' : '#0A3A2A',
                            borderColor: isDark ? '#255440' : '#CBD5E1',
                          }}
                          className="rounded-lg border px-2.5 py-1 font-metric font-bold"
                        >
                          {row.stablefordPoints} pts
                        </span>
                        <span className="ml-1.5 text-[10px] text-[var(--theme-text-secondary)]">
                          (2ªV: {row.backNineStablefordPoints})
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
  );
}
