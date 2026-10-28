'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useClub } from '@/components/providers/ClubProvider';
import { HoleGpsPanel } from '@/components/modules/scorecard/HoleGpsPanel';
import {
  GOLF_API_COURSES_CATALOG,
  getCourseById,
  type GolfApiCourse,
} from '@/lib/golf-api';
import {
  calculateHoleStablefordPoints,
  calculateStrokesReceivedOnHole,
  summarizeRoundScorecard,
  type HoleScoreInput,
} from '@/lib/scoring/engine';
import {
  flushPendingScoresToSupabase,
  getOfflineRoundScores,
  getSyncQueueState,
  recordHoleScoreOfflineFirst,
} from '@/lib/offline-sync';
import { calculatePlayingHandicap } from '@/lib/supabase/client';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Database,
  Flag,
  Minus,
  Plus,
  Trophy,
} from 'lucide-react';

const ACTIVE_ROUND_ID = 'round-active-birdie-2026';

export default function ScorecardAndGpsPage() {
  const { club, profile: currentUser } = useClub();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const home = getCourseById(club.defaultCourseExternalId);
    return home?.id ?? GOLF_API_COURSES_CATALOG[0].id;
  });

  const course: GolfApiCourse = useMemo(
    () => getCourseById(selectedCourseId) ?? GOLF_API_COURSES_CATALOG[0],
    [selectedCourseId]
  );

  const [selectedTeeId] = useState<string>(
    () => course.tees[1]?.id ?? course.tees[0].id
  );

  const selectedTee = useMemo(
    () => course.tees.find((t) => t.id === selectedTeeId) ?? course.tees[0],
    [course, selectedTeeId]
  );

  const playingHandicap = useMemo(
    () =>
      calculatePlayingHandicap({
        handicapIndex: currentUser.handicapIndex,
        slopeRating: selectedTee.slopeRating,
        courseRating: selectedTee.courseRating,
        par: course.parTotal,
      }),
    [currentUser.handicapIndex, selectedTee, course.parTotal]
  );

  const [activeHoleNumber, setActiveHoleNumber] = useState<number>(1);
  const [roundHolesMode, setRoundHolesMode] = useState<9 | 18>(course.holesCount);
  const activeHole = useMemo(
    () =>
      course.holes.find((h) => h.holeNumber === activeHoleNumber) ?? course.holes[0],
    [course.holes, activeHoleNumber]
  );

  // Estado del formulario del hoyo activo
  const [strokes, setStrokes] = useState<number>(activeHole.par);
  const [putts, setPutts] = useState<number>(2);
  const [fairwayHit, setFairwayHit] = useState<boolean>(true);
  const [greenInRegulation, setGreenInRegulation] = useState<boolean>(true);
  const [sandSave, setSandSave] = useState<boolean>(false);
  const [penaltyStrokes, setPenaltyStrokes] = useState<number>(0);

  // Hoyo a hoyo almacenado en SQLite
  const [recordedScores, setRecordedScores] = useState<HoleScoreInput[]>([]);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const loadRoundFromOfflineDb = useCallback(async () => {
    const stored = await getOfflineRoundScores(ACTIVE_ROUND_ID, currentUser.id);
    const mapped: HoleScoreInput[] = stored.map((s) => ({
      holeNumber: s.holeNumber,
      strokes: s.strokes,
      putts: s.putts,
      fairwayHit: s.fairwayHit,
      greenInRegulation: s.greenInRegulation,
      sandSave: s.sandSave ?? null,
      penaltyStrokes: s.penaltyStrokes ?? 0,
    }));
    setRecordedScores(mapped);

    const queue = await getSyncQueueState();
    setPendingQueueCount(queue.pendingCount);
  }, [currentUser.id]);

  useEffect(() => {
    loadRoundFromOfflineDb();
  }, [loadRoundFromOfflineDb]);

  // Al cambiar de hoyo, cargar valores guardados o valores por defecto del par del hoyo
  useEffect(() => {
    const existing = recordedScores.find((s) => s.holeNumber === activeHole.holeNumber);
    if (existing) {
      setStrokes(existing.strokes);
      setPutts(existing.putts);
      setFairwayHit(existing.fairwayHit ?? true);
      setGreenInRegulation(existing.greenInRegulation);
      setSandSave(Boolean(existing.sandSave));
      setPenaltyStrokes(existing.penaltyStrokes);
    } else {
      setStrokes(activeHole.par);
      setPutts(2);
      setFairwayHit(true);
      setGreenInRegulation(true);
      setSandSave(false);
      setPenaltyStrokes(0);
    }
  }, [activeHole, recordedScores]);

  const activeHoleStrokesReceived = useMemo(
    () =>
      calculateStrokesReceivedOnHole(
        playingHandicap,
        activeHole.strokeIndex,
        roundHolesMode
      ),
    [playingHandicap, activeHole.strokeIndex, roundHolesMode]
  );

  const activeHoleStableford = useMemo(
    () =>
      calculateHoleStablefordPoints(
        strokes,
        activeHole.par,
        activeHoleStrokesReceived
      ),
    [strokes, activeHole.par, activeHoleStrokesReceived]
  );

  const effectiveHolesForRound = useMemo(
    () =>
      roundHolesMode === 9
        ? course.holes.filter((h) => h.holeNumber <= 9)
        : course.holes,
    [course.holes, roundHolesMode]
  );

  const roundSummary = useMemo(
    () =>
      summarizeRoundScorecard(
        effectiveHolesForRound,
        recordedScores,
        playingHandicap
      ),
    [effectiveHolesForRound, recordedScores, playingHandicap]
  );

  const handleSaveHoleOffline = async () => {
    await recordHoleScoreOfflineFirst({
      roundId: ACTIVE_ROUND_ID,
      playerId: currentUser.id,
      holeNumber: activeHole.holeNumber,
      par: activeHole.par,
      strokeIndex: activeHole.strokeIndex,
      playingHandicap,
      holesCount: roundHolesMode,
      strokes,
      putts,
      fairwayHit: activeHole.par >= 4 ? fairwayHit : null,
      greenInRegulation,
      sandSave,
      penaltyStrokes,
    });

    await loadRoundFromOfflineDb();
    setStatusBanner(
      `Hoyo ${activeHole.holeNumber} guardado en SQLite local [pendiente de envío a Supabase] (${strokes} golpes · ${activeHoleStableford} pts Stableford).`
    );

    if (activeHoleNumber < roundHolesMode) {
      setActiveHoleNumber((prev) => prev + 1);
    }
  };

  const handleFlushQueue = async () => {
    const res = await flushPendingScoresToSupabase();
    await loadRoundFromOfflineDb();
    if (res.status === 'synced') {
      setStatusBanner(
        res.attemptedCount === 0
          ? 'No hay golpes pendientes de sincronizar en la cola SQLite.'
          : `Sincronización confirmada en servidor Supabase: ${res.syncedCount}/${res.attemptedCount} hoyos sincronizados.`
      );
    } else {
      setStatusBanner(
        `${res.reason ?? 'Sincronización incompleta.'} (${res.remainingPendingCount} hoyo[s] siguen en estado 'pending' en SQLite local).`
      );
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Cabecera de la Ronda y Estado Offline SQLite */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <Database className="h-3.5 w-3.5" />
                  SQLite Offline-First Activo
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Playing HCP: {playingHandicap} ({selectedTee.name})
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Marcador Digital y Telémetro GPS
              </h2>
              <p className="text-sm text-slate-600">
                {course.name} · Par {course.parTotal} · Jugador: {currentUser.fullName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={roundHolesMode}
                onChange={(e) => {
                  const nextMode: 9 | 18 = Number(e.target.value) === 9 ? 9 : 18;
                  setRoundHolesMode(nextMode);
                  if (activeHoleNumber > nextMode) {
                    setActiveHoleNumber(1);
                  }
                }}
                aria-label="Modalidad de hoyos de la ronda"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value={18}>Vuelta 18 Hoyos</option>
                <option value={9}>Vuelta 9 Hoyos</option>
              </select>

              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setActiveHoleNumber(1);
                }}
                aria-label="Seleccionar recorrido"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                {GOLF_API_COURSES_CATALOG.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleFlushQueue}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <CloudUpload className="h-4 w-4 text-emerald-400" />
                Sincronizar Cola ({pendingQueueCount})
              </button>
            </div>
          </div>

          {statusBanner && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{statusBanner}</span>
            </div>
          )}

          {/* Selector horizontal de los 18 Hoyos */}
          <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-2">
            {course.holes.map((h) => {
              const recorded = recordedScores.find(
                (s) => s.holeNumber === h.holeNumber
              );
              const isCurrent = h.holeNumber === activeHoleNumber;

              return (
                <button
                  key={h.holeNumber}
                  type="button"
                  onClick={() => setActiveHoleNumber(h.holeNumber)}
                  className={`flex h-11 min-w-[44px] flex-col items-center justify-center rounded-xl border text-xs font-bold transition ${
                    isCurrent
                      ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                      : recorded
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>H{h.holeNumber}</span>
                  <span className="text-[10px] font-normal opacity-80">
                    {recorded ? `${recorded.strokes}g` : `P${h.par}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Grid Central: Panel de Anotación del Hoyo Activo + Telémetro GPS */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Anotador del Hoyo Activo */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-club-primary text-lg font-black text-white">
                  {activeHole.holeNumber}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Hoyo {activeHole.holeNumber} · Par {activeHole.par}
                  </h3>
                  <p className="text-xs text-slate-500">
                    HCP (Stroke Index) {activeHole.strokeIndex} ·{' '}
                    {activeHole.distanceYellowMeters} m · Recibes{' '}
                    <span className="font-bold text-emerald-700">
                      {activeHoleStrokesReceived} golpe(s)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={activeHoleNumber <= 1}
                  onClick={() => setActiveHoleNumber((n) => Math.max(1, n - 1))}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
                  aria-label="Hoyo anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={activeHoleNumber >= 18}
                  onClick={() => setActiveHoleNumber((n) => Math.min(18, n + 1))}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
                  aria-label="Hoyo siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Controles de Golpes Brutos y Putts */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Golpes Totales
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                    {activeHoleStableford} pts Stableford
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStrokes((s) => Math.max(1, s - 1))}
                    aria-label="Restar golpe"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 shadow-sm"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span
                    data-testid="active-hole-strokes"
                    className="text-3xl font-black text-slate-900"
                  >
                    {strokes}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStrokes((s) => Math.min(15, s + 1))}
                    aria-label="Sumar golpe"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Putts en Green
                  </span>
                  <span className="text-xs text-slate-500">Estadística Putting</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPutts((p) => Math.max(0, p - 1))}
                    aria-label="Restar putt"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 shadow-sm"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-3xl font-black text-slate-900">{putts}</span>
                  <button
                    type="button"
                    onClick={() => setPutts((p) => Math.min(10, p + 1))}
                    aria-label="Sumar putt"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Métricas de Precisión: FIR, GIR, Sand Save y Penalidades */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {activeHole.par >= 4 && (
                <button
                  type="button"
                  onClick={() => setFairwayHit((v) => !v)}
                  className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${
                    fairwayHit
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <span className="block text-[10px] uppercase text-slate-400">
                    Calle (FIR)
                  </span>
                  <span className="mt-1 block font-bold">
                    {fairwayHit ? 'Sí · En Calle' : 'No · Rough'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setGreenInRegulation((v) => !v)}
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${
                  greenInRegulation
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span className="block text-[10px] uppercase text-slate-400">
                  Green (GIR)
                </span>
                <span className="mt-1 block font-bold">
                  {greenInRegulation ? 'Sí · En Regulación' : 'No'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSandSave((v) => !v)}
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${
                  sandSave
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span className="block text-[10px] uppercase text-slate-400">
                  Bunker Save
                </span>
                <span className="mt-1 block font-bold">
                  {sandSave ? 'Sí · Salvado' : 'Sin Bunker'}
                </span>
              </button>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <span className="block text-[10px] font-semibold uppercase text-slate-400">
                  Penalidades
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPenaltyStrokes((p) => Math.max(0, p - 1))}
                    className="rounded bg-slate-100 px-2 font-bold"
                  >
                    -
                  </button>
                  <span className="font-bold text-rose-600">{penaltyStrokes}</span>
                  <button
                    type="button"
                    onClick={() => setPenaltyStrokes((p) => p + 1)}
                    className="rounded bg-slate-100 px-2 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleSaveHoleOffline}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
              >
                <Flag className="h-4 w-4" />
                Guardar Hoyo {activeHole.holeNumber} en SQLite Offline
              </button>
            </div>
          </section>

          {/* Telémetro GPS en vivo para el hoyo activo */}
          <div className="lg:col-span-5">
            <HoleGpsPanel hole={activeHole} />
          </div>
        </div>

        {/* Resumen Acumulado de la Tarjeta (Ida / Vuelta / Total Stableford) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900">
                Resumen de Tarjeta en Vivo ({roundSummary.holesPlayed}/18 hoyos anotados)
              </h3>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-xs text-slate-500">Golpes Brutos</span>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {roundSummary.totalGrossStrokes}
              </p>
              <span className="text-[11px] text-slate-500">
                Ida {roundSummary.outGrossStrokes} · Vta {roundSummary.inGrossStrokes}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-xs text-slate-500">Golpes Netos</span>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {roundSummary.totalNetStrokes}
              </p>
              <span className="text-[11px] text-slate-500">
                Con HCP {playingHandicap}
              </span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
              <span className="text-xs font-semibold text-emerald-800">
                Puntos Stableford
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-900">
                {roundSummary.totalStablefordPoints} pts
              </p>
              <span className="text-[11px] text-emerald-700">
                Ida {roundSummary.outStablefordPoints} · Vta{' '}
                {roundSummary.inStablefordPoints}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-xs text-slate-500">Calles (FIR %)</span>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {roundSummary.fairwayHitPercentage}%
              </p>
              <span className="text-[11px] text-slate-500">
                {roundSummary.fairwaysHitCount}/{roundSummary.fairwaysEligibleCount} calles
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-xs text-slate-500">Greenes (GIR %)</span>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {roundSummary.girPercentage}%
              </p>
              <span className="text-[11px] text-slate-500">
                {roundSummary.greensInRegulationCount}/{roundSummary.holesPlayed} hoyos
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-xs text-slate-500">Putts Totales</span>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {roundSummary.totalPutts}
              </p>
              <span className="text-[11px] text-slate-500">
                Penalidades: {roundSummary.penaltyStrokesTotal}
              </span>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
