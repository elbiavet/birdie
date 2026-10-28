import { cacheCourseData, type CachedCourseHole } from '@/lib/capacitor/sqlite';
import { GOLF_API_COURSES_CATALOG } from './catalog';
import {
  buildSupabaseCourseSyncBundle,
  normalizeExternalCoursePayload,
} from './normalizer';
import type {
  CourseNineTotals,
  GolfApiCourse,
  GolfApiHole,
} from './types';

export * from './types';
export { GOLF_API_COURSES_CATALOG } from './catalog';
export {
  buildSupabaseCourseSyncBundle,
  normalizeExternalCoursePayload,
};

/**
 * Busca campos en el directorio por texto libre (nombre del campo, nombre del club o ciudad)
 * y opcionalmente filtra por ciudad exacta.
 */
export function searchCourses(
  query = '',
  cityFilter = ''
): GolfApiCourse[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCity = cityFilter.trim().toLowerCase();

  return GOLF_API_COURSES_CATALOG.filter((course) => {
    if (
      normalizedCity &&
      course.city.toLowerCase() !== normalizedCity
    ) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      course.name.toLowerCase().includes(normalizedQuery) ||
      course.clubName.toLowerCase().includes(normalizedQuery) ||
      course.city.toLowerCase().includes(normalizedQuery) ||
      course.externalGolfApiId.toLowerCase().includes(normalizedQuery)
    );
  });
}

/**
 * Obtiene un campo por su UUID interno o por su externalGolfApiId (ej. 'golfapi_course_1024').
 */
export function getCourseById(idOrExternalId: string): GolfApiCourse | null {
  const target = idOrExternalId.trim();
  const found = GOLF_API_COURSES_CATALOG.find(
    (c) => c.id === target || c.externalGolfApiId === target
  );
  return found ?? null;
}

/**
 * Calcula los totales de Ida (hoyos 1..9), Vuelta (hoyos 10..18) y Total (18 hoyos)
 * tanto en Par como en distancia en metros según la barra seleccionada.
 */
export function calculateCourseNineTotals(
  holes: GolfApiHole[],
  teeColor: 'white' | 'yellow' | 'blue' | 'red' = 'yellow'
): CourseNineTotals {
  const pickMeters = (h: GolfApiHole): number => {
    switch (teeColor) {
      case 'white':
        return h.distanceWhiteMeters;
      case 'blue':
        return h.distanceBlueMeters;
      case 'red':
        return h.distanceRedMeters;
      default:
        return h.distanceYellowMeters;
    }
  };

  const outHoles = holes.filter((h) => h.holeNumber <= 9);
  const inHoles = holes.filter((h) => h.holeNumber >= 10);

  const outPar = outHoles.reduce((acc, h) => acc + h.par, 0);
  const inPar = inHoles.reduce((acc, h) => acc + h.par, 0);
  const outMeters = outHoles.reduce((acc, h) => acc + pickMeters(h), 0);
  const inMeters = inHoles.reduce((acc, h) => acc + pickMeters(h), 0);

  return {
    outPar,
    inPar,
    totalPar: outPar + inPar,
    outMeters,
    inMeters,
    totalMeters: outMeters + inMeters,
  };
}

/**
 * Descarga y guarda en la caché SQLite local los hoyos y coordenadas GPS de un campo
 * para permitir el uso 100% offline del marcador y del telémetro GPS en el campo.
 */
export async function syncCourseToOfflineCache(
  idOrExternalId: string
): Promise<{ course: GolfApiCourse; cachedHolesCount: number }> {
  const course = getCourseById(idOrExternalId);
  if (!course) {
    throw new Error(`No se encontró el campo "${idOrExternalId}" para cachear offline.`);
  }

  const cachedHoles: CachedCourseHole[] = course.holes.map((h) => ({
    courseId: course.id,
    holeNumber: h.holeNumber,
    par: h.par,
    strokeIndex: h.strokeIndex,
    distanceYellowMeters: h.distanceYellowMeters,
    greenFrontLat: h.greenFrontLat,
    greenFrontLng: h.greenFrontLng,
    greenCenterLat: h.greenCenterLat,
    greenCenterLng: h.greenCenterLng,
    greenBackLat: h.greenBackLat,
    greenBackLng: h.greenBackLng,
  }));

  await cacheCourseData(course.id, cachedHoles);

  return {
    course,
    cachedHolesCount: cachedHoles.length,
  };
}
