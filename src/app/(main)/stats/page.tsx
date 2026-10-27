'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useClub } from '@/components/providers/ClubProvider';
import {
  computePlayerStatistics,
  DEMO_HISTORICAL_HOLE_SAMPLES,
  type AnalyzedHoleSample,
} from '@/lib/stats/analyzer';
import { getOfflineRoundScores } from '@/lib/capacitor/sqlite';
import { DEMO_HANDICAP_HISTORY } from '@/lib/supabase/client';
import { getCourseById, GOLF_API_COURSES_CATALOG } from '@/lib/golf-api';
import {
  Activity,
  Award,
  BarChart3,
  CheckCircle2,
  Compass,
  TrendingDown,
} from 'lucide-react';

const ACTIVE_ROUND_ID = 'round-active-birdie-2026';

export default function PlayerStatsPage() {
  const { club, profile } = useClub();
  const [liveSamples, setLiveSamples] = useState<AnalyzedHoleSample[]>([]);

  useEffect(() => {
    async function loadOfflineSamples() {
      const course =
        getCourseById(club.defaultCourseExternalId) ?? GOLF_API_COURSES_CATALOG[0];
      const stored = await getOfflineRoundScores(ACTIVE_ROUND_ID, profile.id);
      const mapped: AnalyzedHoleSample[] = stored.map((s) => {
        const holeDef = course.holes.find((h) => h.holeNumber === s.holeNumber);
        return {
          roundId: s.roundId,
          playedDate: s.updatedAt.slice(0, 10),
          holeNumber: s.holeNumber,
          par: (holeDef?.par ?? 4) as 3 | 4 | 5,
          strokes: s.strokes,
          putts: s.putts,
          fairwayHit: s.fairwayHit,
          greenInRegulation: s.greenInRegulation,
          sandSave: s.sandSave ?? null,
          stablefordPoints: s.stablefordPoints,
        };
      });
      setLiveSamples(mapped);
    }
    loadOfflineSamples();
  }, [club.defaultCourseExternalId, profile.id]);

  const combinedSamples = useMemo(
    () => [...DEMO_HISTORICAL_HOLE_SAMPLES, ...liveSamples],
    [liveSamples]
  );

  const stats = useMemo(
    () => computePlayerStatistics(combinedSamples),
    [combinedSamples]
  );

  const distTotal = Math.max(1, stats.holesCount);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Cabecera */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <BarChart3 className="h-3.5 w-3.5" />
                Analítica Deportiva WHS · Tiempo Real + Histórico
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Estadísticas de Rendimiento
              </h2>
              <p className="text-sm text-slate-600">
                Jugador: <span className="font-semibold">{profile.fullName}</span> ·
                Hándicap Exacto <span className="font-bold">{profile.handicapIndex}</span>{' '}
                · Muestra analizada: {stats.holesCount} hoyos ({stats.roundsCount}{' '}
                vueltas)
              </p>
            </div>

            {liveSamples.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Incluye {liveSamples.length} hoyo(s) anotados en la ronda actual
              </span>
            )}
          </div>
        </section>

        {/* KPIs Principales */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold text-slate-500">
              Media Bruta (18h)
            </span>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {stats.averageGrossPer18}
            </p>
            <span className="text-[11px] text-slate-500">Golpes por vuelta</span>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
            <span className="text-xs font-semibold text-emerald-800">
              Media Stableford
            </span>
            <p className="mt-1 text-2xl font-black text-emerald-900">
              {stats.averageStablefordPer18} pts
            </p>
            <span className="text-[11px] text-emerald-700">Base 36 pts WHS</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold text-slate-500">
              Calles Cogidas (FIR)
            </span>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {stats.fairwayHitPercentage}%
            </p>
            <span className="text-[11px] text-slate-500">Precisión desde el Tee</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold text-slate-500">
              Green en Reg. (GIR)
            </span>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {stats.girPercentage}%
            </p>
            <span className="text-[11px] text-slate-500">
              Putts en GIR: {stats.averagePuttsOnGir}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold text-slate-500">
              Scrambling (Up & Down)
            </span>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {stats.scramblingPercentage}%
            </p>
            <span className="text-[11px] text-slate-500">
              Sand Save: {stats.sandSavePercentage}%
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold text-slate-500">Putts por 18h</span>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {stats.averagePuttsPer18}
            </p>
            <span className="text-[11px] text-slate-500">
              {stats.averagePuttsPerHole} putts / hoyo
            </span>
          </div>
        </section>

        {/* Grid: Rendimiento por Par de Hoyo + Distribución de Resultados */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Media de golpes por Par 3, Par 4 y Par 5 */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-emerald-700" />
              <h3 className="text-lg font-bold text-slate-900">
                Rendimiento por Par de Hoyo
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Promedio de golpes brutos según la tipología del hoyo.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-4">
              {[
                { label: 'Hoyos Par 3', par: 3, avg: stats.par3AverageStrokes },
                { label: 'Hoyos Par 4', par: 4, avg: stats.par4AverageStrokes },
                { label: 'Hoyos Par 5', par: 5, avg: stats.par5AverageStrokes },
              ].map((item) => {
                const diff = Number((item.avg - item.par).toFixed(2));
                const diffText = diff >= 0 ? `+${diff}` : `${diff}`;
                return (
                  <div
                    key={item.par}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center"
                  >
                    <span className="text-xs font-bold uppercase text-slate-500">
                      {item.label}
                    </span>
                    <p className="mt-2 text-3xl font-black text-slate-900">
                      {item.avg.toFixed(2)}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      {diffText} vs Par
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Distribución de Golpes (Eagles, Birdies, Pares, Bogeys, Doble+) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900">
                Distribución de Resultados por Hoyo
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Desglose sobre el total de {stats.holesCount} hoyos registrados.
            </p>

            <div className="mt-4 space-y-3">
              {[
                {
                  label: 'Eagle o Mejor',
                  count: stats.distribution.eaglesOrBetter,
                  bar: 'bg-amber-500',
                },
                {
                  label: 'Birdies (-1)',
                  count: stats.distribution.birdies,
                  bar: 'bg-emerald-600',
                },
                {
                  label: 'Pares (E)',
                  count: stats.distribution.pars,
                  bar: 'bg-sky-600',
                },
                {
                  label: 'Bogeys (+1)',
                  count: stats.distribution.bogeys,
                  bar: 'bg-slate-500',
                },
                {
                  label: 'Doble Bogey o + (+2)',
                  count: stats.distribution.doubleBogeysOrWorse,
                  bar: 'bg-rose-500',
                },
              ].map((row) => {
                const pct = Math.round((row.count / distTotal) * 100);
                return (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{row.label}</span>
                      <span>
                        {row.count} hoyos ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${row.bar}`}
                        style={{ width: `${Math.max(pct, row.count > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Evolución Histórica de Hándicap WHS */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-emerald-700" />
            <h3 className="text-lg font-bold text-slate-900">
              Evolución de Hándicap WHS
            </h3>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {DEMO_HANDICAP_HISTORY.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-500">
                    {entry.effectiveDate}
                  </span>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {entry.reason}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 line-through">
                    {entry.previousHandicap}
                  </span>
                  <p className=" flex items-center gap-1 text-lg font-black text-emerald-700">
                    <Activity className="h-4 w-4" />
                    {entry.newHandicap}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
