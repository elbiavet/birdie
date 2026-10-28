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
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <Compass className="h-3.5 w-3.5" />
                Integración Golf API + Caché SQLite Offline
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Directorio de Clubes y Campos
              </h2>
              <p className="text-sm text-slate-600">
                Consulta pares, hándicap por hoyo (HCP), Slope/Rating de barras y descarga
                los recorridos para usar el GPS sin cobertura.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCacheOffline(selectedCourse)}
              className="inline-flex items-center gap-2 rounded-xl bg-club-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              <DownloadCloud className="h-4 w-4" />
              Descargar Recorrido a SQLite Offline
            </button>
          </div>

          {syncMessage && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{syncMessage}</span>
            </div>
          )}

          {/* Filtros de búsqueda */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre de campo, club, ciudad o ID Golf API..."
                aria-label="Buscar campo de golf"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                aria-label="Filtrar por ciudad"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              >
                <option value="">Todas las ciudades ({cities.length})</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
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
                className={`cursor-pointer rounded-2xl border p-5 transition ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {course.city} · {course.holesCount} Hoyos · Par {course.parTotal}
                    </span>
                    <h3 className="mt-1 text-base font-bold text-slate-900">
                      {course.name}
                    </h3>
                    <p className="text-xs text-slate-600">{course.clubName}</p>
                  </div>
                  {isClubHome && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                      Sede Activa
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{course.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{course.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono text-[11px] text-slate-500">
                      ID: {course.externalGolfApiId}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs font-medium text-slate-500">
                    {course.tees.length} barras homologadas
                  </span>
                  {cachedCount ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Offline ({cachedCount}h)
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700">
                      Ver ficha técnica →
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Detalle Técnico del Recorrido Seleccionado */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-emerald-700" />
                <h3 className="text-lg font-bold text-slate-900">
                  Tarjeta Técnica del Recorrido: {selectedCourse.name}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
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
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    selectedTeeColor === teeBtn.key
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
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
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-slate-300"
                      style={{ backgroundColor: tee.colorHex }}
                    />
                    <span className="text-sm font-bold text-slate-900">{tee.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Distancia: {tee.totalDistanceMeters} m
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-700">
                    CR <span className="font-bold text-slate-900">{tee.courseRating}</span>
                  </div>
                  <div className="text-xs font-semibold text-emerald-700">
                    Slope <span className="font-bold">{tee.slopeRating}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla Ida (Hoyos 1 a 9) */}
          <div className="mt-6 overflow-x-auto">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Primera Vuelta — IDA (OUT · Hoyos 1 - 9)
            </h4>
            <table className="w-full min-w-[640px] border-collapse text-center text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                  <th className="px-3 py-2 text-left font-bold">Hoyo</th>
                  {outHoles.map((h) => (
                    <th key={h.holeNumber} className="px-2 py-2 font-bold">
                      {h.holeNumber}
                    </th>
                  ))}
                  <th className="bg-emerald-900 px-3 py-2 font-bold text-white">IDA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-slate-700">
                    Metros ({selectedTeeColor.toUpperCase()})
                  </td>
                  {outHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 font-medium text-slate-600">
                      {getHoleDistance(h.holeNumber)}
                    </td>
                  ))}
                  <td className="bg-emerald-50 px-3 py-2 font-bold text-emerald-900">
                    {nineTotals.outMeters}m
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-slate-700">Par</td>
                  {outHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 font-bold text-slate-900">
                      {h.par}
                    </td>
                  ))}
                  <td className="bg-emerald-50 px-3 py-2 font-bold text-emerald-900">
                    {nineTotals.outPar}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-slate-700">
                    Hándicap (SI)
                  </td>
                  {outHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 text-slate-500">
                      {h.strokeIndex}
                    </td>
                  ))}
                  <td className="bg-slate-50 px-3 py-2 text-slate-400">—</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tabla Vuelta (Hoyos 10 a 18) */}
          <div className="mt-6 overflow-x-auto">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Segunda Vuelta — VUELTA (IN · Hoyos 10 - 18)
            </h4>
            <table className="w-full min-w-[640px] border-collapse text-center text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                  <th className="px-3 py-2 text-left font-bold">Hoyo</th>
                  {inHoles.map((h) => (
                    <th key={h.holeNumber} className="px-2 py-2 font-bold">
                      {h.holeNumber}
                    </th>
                  ))}
                  <th className="bg-emerald-800 px-3 py-2 font-bold text-white">VUELTA</th>
                  <th className="bg-slate-900 px-3 py-2 font-bold text-white">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-slate-700">
                    Metros ({selectedTeeColor.toUpperCase()})
                  </td>
                  {inHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 font-medium text-slate-600">
                      {getHoleDistance(h.holeNumber)}
                    </td>
                  ))}
                  <td className="bg-emerald-50 px-3 py-2 font-bold text-emerald-900">
                    {nineTotals.inMeters}m
                  </td>
                  <td className="bg-slate-100 px-3 py-2 font-bold text-slate-900">
                    {nineTotals.totalMeters}m
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-slate-700">Par</td>
                  {inHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 font-bold text-slate-900">
                      {h.par}
                    </td>
                  ))}
                  <td className="bg-emerald-50 px-3 py-2 font-bold text-emerald-900">
                    {nineTotals.inPar}
                  </td>
                  <td className="bg-slate-100 px-3 py-2 font-bold text-slate-900">
                    {nineTotals.totalPar}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-left font-semibold text-slate-700">
                    Hándicap (SI)
                  </td>
                  {inHoles.map((h) => (
                    <td key={h.holeNumber} className="px-2 py-2 text-slate-500">
                      {h.strokeIndex}
                    </td>
                  ))}
                  <td className="bg-slate-50 px-3 py-2 text-slate-400">—</td>
                  <td className="bg-slate-50 px-3 py-2 text-slate-400">1-18</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
  );
}
