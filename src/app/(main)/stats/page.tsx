'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  computePlayerStatistics,
  DEMO_HISTORICAL_HOLE_SAMPLES,
  type AnalyzedHoleSample,
} from '@/lib/stats/analyzer';
import { getOfflineRoundScores } from '@/lib/capacitor/sqlite';
import { DEMO_HANDICAP_HISTORY } from '@/lib/supabase/client';
import { getCourseById, GOLF_API_COURSES_CATALOG } from '@/lib/golf-api';
import { useTheme } from '@/components/providers/ThemeProvider';
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
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
    <div className="space-y-6">
        {/* Cabecera */}
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
                <BarChart3 className="h-3.5 w-3.5" />
                Analítica Deportiva WHS · Tiempo Real + Histórico
              </span>
              <h2 className="mt-2 text-2xl font-bold">
                Estadísticas de Rendimiento
              </h2>
              <p className="text-sm font-normal opacity-90">
                Jugador: <span className="font-semibold">{profile.fullName}</span> ·{' '}
                Hándicap Exacto <span className="font-bold">{profile.handicapIndex}</span>{' '}
                · Muestra analizada: {stats.holesCount} hoyos ({stats.roundsCount} vueltas)
              </p>
            </div>

            {liveSamples.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Incluye {liveSamples.length} hoyo(s) anotados en la ronda actual
              </span>
            )}
          </div>
        </section>

        {/* KPIs Principales */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="card-luxury p-4 shadow-xs transition-colors">
            <span className="text-xs font-medium text-[var(--theme-text-secondary)]">
              Media Bruta (18h)
            </span>
            <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)]">
              {stats.averageGrossPer18}
            </p>
            <span className="text-[11px] text-[var(--theme-text-secondary)]">Golpes por vuelta</span>
          </div>

          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #2D271D 0%, #1F1E24 100%)'
                : 'linear-gradient(135deg, #FAF4E8 0%, #EFE5D0 100%)',
              borderColor: isDark ? 'rgba(201, 173, 116, 0.5)' : 'rgba(169, 138, 85, 0.5)',
              boxShadow: isDark
                ? '0 2px 10px rgba(201, 173, 116, 0.2)'
                : '0 2px 8px rgba(169, 138, 85, 0.15)',
            }}
            className="rounded-2xl border-2 p-4 shadow-xs transition-colors"
          >
            <span
              style={{ color: isDark ? '#E6D4A7' : '#8C6F32' }}
              className="text-xs font-bold"
            >
              Media Stableford
            </span>
            <p
              style={{ color: isDark ? '#E6D4A7' : '#0A3A2A' }}
              className="mt-1 text-2xl font-metric font-bold"
            >
              {stats.averageStablefordPer18} pts
            </p>
            <span className="text-[11px] opacity-80 font-medium">Base 36 pts WHS</span>
          </div>

          <div className="card-luxury p-4 shadow-xs transition-colors">
            <span className="text-xs font-medium text-[var(--theme-text-secondary)]">
              Calles Cogidas (FIR)
            </span>
            <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)] font-bold">
              {stats.fairwayHitPercentage}%
            </p>
            <span className="text-[11px] text-[var(--theme-text-secondary)]">Precisión desde el Tee</span>
          </div>

          <div className="card-luxury p-4 shadow-xs transition-colors">
            <span className="text-xs font-medium text-[var(--theme-text-secondary)]">
              Green en Reg. (GIR)
            </span>
            <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)] font-bold">
              {stats.girPercentage}%
            </p>
            <span className="text-[11px] text-[var(--theme-text-secondary)]">
              Putts en GIR: {stats.averagePuttsOnGir}
            </span>
          </div>

          <div className="card-luxury p-4 shadow-xs transition-colors">
            <span className="text-xs font-medium text-[var(--theme-text-secondary)]">
              Scrambling (Up & Down)
            </span>
            <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)] font-bold">
              {stats.scramblingPercentage}%
            </p>
            <span className="text-[11px] text-[var(--theme-text-secondary)]">
              Sand Save: {stats.sandSavePercentage}%
            </span>
          </div>

          <div className="card-luxury p-4 shadow-xs transition-colors">
            <span className="text-xs font-medium text-[var(--theme-text-secondary)]">Putts por 18h</span>
            <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)] font-bold">
              {stats.averagePuttsPer18}
            </p>
            <span className="text-[11px] text-[var(--theme-text-secondary)]">
              {stats.averagePuttsPerHole} putts / hoyo
            </span>
          </div>
        </section>

        {/* Grid: Rendimiento por Par de Hoyo + Distribución de Resultados */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Media de golpes por Par 3, Par 4 y Par 5 */}
          <section className="card-luxury p-6 shadow-xs transition-colors">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-[var(--theme-accent)]" />
              <h3 className="text-lg font-bold text-[var(--theme-text-primary)]">
                Rendimiento por Par de Hoyo
              </h3>
            </div>
            <p className="mt-1 text-xs text-[var(--theme-text-secondary)] font-normal">
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
                    className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 text-center transition-colors"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                      {item.label}
                    </span>
                    <p className="mt-2 text-3xl font-metric text-[var(--theme-text-primary)] font-bold">
                      {item.avg.toFixed(2)}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-[var(--theme-surface)] border border-[var(--theme-border)] px-2.5 py-0.5 text-xs font-bold text-[var(--theme-accent)]">
                      {diffText} vs Par
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Distribución de Golpes (Eagles, Birdies, Pares, Bogeys, Doble+) */}
          <section className="card-luxury p-6 shadow-xs transition-colors">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-[var(--theme-accent)]" />
              <h3 className="text-lg font-bold text-[var(--theme-text-primary)]">
                Distribución de Resultados por Hoyo
              </h3>
            </div>
            <p className="mt-1 text-xs text-[var(--theme-text-secondary)] font-normal">
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
                  bar: isDark ? 'bg-[#E6D4A7]' : 'bg-[#A98A55]',
                },
                {
                  label: 'Pares (E)',
                  count: stats.distribution.pars,
                  bar: 'bg-emerald-600',
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
                    <div className="flex justify-between text-xs font-semibold text-[var(--theme-text-primary)]">
                      <span>{row.label}</span>
                      <span className="text-[var(--theme-text-secondary)]">
                        {row.count} hoyos ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)]">
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
        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-xs transition-colors">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-[var(--theme-accent)]" />
            <h3 className="text-lg font-bold text-[var(--theme-text-primary)]">
              Evolución de Hándicap WHS
            </h3>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {DEMO_HANDICAP_HISTORY.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 transition-colors"
              >
                <div>
                  <span className="text-xs font-semibold text-[var(--theme-text-secondary)]">
                    {entry.effectiveDate}
                  </span>
                  <p className="mt-0.5 text-sm font-bold text-[var(--theme-text-primary)]">
                    {entry.reason}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[var(--theme-text-secondary)] line-through">
                    {entry.previousHandicap}
                  </span>
                  <p className="flex items-center gap-1 text-lg font-metric font-semibold text-[var(--theme-accent)]">
                    <Activity className="h-4 w-4" />
                    {entry.newHandicap}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
  );
}
