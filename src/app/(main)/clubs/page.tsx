'use client';

import React, { useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/components/providers/LanguageProvider';
import {
  SPAIN_AUTONOMOUS_COMMUNITIES,
  SPAIN_GOLF_COURSES_CATALOG,
  searchSpainGolfCourses,
  type SpainAutonomousCommunity,
  type SpainGolfCourse,
} from '@/lib/spain-courses';
import { calculateCourseNineTotals, syncCourseToOfflineCache } from '@/lib/golf-api';
import { getCachedCourseData } from '@/lib/capacitor/sqlite';
import {
  Building2,
  CheckCircle2,
  Compass,
  DownloadCloud,
  ExternalLink,
  Flag,
  Globe,
  Info,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Mail,
  Calendar,
  Layers,
} from 'lucide-react';

type TeeFilterColor = 'white' | 'yellow' | 'blue' | 'red';

export default function ClubsDirectoryPage() {
  const { club } = useClub();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [communityFilter, setCommunityFilter] = useState<SpainAutonomousCommunity | ''>('');
  const [holesFilter, setHolesFilter] = useState<'all' | 9 | 18>('all');

  // Campo seleccionado por defecto: la sede del club activo o el primero del catálogo
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const homeCourse = SPAIN_GOLF_COURSES_CATALOG.find(
      (c) => c.externalGolfApiId === club.defaultCourseExternalId
    );
    return homeCourse?.id ?? SPAIN_GOLF_COURSES_CATALOG[0].id;
  });

  const [selectedTeeColor, setSelectedTeeColor] = useState<TeeFilterColor>('yellow');
  const [cachedCourseIds, setCachedCourseIds] = useState<Record<string, number>>({});
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filtrado reactivo en la guía nacional de campos de España
  const filteredCourses = useMemo(() => {
    return searchSpainGolfCourses({
      query: searchQuery,
      community: communityFilter,
      holesCount: holesFilter,
    });
  }, [searchQuery, communityFilter, holesFilter]);

  // Campo actualmente en foco
  const selectedCourse: SpainGolfCourse = useMemo(() => {
    const found = filteredCourses.find((c) => c.id === selectedCourseId);
    if (found) return found;
    // Si el filtro ocultó el campo actual, buscarlo en todo el catálogo antes de fallback
    const inCatalog = SPAIN_GOLF_COURSES_CATALOG.find((c) => c.id === selectedCourseId);
    return inCatalog ?? filteredCourses[0] ?? SPAIN_GOLF_COURSES_CATALOG[0];
  }, [filteredCourses, selectedCourseId]);

  // Totales de 9 y 18 hoyos (si tiene hoyos disponibles)
  const nineTotals = useMemo(() => {
    if (!selectedCourse.holes || selectedCourse.holes.length === 0) return null;
    return calculateCourseNineTotals(selectedCourse.holes, selectedTeeColor);
  }, [selectedCourse, selectedTeeColor]);

  // Manejador de descarga a SQLite offline
  const handleCacheOffline = async (course: SpainGolfCourse) => {
    if (!course.holes || course.holes.length === 0) {
      setSyncMessage(
        `El campo "${course.name}" no dispone aún de telemetría de hoyos descargable.`
      );
      setTimeout(() => setSyncMessage(null), 4000);
      return;
    }

    try {
      const result = await syncCourseToOfflineCache(course.id);
      const verifyCache = await getCachedCourseData(course.id);
      setCachedCourseIds((prev) => ({
        ...prev,
        [course.id]: verifyCache.length || result.cachedHolesCount,
      }));
      setSyncMessage(
        `Recorrido "${course.name}" descargado en SQLite local (${result.cachedHolesCount} hoyos listos sin conexión).`
      );
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? err.message : 'Error al sincronizar el recorrido.'
      );
    }
  };

  const getHoleDistance = (holeNumber: number): number => {
    if (!selectedCourse.holes) return 0;
    const hole = selectedCourse.holes.find((h) => h.holeNumber === holeNumber);
    if (!hole) return 0;
    if (selectedTeeColor === 'white') return hole.distanceWhiteMeters;
    if (selectedTeeColor === 'blue') return hole.distanceBlueMeters;
    if (selectedTeeColor === 'red') return hole.distanceRedMeters;
    return hole.distanceYellowMeters;
  };

  const outHoles = (selectedCourse.holes ?? []).filter((h) => h.holeNumber <= 9);
  const inHoles = (selectedCourse.holes ?? []).filter((h) => h.holeNumber >= 10);

  return (
    <div className="space-y-6">
      {/* Cabecera y Buscador de la Guía de España */}
      <section className="hero-banner-luxury relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-colors">
        {/* Curvas sutiles de fondo */}
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20 dark:opacity-15"
          viewBox="0 0 400 200"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 200 C 150 180, 250 80, 400 0 L 400 200 Z"
            fill="url(#clubs-hero-gold)"
          />
          <defs>
            <linearGradient id="clubs-hero-gold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9AD74" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#E6D4A7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#BA9C61" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
              <Compass className="h-3.5 w-3.5" />
              Guía Oficial de Campos de Golf de España · Socios y Visitantes
            </span>
            <h1 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)]">
              Guía y Directorio de Clubes y Campos
            </h1>
            <p className="text-sm text-[var(--theme-text-secondary)] font-normal max-w-3xl">
              Descubre y consulta campos de golf en toda España para planificar tu próxima visita:
              ubicación, datos de contacto, diseñador, barras homologadas (Slope / Rating) y tarjeta
              técnica del recorrido. Independiente de la configuración del club activo.
            </p>
          </div>

          {selectedCourse.hasHoleDetail && (
            <button
              type="button"
              onClick={() => handleCacheOffline(selectedCourse)}
              className="btn-gold-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition cursor-pointer self-start md:self-auto shrink-0"
            >
              <DownloadCloud className="h-4 w-4" />
              Descargar Recorrido a SQLite Offline
            </button>
          )}
        </div>

        {syncMessage && (
          <div
            role="status"
            className="relative z-10 mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Filtros de búsqueda multi-criterio */}
        <div className="relative z-10 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-12">
          {/* Buscador de texto */}
          <div className="relative sm:col-span-6">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[var(--theme-text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por campo, club, municipio, provincia o diseñador..."
              aria-label="Buscar campo de golf en España"
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] py-2.5 pl-10 pr-4 text-sm focus:border-[var(--theme-accent)] focus:outline-none"
            />
          </div>

          {/* Selector de Comunidad Autónoma */}
          <div className="sm:col-span-4">
            <select
              value={communityFilter}
              onChange={(e) => setCommunityFilter(e.target.value as SpainAutonomousCommunity | '')}
              aria-label="Filtrar por comunidad autónoma"
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3.5 py-2.5 text-sm focus:border-[var(--theme-accent)] focus:outline-none"
            >
              <option value="">Todas las Comunidades ({SPAIN_AUTONOMOUS_COMMUNITIES.length})</option>
              {SPAIN_AUTONOMOUS_COMMUNITIES.map((comm) => (
                <option key={comm} value={comm} className="bg-[var(--theme-surface)]">
                  {comm}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Hoyos */}
          <div className="sm:col-span-2">
            <select
              value={holesFilter}
              onChange={(e) => {
                const val = e.target.value;
                setHolesFilter(val === 'all' ? 'all' : (Number(val) as 9 | 18));
              }}
              aria-label="Filtrar por número de hoyos"
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3.5 py-2.5 text-sm focus:border-[var(--theme-accent)] focus:outline-none"
            >
              <option value="all">Todos los hoyos</option>
              <option value="18">18 Hoyos</option>
              <option value="9">9 Hoyos</option>
            </select>
          </div>
        </div>

        {/* Resumen de resultados */}
        <div className="relative z-10 mt-3 flex items-center justify-between text-xs text-[var(--theme-text-secondary)]">
          <span>
            Mostrando <strong className="text-[var(--theme-text-primary)]">{filteredCourses.length}</strong> campos de golf en España
            {communityFilter ? ` en ${communityFilter}` : ''}
            {holesFilter !== 'all' ? ` (${holesFilter} hoyos)` : ''}
          </span>
          {(searchQuery || communityFilter || holesFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCommunityFilter('');
                setHolesFilter('all');
              }}
              className="text-[var(--theme-accent)] hover:underline cursor-pointer font-semibold"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {/* Listado de Tarjetas de Campos de Golf */}
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
                      borderColor: isDark ? '#C9AD74' : '#A98A55',
                      boxShadow: isDark
                        ? '0 4px 16px rgba(201, 173, 116, 0.2)'
                        : '0 4px 16px rgba(169, 138, 85, 0.15)',
                    }
                  : undefined
              }
              className={`cursor-pointer rounded-2xl border p-5 transition flex flex-col justify-between ${
                isSelected
                  ? 'border-2 card-luxury'
                  : 'card-luxury hover:border-[var(--theme-accent)]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                      {course.autonomousCommunity} · {course.province}
                    </span>
                    <h3 className="mt-1 text-base font-bold text-[var(--theme-text-primary)] leading-tight">
                      {course.name}
                    </h3>
                    <p className="text-xs text-[var(--theme-text-secondary)] font-normal mt-0.5">{course.clubName}</p>
                  </div>
                  {isClubHome ? (
                    <span
                      style={{
                        background: isDark
                          ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                          : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                        color: '#0B0C10',
                        borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                      }}
                      className="rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-xs shrink-0"
                    >
                      Sede Activa
                    </span>
                  ) : course.isBirdieClub ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold shrink-0">
                      Club Birdie
                    </span>
                  ) : (
                    <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] px-2 py-0.5 text-[10px] font-medium shrink-0">
                      Guía España
                    </span>
                  )}
                </div>

                <div className="mt-3.5 space-y-1.5 text-xs text-[var(--theme-text-secondary)] font-normal">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[var(--theme-accent)] shrink-0" />
                    <span className="truncate">{course.city} ({course.province})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flag className="h-3.5 w-3.5 text-[var(--theme-accent)] shrink-0" />
                    <span>{course.holesCount} Hoyos · Par {course.parTotal}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[var(--theme-accent)] shrink-0" />
                    <span>{course.phone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--theme-border)] pt-3 text-xs">
                <span className="text-[11px] font-medium text-[var(--theme-text-secondary)]">
                  {course.tees.length} barras homologadas
                </span>
                {cachedCount ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Offline ({cachedCount}h)
                  </span>
                ) : course.hasHoleDetail ? (
                  <span className="font-semibold text-[var(--theme-accent)]">
                    Ver hoyos y ficha →
                  </span>
                ) : (
                  <span className="font-medium text-[var(--theme-text-secondary)]">
                    Ver ficha y barras →
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Detalle Integral del Campo Seleccionado */}
      <section className="card-luxury rounded-2xl border p-6 shadow-sm transition-colors space-y-6">
        {/* Cabecera del Campo */}
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--theme-border)] pb-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-accent)]">
                {selectedCourse.autonomousCommunity} · {selectedCourse.province}
              </span>
              <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--theme-text-secondary)]">
                {selectedCourse.holesCount} Hoyos · Par {selectedCourse.parTotal}
              </span>
              {selectedCourse.isBirdieClub && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                  Plataforma Birdie
                </span>
              )}
            </div>

            <h2 className="mt-2 text-xl font-bold text-[var(--theme-text-primary)]">
              {selectedCourse.name}
            </h2>
            <p className="text-xs text-[var(--theme-text-secondary)] font-normal mt-0.5">
              {selectedCourse.clubName} · Coordenadas GPS: {selectedCourse.latitude.toFixed(4)}, {selectedCourse.longitude.toFixed(4)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selectedCourse.latitude},${selectedCourse.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)] transition"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
              Ver en Mapa
            </a>

            {selectedCourse.website && (
              <a
                href={selectedCourse.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)] transition"
              >
                <Globe className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                Web Oficial
              </a>
            )}

            <a
              href={`tel:${selectedCourse.phone}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)] transition"
            >
              <Phone className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
              Llamar al Club
            </a>
          </div>
        </div>

        {/* Bloque 1: Ficha General del Club y Datos de Visita */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)] mb-3 flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-[var(--theme-accent)]" />
            Información General del Club y Servicios para el Visitante
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Dirección y Ubicación */}
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3.5">
              <span className="text-[11px] font-semibold text-[var(--theme-text-secondary)] block">
                Ubicación y Dirección
              </span>
              <p className="mt-1 text-xs font-medium text-[var(--theme-text-primary)]">
                {selectedCourse.address}
              </p>
              <p className="text-[11px] text-[var(--theme-text-secondary)] font-normal mt-0.5">
                {selectedCourse.city} ({selectedCourse.province}), {selectedCourse.autonomousCommunity}
              </p>
            </div>

            {/* Contacto Directo */}
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3.5">
              <span className="text-[11px] font-semibold text-[var(--theme-text-secondary)] block">
                Contacto y Reservas
              </span>
              <p className="mt-1 text-xs font-medium text-[var(--theme-text-primary)]">
                Tel: <a href={`tel:${selectedCourse.phone}`} className="text-[var(--theme-accent)] hover:underline">{selectedCourse.phone}</a>
              </p>
              {selectedCourse.email && (
                <p className="text-[11px] text-[var(--theme-text-secondary)] font-normal truncate mt-0.5">
                  Email: <a href={`mailto:${selectedCourse.email}`} className="text-[var(--theme-accent)] hover:underline">{selectedCourse.email}</a>
                </p>
              )}
            </div>

            {/* Diseñador y Fundación */}
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3.5">
              <span className="text-[11px] font-semibold text-[var(--theme-text-secondary)] block">
                Diseño y Fundación
              </span>
              <p className="mt-1 text-xs font-medium text-[var(--theme-text-primary)]">
                {selectedCourse.designer ?? 'Comité Técnico del Club'}
              </p>
              {selectedCourse.yearFounded && (
                <p className="text-[11px] text-[var(--theme-text-secondary)] font-normal mt-0.5">
                  Fundado en {selectedCourse.yearFounded}
                </p>
              )}
            </div>

            {/* Instalaciones */}
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3.5">
              <span className="text-[11px] font-semibold text-[var(--theme-text-secondary)] block">
                Instalaciones Destacadas
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {(selectedCourse.facilities ?? ['Driving Range', 'Putting Green', 'Pro Shop', 'Restaurante']).slice(0, 3).map((f) => (
                  <span
                    key={f}
                    className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--theme-text-secondary)]"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {selectedCourse.description && (
            <p className="mt-3 text-xs text-[var(--theme-text-secondary)] font-normal italic">
              «{selectedCourse.description}»
            </p>
          )}
        </div>

        {/* Bloque 2: Barras de Salida Homologadas (Course Rating & Slope) */}
        <div className="border-t border-[var(--theme-border)] pt-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)] flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[var(--theme-accent)]" />
                Barras de Salida Homologadas (Course Rating y Slope)
              </h3>
              <p className="text-[11px] text-[var(--theme-text-secondary)] font-normal mt-0.5">
                Selecciona una barra para consultar distancias y valoración oficial de dificultad.
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
                          background: isDark
                            ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                            : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                          color: '#0B0C10',
                          borderColor: isDark ? '#DFCB9E' : '#CCB88E',
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

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>

        {/* Bloque 3: Recorrido y Tarjeta Hoyo a Hoyo (o Panel Informativo de Ficha Técnica) */}
        <div className="border-t border-[var(--theme-border)] pt-5">
          {selectedCourse.hasHoleDetail && nineTotals && selectedCourse.holes.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)] flex items-center gap-1.5">
                  <Flag className="h-4 w-4 text-[var(--theme-accent)]" />
                  Tarjeta Técnica del Recorrido: {selectedCourse.name}
                </h3>
                <span className="text-xs text-[var(--theme-text-secondary)] font-normal">
                  Par Total: <strong className="text-[var(--theme-text-primary)]">{nineTotals.totalPar}</strong> · Distancia: <strong className="text-[var(--theme-text-primary)]">{nineTotals.totalMeters} m</strong>
                </span>
              </div>

              {/* Tabla Ida (Hoyos 1 a 9) o Recorrido Completo */}
              <div className="overflow-x-auto">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  {inHoles.length === 0
                    ? 'Recorrido Completo (Hoyos 1 - 9)'
                    : 'Primera Vuelta — IDA (OUT · Hoyos 1 - 9)'}
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
                          background: isDark
                            ? 'linear-gradient(135deg, #064334 0%, #0D3028 100%)'
                            : 'linear-gradient(135deg, #0A3A2A 0%, #164D3A 100%)',
                          color: isDark ? '#E4D3AC' : '#FFFFFF',
                          borderColor: isDark ? '#C9AD74' : '#A98A55',
                        }}
                        className="px-3 py-2 font-bold"
                      >
                        IDA
                      </th>
                      {inHoles.length === 0 && (
                        <th
                          style={{
                            background: isDark
                              ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                              : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                            color: '#0B0C10',
                            borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                          }}
                          className="px-3 py-2 font-bold"
                        >
                          TOTAL
                        </th>
                      )}
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
                      {inHoles.length === 0 && (
                        <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 font-bold text-[var(--theme-text-primary)]">
                          {nineTotals.totalMeters}m
                        </td>
                      )}
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
                      {inHoles.length === 0 && (
                        <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 font-bold text-[var(--theme-text-primary)]">
                          {nineTotals.totalPar}
                        </td>
                      )}
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
                      {inHoles.length === 0 && (
                        <td className="bg-[var(--theme-surface-subtle)] px-3 py-2 text-[var(--theme-text-secondary)]">1-9</td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tabla Vuelta (Hoyos 10 a 18) - solo para campos de 18 hoyos */}
              {inHoles.length > 0 && (
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
                            background: isDark
                              ? 'linear-gradient(135deg, #064334 0%, #0D3028 100%)'
                              : 'linear-gradient(135deg, #0A3A2A 0%, #164D3A 100%)',
                            color: isDark ? '#E4D3AC' : '#FFFFFF',
                            borderColor: isDark ? '#C9AD74' : '#A98A55',
                          }}
                          className="px-3 py-2 font-bold"
                        >
                          VUELTA
                        </th>
                        <th
                          style={{
                            background: isDark
                              ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                              : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                            color: '#0B0C10',
                            borderColor: isDark ? '#DFCB9E' : '#CCB88E',
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
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-5">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-[var(--theme-accent)] shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-[var(--theme-text-primary)]">
                    Ficha General y Barras de Salida Homologadas
                  </h4>
                  <p className="text-xs text-[var(--theme-text-secondary)] font-normal leading-relaxed">
                    Este campo forma parte de la <strong>Guía Oficial de Campos de Golf de España</strong>. Dispones de los
                    datos de contacto para reservas de visitante, ubicación y las valoraciones oficiales de barras de salida
                    (Course Rating y Slope Rating). El desglose hoyo a hoyo y la telemetría GPS detallada están pendientes de
                    digitalización para este recorrido.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--theme-surface)] border border-[var(--theme-border)] px-2.5 py-1 text-[var(--theme-text-secondary)]">
                      Par del Campo: <strong className="text-[var(--theme-text-primary)]">{selectedCourse.parTotal}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--theme-surface)] border border-[var(--theme-border)] px-2.5 py-1 text-[var(--theme-text-secondary)]">
                      Total Hoyos: <strong className="text-[var(--theme-text-primary)]">{selectedCourse.holesCount}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--theme-surface)] border border-[var(--theme-border)] px-2.5 py-1 text-[var(--theme-text-secondary)]">
                      Barras homologadas: <strong className="text-[var(--theme-text-primary)]">{selectedCourse.tees.length}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Aviso de Independencia de Configuración */}
        <div className="border-t border-[var(--theme-border)] pt-4 text-center">
          <p className="text-[11px] text-[var(--theme-text-secondary)] font-normal">
            Aviso de navegación: La consulta de campos en esta guía es informativa para socios y visitantes.
            No modifica tu club activo (<strong className="text-[var(--theme-text-primary)]">{club.name}</strong>) ni altera la configuración de ningún club en Birdie.
          </p>
        </div>
      </section>
    </div>
  );
}
