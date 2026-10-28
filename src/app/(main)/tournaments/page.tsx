'use client';

import React, { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
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

export default function TournamentsAndLeaderboardPage() {
  const { profile } = useClub();
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
    <AppShell>
      <div className="space-y-6">
        {/* Cabecera */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                <Trophy className="h-3.5 w-3.5 text-amber-600" />
                Competición Oficial · Clasificación WHS en Vivo
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Torneos y Resultados (Leaderboard)
              </h2>
              <p className="text-sm text-slate-600">
                Consulta el orden de salidas, inscríbete en campeonatos abiertos y sigue
                la clasificación en tiempo real.
              </p>
            </div>

            {activeTournament.status === 'registration_open' && (
              <button
                type="button"
                onClick={handleRegister}
                className="inline-flex items-center gap-2 rounded-xl bg-club-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
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
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500">
                      {t.tournamentDate} · {t.courseName}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        t.status === 'in_progress'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-sky-100 text-sky-900'
                      }`}
                    >
                      {t.status === 'in_progress'
                        ? 'En Juego (Live)'
                        : 'Inscripción Abierta'}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-slate-900">
                    {t.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Inscritos: {t.entries.length}/{t.maxPlayers} · Derechos de juego:{' '}
                    {t.entryFeeEuros} €
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tabla de Clasificación (Leaderboard) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Clasificación Oficial: {activeTournament.name}
                </h3>
                <p className="text-xs text-slate-500">
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
                  className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                    activeScoringView === tab.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
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
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
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
              <tbody className="divide-y divide-slate-200">
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
                      className={
                        row.position === 1 ? 'bg-amber-50/50 font-semibold' : ''
                      }
                    >
                      <td className="px-3 py-3 font-black text-slate-900">
                        <span className="inline-flex items-center gap-1">
                          {row.position === 1 && (
                            <Medal className="h-4 w-4 text-amber-500" />
                          )}
                          {row.isTied ? `T${row.position}` : row.position}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-900">
                        {row.playerName}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {row.teeTime}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600">
                        {row.playingHandicap} ({row.handicapIndex})
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600">
                        {row.holesCompleted}/18
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800">
                        {row.grossStrokes}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-emerald-800">
                        {row.netStrokes} ({netDiffText})
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="rounded-lg bg-emerald-100 px-2.5 py-1 font-black text-emerald-900">
                          {row.stablefordPoints} pts
                        </span>
                        <span className="ml-1.5 text-[10px] text-slate-500">
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
    </AppShell>
  );
}
