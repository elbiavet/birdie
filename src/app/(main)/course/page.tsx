'use client';

import React, { useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/components/providers/LanguageProvider';
import { HoleDiagramView } from '@/components/modules/course/HoleDiagramView';
import {
  GOLF_API_COURSES_CATALOG,
  getCourseById,
  calculateCourseNineTotals,
  type GolfApiCourse,
  type GolfApiHole,
} from '@/lib/golf-api';
import {
  MapPin,
  Compass,
  ChevronLeft,
  ChevronRight,
  Flag,
  ShieldAlert,
  Waves,
  CornerDownRight,
} from 'lucide-react';

export default function CourseTourPage() {
  const { club } = useClub();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const home = getCourseById(club.defaultCourseExternalId);
    return home?.id ?? GOLF_API_COURSES_CATALOG[0].id;
  });

  const course: GolfApiCourse = useMemo(() => {
    return getCourseById(selectedCourseId) ?? GOLF_API_COURSES_CATALOG[0];
  }, [selectedCourseId]);

  const [activeHoleNumber, setActiveHoleNumber] = useState<number>(1);
  const [activeTeeBar, setActiveTeeBar] = useState<'white' | 'yellow' | 'blue' | 'red'>('yellow');

  const activeHole: GolfApiHole | null = useMemo(() => {
    if (!course || !course.holes) return null;
    return course.holes.find((h) => h.holeNumber === activeHoleNumber) ?? course.holes[0] ?? null;
  }, [course, activeHoleNumber]);

  const nineTotals = useMemo(() => {
    if (!course || !course.holes) return null;
    return calculateCourseNineTotals(course.holes, activeTeeBar);
  }, [course, activeTeeBar]);

  const toYards = (meters: number) => Math.round(meters * 1.09361);

  return (
    <div className="space-y-6">
      {/* Banner de Lujo Principal */}
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
                <Compass className="h-3.5 w-3.5" />
                {t('course.guideSubtitle')}
              </span>
              <span
                style={{
                  backgroundColor: isDark ? 'rgba(42, 36, 20, 0.7)' : 'rgba(255, 255, 255, 0.6)',
                  borderColor: isDark ? 'rgba(201, 173, 116, 0.25)' : 'rgba(197, 160, 89, 0.35)',
                  color: isDark ? '#D5C7A5' : '#42584A',
                }}
                className="rounded-full border px-3 py-1 text-xs font-semibold"
              >
                {course.holesCount} {t('common.holes')} · {t('common.par')} {course.parTotal}
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {t('course.title')}
            </h1>
            <p className="text-sm font-normal opacity-90">
              {course.name} · {course.clubName} ({course.city}, {course.country})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setActiveHoleNumber(1);
              }}
              aria-label="Seleccionar campo"
              style={{
                backgroundColor: isDark ? '#19191E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(197, 160, 89, 0.4)',
                color: isDark ? '#E4D3AC' : '#0A3A2A',
              }}
              className="rounded-xl border px-3 py-2 text-xs font-medium shadow-xs focus:outline-none"
            >
              {GOLF_API_COURSES_CATALOG.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.holesCount}H - Par {c.parTotal})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Selector Rápido de Hoyos (1..18) */}
      <section className="rounded-2xl border border-[var(--border-luxury)] bg-[var(--card-bg)] p-3 shadow-md">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
          {course.holes.map((h) => {
            const isActive = h.holeNumber === activeHoleNumber;
            return (
              <button
                key={h.holeNumber}
                type="button"
                onClick={() => setActiveHoleNumber(h.holeNumber)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-11 h-13 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-[#D4BA80] via-[#E6D4A7] to-[#BA9C61] border-[#DFCB9E] text-stone-900 shadow-md font-bold scale-105'
                    : 'border-transparent text-[var(--gold-meta)] hover:text-[var(--gold-title)] hover:bg-black/10'
                }`}
                aria-label={`${t('course.selectHole')} ${h.holeNumber}`}
              >
                <span className="text-xs">H{h.holeNumber}</span>
                <span className={`text-[10px] ${isActive ? 'text-stone-900 font-semibold' : 'text-stone-500'}`}>
                  P{h.par}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Grid Principal: Trazado Técnico y Ficha Técnica Detallada */}
      {activeHole && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Diagrama Técnico Vectorial / Fotografía */}
          <div className="lg:col-span-6 xl:col-span-5">
            <HoleDiagramView
              hole={activeHole}
              clubName={course.clubName}
              courseName={course.name}
            />
          </div>

          {/* Columna Derecha: Ficha Técnica y Métricas del Hoyo */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-5">
            {/* Cabecera del Hoyo Activo con navegación previa/siguiente */}
            <div className="rounded-2xl border border-[var(--border-luxury)] bg-[var(--card-bg)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-luxury)]">
                <div>
                  <h2 className="text-xl font-bold text-[var(--gold-title)] flex items-center gap-2">
                    <Flag className="w-5 h-5 text-[var(--gold-accent)]" />
                    {t('common.hole')} {activeHole.holeNumber}
                  </h2>
                  <p className="text-xs text-[var(--gold-meta)] mt-0.5">
                    {t('common.par')} {activeHole.par} · {t('common.hcp')} {activeHole.strokeIndex} ({t('common.strokeIndex')})
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveHoleNumber((prev) => (prev > 1 ? prev - 1 : course.holesCount))}
                    className="p-2 rounded-xl border border-[var(--border-luxury)] text-[var(--gold-meta)] hover:text-[var(--gold-title)] hover:bg-black/10 transition-colors"
                    aria-label={t('common.previous')}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold px-2 text-[var(--gold-title)]">
                    {activeHole.holeNumber} / {course.holesCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveHoleNumber((prev) => (prev < course.holesCount ? prev + 1 : 1))}
                    className="p-2 rounded-xl border border-[var(--border-luxury)] text-[var(--gold-meta)] hover:text-[var(--gold-title)] hover:bg-black/10 transition-colors"
                    aria-label={t('common.next')}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Ficha de Distancias por Barra Oficial */}
              <div>
                <h3 className="text-xs font-bold text-[var(--gold-title)] uppercase tracking-wider mb-2.5">
                  {t('course.distancesTitle')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Blancas */}
                  <div className="p-3 rounded-xl border border-white/20 bg-white/5 flex flex-col items-center text-center">
                    <span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-400 mb-1" />
                    <span className="text-[11px] font-semibold text-slate-200">{t('course.whiteTees')}</span>
                    <span className="text-base font-bold text-white mt-0.5">{activeHole.distanceWhiteMeters} {t('common.meters')}</span>
                    <span className="text-[10px] text-slate-400">{toYards(activeHole.distanceWhiteMeters)} {t('common.yards')}</span>
                  </div>

                  {/* Amarillas */}
                  <div className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex flex-col items-center text-center">
                    <span className="w-3 h-3 rounded-full bg-yellow-400 border border-yellow-600 mb-1" />
                    <span className="text-[11px] font-semibold text-yellow-300">{t('course.yellowTees')}</span>
                    <span className="text-base font-bold text-yellow-100 mt-0.5">{activeHole.distanceYellowMeters} {t('common.meters')}</span>
                    <span className="text-[10px] text-yellow-400/80">{toYards(activeHole.distanceYellowMeters)} {t('common.yards')}</span>
                  </div>

                  {/* Azules */}
                  <div className="p-3 rounded-xl border border-sky-500/30 bg-sky-500/10 flex flex-col items-center text-center">
                    <span className="w-3 h-3 rounded-full bg-sky-400 border border-sky-600 mb-1" />
                    <span className="text-[11px] font-semibold text-sky-300">{t('course.blueTees')}</span>
                    <span className="text-base font-bold text-sky-100 mt-0.5">{activeHole.distanceBlueMeters} {t('common.meters')}</span>
                    <span className="text-[10px] text-sky-400/80">{toYards(activeHole.distanceBlueMeters)} {t('common.yards')}</span>
                  </div>

                  {/* Rojas */}
                  <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 flex flex-col items-center text-center">
                    <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-700 mb-1" />
                    <span className="text-[11px] font-semibold text-rose-300">{t('course.redTees')}</span>
                    <span className="text-base font-bold text-rose-100 mt-0.5">{activeHole.distanceRedMeters} {t('common.meters')}</span>
                    <span className="text-[10px] text-rose-400/80">{toYards(activeHole.distanceRedMeters)} {t('common.yards')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Coordenadas GPS Oficiales del Hoyo */}
            <div className="rounded-2xl border border-[var(--border-luxury)] bg-[var(--card-bg)] p-5 shadow-sm">
              <h3 className="text-xs font-bold text-[var(--gold-title)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[var(--gold-accent)]" />
                {t('course.gpsCoordsTitle')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-black/10 border border-[var(--border-luxury)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--gold-meta)]">{t('course.teeBox')}</span>
                  <p className="font-mono text-xs text-[var(--gold-title)] font-semibold">
                    {activeHole.teeLat.toFixed(5)}, {activeHole.teeLng.toFixed(5)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-black/10 border border-[var(--border-luxury)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--gold-meta)]">{t('course.greenCenter')}</span>
                  <p className="font-mono text-xs text-emerald-400 font-semibold">
                    {activeHole.greenCenterLat.toFixed(5)}, {activeHole.greenCenterLng.toFixed(5)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-black/10 border border-[var(--border-luxury)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--gold-meta)]">{t('course.greenFront')}</span>
                  <p className="font-mono text-xs text-[var(--gold-title)]">
                    {activeHole.greenFrontLat.toFixed(5)}, {activeHole.greenFrontLng.toFixed(5)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-black/10 border border-[var(--border-luxury)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--gold-meta)]">{t('course.greenBack')}</span>
                  <p className="font-mono text-xs text-[var(--gold-title)]">
                    {activeHole.greenBackLat.toFixed(5)}, {activeHole.greenBackLng.toFixed(5)}
                  </p>
                </div>
              </div>
            </div>

            {/* Obstáculos y Puntos de Interés Registrados */}
            <div className="rounded-2xl border border-[var(--border-luxury)] bg-[var(--card-bg)] p-5 shadow-sm">
              <h3 className="text-xs font-bold text-[var(--gold-title)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-[var(--gold-accent)]" />
                {t('course.obstaclesTitle')}
              </h3>
              {activeHole.pois.length > 0 ? (
                <div className="space-y-2">
                  {activeHole.pois.map((poi) => (
                    <div
                      key={poi.id}
                      className="p-2.5 rounded-xl bg-black/10 border border-[var(--border-luxury)] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {poi.poiType === 'water_hazard' && <Waves className="w-4 h-4 text-sky-400" />}
                        {poi.poiType === 'bunker' && <span className="w-3.5 h-3.5 rounded-full bg-[#E3C896] inline-block" />}
                        {poi.poiType === 'dogleg' && <CornerDownRight className="w-4 h-4 text-amber-400" />}
                        {poi.poiType === 'green_center' && <Flag className="w-4 h-4 text-emerald-400" />}
                        <span className="font-medium text-[var(--gold-title)]">{poi.label}</span>
                      </div>
                      <span className="font-mono text-[11px] text-[var(--gold-meta)]">
                        {poi.lat.toFixed(5)}, {poi.lng.toFixed(5)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--gold-meta)] italic">
                  {t('course.noObstacles')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabla Resumen de Métricas del Campo (Ida, Vuelta y Total) */}
      {nineTotals && (
        <section className="rounded-2xl border border-[var(--border-luxury)] bg-[var(--card-bg)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-[var(--gold-title)]">
                {t('course.roundSummaryTitle')}
              </h3>
              <p className="text-xs text-[var(--gold-meta)]">
                {t('course.roundSummarySubtitle')} {course.name}
              </p>
            </div>

            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-full border border-[var(--border-luxury)] text-xs">
              <span className="px-2 text-[10px] font-bold text-[var(--gold-meta)] uppercase">{t('course.teeBar')}</span>
              {(['white', 'yellow', 'blue', 'red'] as const).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setActiveTeeBar(color)}
                  className={`px-2.5 py-0.5 rounded-full capitalize text-xs font-semibold transition-all ${
                    activeTeeBar === color
                      ? 'bg-[var(--gold-accent)] text-stone-900 shadow-xs'
                      : 'text-[var(--gold-meta)] hover:text-white'
                  }`}
                >
                  {color === 'white' && t('course.whiteTees')}
                  {color === 'yellow' && t('course.yellowTees')}
                  {color === 'blue' && t('course.blueTees')}
                  {color === 'red' && t('course.redTees')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-[var(--border-luxury)] bg-black/10 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold-meta)]">
                {t('course.outNine')}
              </span>
              <p className="text-xl font-bold text-[var(--gold-title)] mt-1">{t('common.par')} {nineTotals.outPar}</p>
              <p className="text-xs text-[var(--gold-meta)] mt-0.5">
                {nineTotals.outMeters} {t('common.meters')} · {toYards(nineTotals.outMeters)} {t('common.yards')}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-luxury)] bg-black/10 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold-meta)]">
                {t('course.inNine')}
              </span>
              <p className="text-xl font-bold text-[var(--gold-title)] mt-1">{t('common.par')} {nineTotals.inPar}</p>
              <p className="text-xs text-[var(--gold-meta)] mt-0.5">
                {nineTotals.inMeters} {t('common.meters')} · {toYards(nineTotals.inMeters)} {t('common.yards')}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--gold-accent)]/40 bg-[var(--gold-accent)]/10 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold-title)]">
                {t('course.totalCourse')}
              </span>
              <p className="text-xl font-bold text-[var(--gold-title)] mt-1">{t('common.par')} {nineTotals.totalPar}</p>
              <p className="text-xs text-[var(--gold-title)] font-semibold mt-0.5">
                {nineTotals.totalMeters} {t('common.meters')} · {toYards(nineTotals.totalMeters)} {t('common.yards')}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
