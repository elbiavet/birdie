import rawOsmDataset from '@/data/osm-golf-courses.json';
import { SPAIN_GOLF_COURSES_CATALOG } from './catalog';
import {
  adaptOsmCourseToSpainGolfCourse,
  isOsmCourseDuplicateOfCurated,
} from './osm-normalizer';
import type { OsmDatasetFile } from './osm-types';
import type {
  CourseProvenance,
  SpainAutonomousCommunity,
  SpainCourseFilterOptions,
  SpainGolfCourse,
} from './types';

export const SPAIN_AUTONOMOUS_COMMUNITIES: readonly SpainAutonomousCommunity[] = [
  'Andalucía',
  'Aragón',
  'Asturias',
  'Illes Balears',
  'Canarias',
  'Cantabria',
  'Castilla y León',
  'Castilla-La Mancha',
  'Cataluña',
  'Comunidad de Madrid',
  'Comunidad Valenciana',
  'Extremadura',
  'Galicia',
  'La Rioja',
  'Navarra',
  'País Vasco',
  'Región de Murcia',
] as const;

/**
 * Atribución oficial obligatoria de OpenStreetMap según términos de licencia ODbL 1.0.
 */
export const OSM_ATTRIBUTION = {
  text: '© OpenStreetMap contributors',
  url: 'https://www.openstreetmap.org/copyright',
  notice:
    'Inventario geográfico comunitario derivado de OpenStreetMap bajo licencia ODbL 1.0. La cobertura puede ser parcial y carece de telemetría deportiva homologada.',
} as const;

/**
 * Normaliza texto para búsqueda tolerante a mayúsculas, minúsculas y tildes/diacríticos.
 */
function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Carga y cachea en memoria los campos provenientes de OpenStreetMap,
 * deduplicándolos frente al catálogo curado para que no se muestren dos veces
 * los mismos complejos (ej. Valderrama, Puerta de Hierro, El Saler).
 */
let cachedOsmCourses: SpainGolfCourse[] | null = null;

export function getOsmGolfCourses(): SpainGolfCourse[] {
  if (cachedOsmCourses) {
    return cachedOsmCourses;
  }

  const dataset = rawOsmDataset as unknown as OsmDatasetFile;
  const rawList = Array.isArray(dataset?.courses) ? dataset.courses : [];

  cachedOsmCourses = rawList
    .filter((osm) => !isOsmCourseDuplicateOfCurated(osm, SPAIN_GOLF_COURSES_CATALOG))
    .map(adaptOsmCourseToSpainGolfCourse);

  return cachedOsmCourses;
}

/**
 * Devuelve los metadatos globales del archivo de datos de OSM importado.
 */
export function getOsmDatasetMetadata(): {
  schemaVersion: string;
  attribution: string;
  importedAt: string;
  elementsCount: number;
  overpassInstance?: string;
} {
  const dataset = rawOsmDataset as unknown as OsmDatasetFile;
  return {
    schemaVersion: dataset?.schemaVersion || '1.0.0',
    attribution: dataset?.attribution || '© OpenStreetMap contributors',
    importedAt: dataset?.importedAt || 'No registrada',
    elementsCount: dataset?.elementsCount || 0,
    overpassInstance: dataset?.overpassInstance,
  };
}

/**
 * Devuelve todos los campos disponibles (curados + comunitarios OSM deduplicados),
 * o filtrados por origen ('all' | 'curated' | 'osm').
 */
export function getAllSpainGolfCourses(
  provenance: CourseProvenance = 'all'
): SpainGolfCourse[] {
  const curated = SPAIN_GOLF_COURSES_CATALOG.map((c) => ({
    ...c,
    provenance: (c.provenance ?? 'curated') as 'curated',
  }));

  if (provenance === 'curated') {
    return curated;
  }

  const osm = getOsmGolfCourses();

  if (provenance === 'osm') {
    return osm;
  }

  return [...curated, ...osm];
}

/**
 * Busca y filtra campos de golf en la guía nacional de España,
 * soportando filtrado por comunidad autónoma, número de hoyos, texto y procedencia (curada vs OSM).
 */
export function searchSpainGolfCourses(
  options: SpainCourseFilterOptions = {}
): SpainGolfCourse[] {
  const {
    query = '',
    community = '',
    holesCount = 'all',
    provenance = 'all',
  } = options;
  const normalizedQuery = normalizeSearchText(query);
  const baseCourses = getAllSpainGolfCourses(provenance);

  return baseCourses.filter((course) => {
    // Filtro por comunidad autónoma
    if (community && community !== 'all' && course.autonomousCommunity !== community) {
      return false;
    }

    // Filtro por número de hoyos
    if (holesCount && holesCount !== 'all' && course.holesCount !== holesCount) {
      return false;
    }

    // Filtro por texto libre
    if (!normalizedQuery) {
      return true;
    }

    const searchableFields = [
      course.name,
      course.clubName,
      course.city,
      course.province,
      course.autonomousCommunity,
      course.externalGolfApiId,
      course.designer ?? '',
      course.address ?? '',
      course.osmKey ?? '',
      course.osmId ? String(course.osmId) : '',
    ];

    return searchableFields.some((field) =>
      normalizeSearchText(field).includes(normalizedQuery)
    );
  });
}

/**
 * Obtiene un campo de la guía de España por su ID interno, identificador federativo o clave OSM.
 */
export function getSpainGolfCourseById(idOrExternalId: string): SpainGolfCourse | null {
  const target = idOrExternalId.trim();
  const allCourses = getAllSpainGolfCourses('all');

  const found = allCourses.find(
    (c) =>
      c.id === target ||
      c.externalGolfApiId === target ||
      c.osmKey === target ||
      (c.osmId && String(c.osmId) === target)
  );

  return found ?? null;
}
