import { SPAIN_GOLF_COURSES_CATALOG } from './catalog';
import type { SpainAutonomousCommunity, SpainCourseFilterOptions, SpainGolfCourse } from './types';

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
 * Busca y filtra campos de golf en la guía nacional de España.
 */
export function searchSpainGolfCourses(
  options: SpainCourseFilterOptions = {}
): SpainGolfCourse[] {
  const { query = '', community = '', holesCount = 'all' } = options;
  const normalizedQuery = normalizeSearchText(query);

  return SPAIN_GOLF_COURSES_CATALOG.filter((course) => {
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
    ];

    return searchableFields.some((field) =>
      normalizeSearchText(field).includes(normalizedQuery)
    );
  });
}

/**
 * Obtiene un campo de la guía de España por su ID interno o su identificador externo / federativo.
 */
export function getSpainGolfCourseById(idOrExternalId: string): SpainGolfCourse | null {
  const target = idOrExternalId.trim();
  const found = SPAIN_GOLF_COURSES_CATALOG.find(
    (c) => c.id === target || c.externalGolfApiId === target
  );
  return found ?? null;
}
