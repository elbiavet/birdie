'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTheme } from '@/components/providers/ThemeProvider';
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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
        handicapIndex: currentUser?.handicapIndex ?? 0,
        slopeRating: selectedTee.slopeRating,
        courseRating: selectedTee.courseRating,
        par: course.parTotal,
      }),
    [currentUser?.handicapIndex, selectedTee, course.parTotal]
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

  const currentUserId = currentUser?.id ?? 'guest-player';

  const loadRoundFromOfflineDb = useCallback(async () => {
    const stored = await getOfflineRoundScores(ACTIVE_ROUND_ID, currentUserId);
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
  }, [currentUserId]);

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
      playerId: currentUserId,
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
      `Hoyo ${activeHole.holeNumber} guardado (${strokes} golpes · ${activeHoleStableford} pts Stableford).`
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
          ? 'No hay golpes pendientes de sincronizar.'
          : `Sincronización completada: ${res.syncedCount}/${res.attemptedCount} hoyos confirmados.`
      );
    } else {
      setStatusBanner(
        `${res.reason ?? 'Sincronización pendiente.'} (${res.remainingPendingCount} hoyo[s] guardados localmente).`
      );
    }
  };

  return (
    <div className="space-y-6">
        {/* Cabecera de la Ronda y Estado de Tarjeta */}
        <section className="hero-banner-luxury p-6 shadow-sm relative overflow-hidden transition-all duration-200">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  style={{
                    backgroundColor: isDark ? 'rgba(42, 36, 20, 0.85)' : 'rgba(255, 255, 255, 0.7)',
                    borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(197, 160, 89, 0.45)',
                    color: isDark ? '#E4D3AC' : '#0A3A2A',
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-xs"
                >
                  <Database className="h-3.5 w-3.5" />
                  Tarjeta Digital Activa
                </span>
                <span
                  style={{
                    backgroundColor: isDark ? 'rgba(42, 36, 20, 0.7)' : 'rgba(255, 255, 255, 0.6)',
                    borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(197, 160, 89, 0.35)',
                    color: isDark ? '#D5C7A5' : '#42584A',
                  }}
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                >
                  Playing HCP: {playingHandicap} ({selectedTee.name})
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-bold">
                Marcador Digital y Telémetro GPS
              </h2>
              <p className="text-sm font-normal opacity-90">
                {course.name} · Par {course.parTotal} · Jugador: {currentUser?.fullName ?? 'Invitado'}
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
                style={{
                  backgroundColor: isDark ? '#19191E' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(197, 160, 89, 0.4)',
                  color: isDark ? '#E4D3AC' : '#0A3A2A',
                }}
                className="rounded-xl border px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {course.holesCount === 18 && (
                  <option value={18}>Vuelta 18 Hoyos</option>
                )}
                <option value={9}>Vuelta 9 Hoyos</option>
              </select>

              <select
                value={selectedCourseId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedCourseId(nextId);
                  const nextCourse = getCourseById(nextId);
                  if (nextCourse && nextCourse.holesCount === 9) {
                    setRoundHolesMode(9);
                  }
                  setActiveHoleNumber(1);
                }}
                aria-label="Seleccionar recorrido"
                style={{
                  backgroundColor: isDark ? '#19191E' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(197, 160, 89, 0.4)',
                  color: isDark ? '#E4D3AC' : '#0A3A2A',
                }}
                className="rounded-xl border px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
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
                className="btn-gold-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <CloudUpload className="h-4 w-4" />
                Sincronizar Tarjeta ({pendingQueueCount})
              </button>
            </div>
          </div>

          {statusBanner && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>{statusBanner}</span>
            </div>
          )}

          {/* Selector horizontal de los 18 Hoyos */}
          <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-2 relative z-10">
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
                  style={
                    isCurrent
                      ? {
                          background: isDark
                            ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                            : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                          borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                          color: '#0B0C10',
                          fontWeight: 700,
                          boxShadow: isDark
                            ? '0 3px 12px rgba(201, 173, 116, 0.26)'
                            : '0 3px 12px rgba(169, 138, 85, 0.2)',
                        }
                      : recorded
                        ? {
                            backgroundColor: isDark ? '#19191E' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(197, 160, 89, 0.4)',
                            color: isDark ? '#E4D3AC' : '#0A3A2A',
                          }
                        : undefined
                  }
                  className={`flex h-11 min-w-[44px] flex-col items-center justify-center rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isCurrent
                      ? 'shadow-xs'
                      : recorded
                        ? 'font-semibold'
                        : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-surface)]'
                  }`}
                >
                  <span>H{h.holeNumber}</span>
                  <span className="text-[10px] font-normal opacity-85">
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
          <section className="card-luxury p-6 shadow-xs lg:col-span-7 transition-colors">
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-4">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    background: isDark
                      ? 'linear-gradient(135deg, #2D271D 0%, #1F1E24 100%)'
                      : 'linear-gradient(135deg, #FAF4E8 0%, #EFE5D0 100%)',
                    color: isDark ? '#E5C365' : '#8C6F32',
                    borderColor: isDark ? 'rgba(201, 173, 116, 0.45)' : 'rgba(169, 138, 85, 0.5)',
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-bold shadow-xs"
                >
                  {activeHole.holeNumber}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--theme-text-primary)]">
                    Hoyo {activeHole.holeNumber} · Par {activeHole.par}
                  </h3>
                  <p className="text-xs text-[var(--theme-text-secondary)] font-normal">
                    HCP (Stroke Index) {activeHole.strokeIndex} ·{' '}
                    {activeHole.distanceYellowMeters} m · Recibes{' '}
                    <span className="font-bold text-[var(--theme-accent)]">
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
                  className="rounded-lg border border-[var(--theme-border)] p-2 text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] bg-[var(--theme-surface-subtle)] disabled:opacity-40 cursor-pointer"
                  aria-label="Hoyo anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={activeHoleNumber >= course.holesCount}
                  onClick={() => setActiveHoleNumber((n) => Math.min(course.holesCount, n + 1))}
                  className="rounded-lg border border-[var(--theme-border)] p-2 text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] bg-[var(--theme-surface-subtle)] disabled:opacity-40 cursor-pointer"
                  aria-label="Hoyo siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Controles de Golpes Brutos y Putts */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                    Golpes Totales
                  </span>
                  <span className="rounded-full bg-[var(--theme-surface)] border border-[var(--theme-border)] px-2.5 py-0.5 text-xs font-bold text-[var(--theme-accent)]">
                    {activeHoleStableford} pts Stableford
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStrokes((s) => Math.max(1, s - 1))}
                    aria-label="Restar golpe"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-primary)] shadow-xs hover:border-[var(--theme-accent)] cursor-pointer"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span
                    data-testid="active-hole-strokes"
                    className="text-3xl font-metric font-semibold text-[var(--theme-text-primary)]"
                  >
                    {strokes}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStrokes((s) => Math.min(15, s + 1))}
                    aria-label="Sumar golpe"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-primary)] shadow-xs hover:border-[var(--theme-accent)] cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                    Putts en Green
                  </span>
                  <span className="text-xs text-[var(--theme-text-secondary)] font-normal">Estadística Putting</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPutts((p) => Math.max(0, p - 1))}
                    aria-label="Restar putt"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-primary)] shadow-xs hover:border-[var(--theme-accent)] cursor-pointer"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-3xl font-metric font-semibold text-[var(--theme-text-primary)]">{putts}</span>
                  <button
                    type="button"
                    onClick={() => setPutts((p) => Math.min(10, p + 1))}
                    aria-label="Sumar putt"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-primary)] shadow-xs hover:border-[var(--theme-accent)] cursor-pointer"
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
                  className={`rounded-xl border p-3 text-left text-xs font-semibold transition cursor-pointer ${
                    fairwayHit
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)]'
                      : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-secondary)]'
                  }`}
                >
                  <span className="block text-[10px] uppercase opacity-75">
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
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition cursor-pointer ${
                  greenInRegulation
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)]'
                    : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-secondary)]'
                }`}
              >
                <span className="block text-[10px] uppercase opacity-75">
                  Green (GIR)
                </span>
                <span className="mt-1 block font-bold">
                  {greenInRegulation ? 'Sí · En Regulación' : 'No'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSandSave((v) => !v)}
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition cursor-pointer ${
                  sandSave
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                    : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-secondary)]'
                }`}
              >
                <span className="block text-[10px] uppercase opacity-75">
                  Bunker Save
                </span>
                <span className="mt-1 block font-bold">
                  {sandSave ? 'Sí · Salvado' : 'Sin Bunker'}
                </span>
              </button>

              <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 text-xs">
                <span className="block text-[10px] font-semibold uppercase opacity-75">
                  Penalidades
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPenaltyStrokes((p) => Math.max(0, p - 1))}
                    className="rounded bg-[var(--theme-surface-subtle)] px-2 font-bold text-[var(--theme-text-primary)] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-bold text-rose-500">{penaltyStrokes}</span>
                  <button
                    type="button"
                    onClick={() => setPenaltyStrokes((p) => p + 1)}
                    className="rounded bg-[var(--theme-surface-subtle)] px-2 font-bold text-[var(--theme-text-primary)] cursor-pointer"
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
                className="btn-gold-gradient flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-xs transition cursor-pointer"
              >
                <Flag className="h-4 w-4" />
                Guardar Hoyo {activeHole.holeNumber}
              </button>
            </div>
          </section>

          {/* Telémetro GPS en vivo para el hoyo activo */}
          <div className="lg:col-span-5">
            <HoleGpsPanel hole={activeHole} />
          </div>
        </div>

        {/* Resumen Acumulado de la Tarjeta (Ida / Vuelta / Total Stableford) */}
        <section className="card-luxury p-6 shadow-xs transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[var(--theme-accent)]" />
              <h3 className="text-lg font-bold text-[var(--theme-text-primary)]">
                Resumen de Tarjeta en Vivo ({roundSummary.holesPlayed}/{roundHolesMode} hoyos anotados)
              </h3>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3.5">
              <span className="text-xs text-[var(--theme-text-secondary)] font-medium">Golpes Brutos</span>
              <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)] font-bold">
                {roundSummary.totalGrossStrokes}
              </p>
              <span className="text-[11px] text-[var(--theme-text-secondary)]">
                {roundHolesMode === 9
                  ? 'Vuelta 9H'
                  : `Ida ${roundSummary.outGrossStrokes} · Vta ${roundSummary.inGrossStrokes}`}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3.5">
              <span className="text-xs text-[var(--theme-text-secondary)] font-medium">Golpes Netos</span>
              <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)] font-bold">
                {roundSummary.totalNetStrokes}
              </p>
              <span className="text-[11px] text-[var(--theme-text-secondary)]">
                Con HCP {playingHandicap}
              </span>
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
              className="rounded-xl border-2 p-3.5"
            >
              <span
                style={{ color: isDark ? '#E6D4A7' : '#8C6F32' }}
                className="text-xs font-bold"
              >
                Puntos Stableford
              </span>
              <p
                style={{ color: isDark ? '#E6D4A7' : '#0A3A2A' }}
                className="mt-1 text-2xl font-metric font-bold"
              >
                {roundSummary.totalStablefordPoints} pts
              </p>
              <span className="text-[11px] opacity-80 font-medium">
                {roundHolesMode === 9
                  ? 'Vuelta 9H'
                  : `Ida ${roundSummary.outStablefordPoints} · Vta ${roundSummary.inStablefordPoints}`}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3.5">
              <span className="text-xs text-[var(--theme-text-secondary)] font-medium">Calles (FIR %)</span>
              <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)]">
                {roundSummary.fairwayHitPercentage}%
              </p>
              <span className="text-[11px] text-[var(--theme-text-secondary)]">
                {roundSummary.fairwaysHitCount}/{roundSummary.fairwaysEligibleCount} calles
              </span>
            </div>

            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3.5">
              <span className="text-xs text-[var(--theme-text-secondary)] font-medium">Greenes (GIR %)</span>
              <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)]">
                {roundSummary.girPercentage}%
              </p>
              <span className="text-[11px] text-[var(--theme-text-secondary)]">
                {roundSummary.greensInRegulationCount}/{roundSummary.holesPlayed} hoyos
              </span>
            </div>

            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3.5">
              <span className="text-xs text-[var(--theme-text-secondary)] font-medium">Putts Totales</span>
              <p className="mt-1 text-2xl font-metric text-[var(--theme-text-primary)]">
                {roundSummary.totalPutts}
              </p>
              <span className="text-[11px] text-[var(--theme-text-secondary)]">
                Penalidades: {roundSummary.penaltyStrokesTotal}
              </span>
            </div>
          </div>
        </section>
      </div>
  );
}
