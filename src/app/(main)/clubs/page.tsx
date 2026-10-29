'use client';

import React, { useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  calculateCourseNineTotals,
  GOLF_API_COURSES_CATALOG,
  searchCourses,
  syncCourseToOfflineCache,
  type GolfApiCourse,
} from '@/lib/golf-api';
import { getCachedCourseData } from '@/lib/capacitor/sqlite';
import { useTheme } from '@/components/providers/ThemeProvider';
import {
  CheckCircle2,
  Compass,
  DownloadCloud,
  Flag,
  Globe,
  MapPin,
  Phone,
  Search,
} from 'lucide-react';

type TeeFilterColor = 'white' | 'yellow' | 'blue' | 'red';

export default function ClubsDirectoryPage() {
  const { club } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const homeCourse = GOLF_API_COURSES_CATALOG.find(
      (c) => c.externalGolfApiId === club.defaultCourseExternalId
    );
    return homeCourse?.id ?? GOLF_API_COURSES_CATALOG[0].id;
  });
  const [selectedTeeColor, setSelectedTeeColor] = useState<TeeFilterColor>('yellow');
  const [cachedCourseIds, setCachedCourseIds] = useState<Record<string, number>>({});
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(GOLF_API_COURSES_CATALOG.map((c) => c.city))),
    []
  );

  const filteredCourses = useMemo(
    () => searchCourses(searchQuery, cityFilter),
    [searchQuery, cityFilter]
  );

  const selectedCourse: GolfApiCourse = useMemo(() => {
    const found = filteredCourses.find((c) => c.id === selectedCourseId);
    return found ?? filteredCourses[0] ?? GOLF_API_COURSES_CATALOG[0];
  }, [filteredCourses, selectedCourseId]);

  const nineTotals = useMemo(
    () => calculateCourseNineTotals(selectedCourse.holes, selectedTeeColor),
    [selectedCourse, selectedTeeColor]
  );

  const handleCacheOffline = async (course: GolfApiCourse) => {
    try {
      const result = await syncCourseToOfflineCache(course.id);
      const verifyCache = await getCachedCourseData(course.id);
      setCachedCourseIds((prev) => ({
        ...prev,
        [course.id]: verifyCache.length || result.cachedHolesCount,
      }));
      setSyncMessage(
        `Recorrido "${course.name}" descargado en SQLite local (${result.cachedHolesCount} hoyos con coordenadas GPS listos sin conexión).`
      );
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? err.message : 'Error al sincronizar el recorrido.'
      );
    }
  };

  const getHoleDistance = (holeNumber: number): number => {
    const hole = selectedCourse.holes.find((h) => h.holeNumber === holeNumber);
    if (!hole) return 0;
    if (selectedTeeColor === 'white') return hole.distanceWhiteMeters;
    if (selectedTeeColor === 'blue') return hole.distanceBlueMeters;
    if (selectedTeeColor === 'red') return hole.distanceRedMeters;
    return hole.distanceYellowMeters;
  };

  const outHoles = selectedCourse.holes.filter((h) => h.holeNumber <= 9);
  const inHoles = selectedCourse.holes.filter((h) => h.holeNumber >= 10);

  return (
    <div className="space-y-6">
        {/* Cabecera y buscador */}
        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-xs transition-colors">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
                <Compass className="h-3.5 w-3.5" />
                Integración Golf API + Caché SQLite Offline
              </span>
              <h2 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)]">
                Directorio de Clubes y Campos
              </h2>
              <p className="text-sm text-[var(--theme-text-secondary)] font-normal">
                Consulta pares, hándicap por hoyo (HCP), Slope/Rating de barras y descarga
                los recorridos para usar el GPS sin cobertura.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCacheOffline(selectedCourse)}
              style={{
                backgroundColor: isDark ? '#D4AF37' : '#0A3A2A',
                color: isDark ? '#08130E' : '#FFFFFF',
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-xs transition hover:opacity-95 cursor-pointer"
            >
              <DownloadCloud className="h-4 w-4" />
              Descargar Recorrido a SQLite Offline
            </button>
          </div>

          {syncMessage && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{syncMessage}</span>
            </div>
          )}

          {/* Filtros de búsqueda */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[var(--theme-text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre de campo, club, ciudad o ID Golf API..."
                aria-label="Buscar campo de golf"
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] py-2.5 pl-10 pr-4 text-sm focus:border-[var(--theme-accent)] focus:outline-none"
              />
            </div>

            <div>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                aria-label="Filtrar por ciudad"
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3.5 py-2.5 text-sm focus:border-[var(--theme-accent)] focus:outline-none"
              >
                <option value="">Todas las ciudades ({cities.length})</option>
                {cities.map((city) => (
                  <option key={city} value={city} className="bg-[var(--theme-surface)]">
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Listado de tarjetas de campos */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {filteredCourses.map((course) => {
            const isSelected = course.id === selectedCourse.id;
            const isClubHome = course.externalGolfApiId === club.defaultCourseExternalId;
            const cachedCount = cachedCourseIds[course.id];

            return (
              <div
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
                style={
                  isSelected
                    ? {
                        backgroundColor: isDark ? '#16382A' : '#E8ECE9',
                        borderColor: isDark ? '#D4AF37' : '#A38332',
                      }
                    : undefined
                }
                className={`cursor-pointer rounded-2xl border p-5 transition ${
                  isSelected
                    ? 'border-2 shadow-xs'
                    : 'border-[var(--theme-border)] bg-[var(--theme-surface)] hover:border-[var(--theme-accent)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                      {course.city} · {course.holesCount} Hoyos · Par {course.parTotal}
                    </span>
                    <h3 className="mt-1 text-base font-bold text-[var(--theme-text-primary)]">
                      {course.name}
                    </h3>
                    <p className="text-xs text-[var(--theme-text-secondary)] font-normal">{course.clubName}</p>
                  </div>
                  {isClubHome && (
                    <span
                      style={{
                        backgroundColor: isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(163, 131, 50, 0.15)',
                        color: isDark ? '#D4AF37' : '#A38332',
                        borderColor: isDark ? '#D4AF37' : '#A38332',
                      }}
                      className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
                    >
                      Sede Activa
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-[var(--theme-text-secondary)] font-normal">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                    <span>{course.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                    <span>{course.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                    <span className="font-mono text-[11px]">
                      ID: {course.externalGolfApiId}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--theme-border)] pt-3">
                  <span className="text-xs font-medium text-[var(--theme-text-secondary)]">
                    {course.tees.length} barras homologadas
                  </span>
                  {cachedCount ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Offline ({cachedCount}h)
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--theme-accent)]">
                      Ver ficha técnica →
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Detalle Técnico del Recorrido Seleccionado */}
        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-xs transition-colors">
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--theme-border)] pb-5 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-[var(--theme-accent)]" />
                <h3 className="text-lg font-bold text-[var(--theme-text-primary)]">
                  Tarjeta Técnica del Recorrido: {selectedCourse.name}
                </h3>
              </div>
              <p className="mt-1 text-xs text-[var(--theme-text-secondary)] font-normal">
                Coordenadas GPS central: {selectedCourse.latitude.toFixed(4)},{' '}
                {selectedCourse.longitude.toFixed(4)} · Par {nineTotals.totalPar} ·{' '}
                {nineTotals.totalMeters} metros
              </p>
            </div>

            {/* Selector de Barra de Salida */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: 'white', label: 'Blancas', dot: 'bg-slate-200' },
                  { key: 'yellow', label: 'Amarillas', dot: 'bg-amber-400' },
                  { key: 'blue', label: 'Azules', dot: 'bg-sky-500' },
                  { key: 'red', label: 'Rojas', dot: 'bg-rose-500' },
                ] as const
              ).map((teeBtn) => (
                <button
                  key={teeBtn.key}
                  type="button"
                  onClick={() => setSelectedTeeColor(teeBtn.key)}
                  style={
                    selectedTeeColor === teeBtn.key
                      ? {
                          backgroundColor: isDark ? '#D4AF37' : '#0A3A2A',
                          color: isDark ? '#08130E' : '#FFFFFF',
                          borderColor: isDark ? '#D4AF37' : '#0A3A2A',
                        }
                      : undefined
                  }
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    selectedTeeColor === teeBtn.key
                      ? 'shadow-xs font-bold'
                      : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${teeBtn.dot}`} />
                  {teeBtn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen de Barras Homologadas (Course Rating & Slope) */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {selectedCourse.tees.map((tee) => (
              <div
                key={tee.id}
                className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-4 py-3 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-[var(--theme-border)]"
                      style={{ backgroundColor: tee.colorHex }}
                    />
                    <span className="text-sm font-bold text-[var(--theme-text-primary)]">{tee.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--theme-text-secondary)] font-normal">
                    Distancia: {tee.totalDistanceMeters} m
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-[var(--theme-text-secondary)]">
                    CR <span className="font-bold text-[var(--theme-text-primary)]">{tee.courseRating}</span>
                  </div>
                  <div className="text-xs font-semibold text-[var(--theme-accent)]">
                    Slope <span className="font-bold">{tee.slopeRating}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla Ida (Hoyos 1 a 9) */}
          <div className="mt-6 overflow-x-auto">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
              Primera Vuelta — IDA (OUT · Hoyos 1 - 9)
            </h4>
            <table className="w-full min-w-[640px] border-collapse text-center text-xs">
              <thead>
                <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)]">
                  <th className="px-3 py-2 text-left font-bold">Hoyo</th>
                  {outHoles.map((h) => (
                    <th key={h.holeNumber} className="px-2 py-2 font-bold">
                      {h.holeNumber}
                    </th>
                  ))}
                  <th
                    style={{
                      backgroundColor: isDark ? '#16382A' : '#0A3A2A',
                      color: isDark ? '#D4AF37' : '#FFFFFF',
                    }}
                    className="px-3 py-2 font-bold"
                  >
                    IDA
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)] text-[var(--theme-text-primary)]">
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-[var(--theme-text-primary)]">
                    Metros ({selectedTeeColor.toUpperCase()})
                  </td>
                  {outHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 font-medium text-[var(--theme-text-secondary)]">
                      {getHoleDistance(h.holeNumber)}
                    </td>
                  ))}
                  <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 font-bold text-[var(--theme-accent)]">
                    {nineTotals.outMeters}m
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-[var(--theme-text-primary)]">Par</td>
                  {outHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 font-bold text-[var(--theme-text-primary)]">
                      {h.par}
                    </td>
                  ))}
                  <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 font-bold text-[var(--theme-accent)]">
                    {nineTotals.outPar}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-[var(--theme-text-primary)]">
                    Hándicap (SI)
                  </td>
                  {outHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 text-[var(--theme-text-secondary)] font-normal">
                      {h.strokeIndex}
                    </td>
                  ))}
                  <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 text-[var(--theme-text-secondary)]">—</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tabla Vuelta (Hoyos 10 a 18) */}
          <div className="mt-6 overflow-x-auto">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
              Segunda Vuelta — VUELTA (IN · Hoyos 10 - 18)
            </h4>
            <table className="w-full min-w-[640px] border-collapse text-center text-xs">
              <thead>
                <tr className="border-b border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)]">
                  <th className="px-3 py-2 text-left font-bold">Hoyo</th>
                  {inHoles.map((h) => (
                    <th key={h.holeNumber} className="px-2 py-2 font-bold">
                      {h.holeNumber}
                    </th>
                  ))}
                  <th
                    style={{
                      backgroundColor: isDark ? '#16382A' : '#0A3A2A',
                      color: isDark ? '#D4AF37' : '#FFFFFF',
                    }}
                    className="px-3 py-2 font-bold"
                  >
                    VUELTA
                  </th>
                  <th
                    style={{
                      backgroundColor: isDark ? '#0F241B' : '#A38332',
                      color: isDark ? '#D4AF37' : '#FFFFFF',
                    }}
                    className="px-3 py-2 font-bold"
                  >
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)] text-[var(--theme-text-primary)]">
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-[var(--theme-text-primary)]">
                    Metros ({selectedTeeColor.toUpperCase()})
                  </td>
                  {inHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 font-medium text-[var(--theme-text-secondary)]">
                      {getHoleDistance(h.holeNumber)}
                    </td>
                  ))}
                  <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 font-bold text-[var(--theme-accent)]">
                    {nineTotals.inMeters}m
                  </td>
                  <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 font-bold text-[var(--theme-text-primary)]">
                    {nineTotals.totalMeters}m
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-[var(--theme-text-primary)]">Par</td>
                  {inHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 font-bold text-[var(--theme-text-primary)]">
                      {h.par}
                    </td>
                  ))}
                  <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 font-bold text-[var(--theme-accent)]">
                    {nineTotals.inPar}
                  </td>
                  <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 font-bold text-[var(--theme-text-primary)]">
                    {nineTotals.totalPar}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-[var(--theme-text-primary)]">
                    Hándicap (SI)
                  </td>
                  {inHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 text-[var(--theme-text-secondary)] font-normal">
                      {h.strokeIndex}
                    </td>
                  ))}
                  <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 text-[var(--theme-text-secondary)]">—</td>
                  <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 text-[var(--theme-text-secondary)]">1-18</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
  );
}
