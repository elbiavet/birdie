import { cacheCourseData, type CachedCourseHole } from '@/lib/capacitor/sqlite';
import { GOLF_API_COURSES_CATALOG } from './catalog';
import type {
  CourseNineTotals,
  ExternalGolfApiRawPayload,
  GolfApiCourse,
  GolfApiHole,
} from './types';

export * from './types';
export { GOLF_API_COURSES_CATALOG } from './catalog';

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
 * Normaliza la carga útil cruda de un proveedor externo (golfapi.io / GolfCourseAPI)
 * al contrato interno desacoplado GolfApiCourse.
 */
export function normalizeExternalCoursePayload(
  raw: ExternalGolfApiRawPayload
): GolfApiCourse {
  if (!raw.courseID || !raw.courseName || !Array.isArray(raw.holes) || raw.holes.length === 0) {
    throw new Error('Payload de Golf API inválido: faltan courseID, courseName u hoyos.');
  }

  const holes: GolfApiHole[] = raw.holes
    .map((h) => ({
      holeNumber: h.hole,
      par: h.par,
      strokeIndex: h.handicap,
      distanceWhiteMeters: h.whiteMeters ?? h.yellowMeters + 15,
      distanceYellowMeters: h.yellowMeters,
      distanceBlueMeters: h.blueMeters ?? Math.max(90, h.yellowMeters - 25),
      distanceRedMeters: h.redMeters ?? Math.max(80, h.yellowMeters - 45),
      teeLat: h.teeLat ?? raw.lat,
      teeLng: h.teeLng ?? raw.lng,
      greenFrontLat: h.greenFrontLat,
      greenFrontLng: h.greenFrontLng,
      greenCenterLat: h.greenCenterLat,
      greenCenterLng: h.greenCenterLng,
      greenBackLat: h.greenBackLat,
      greenBackLng: h.greenBackLng,
      pois: [],
    }))
    .sort((a, b) => a.holeNumber - b.holeNumber);

  const parTotal = holes.reduce((acc, h) => acc + h.par, 0);
  const holesCount: 9 | 18 = holes.length <= 9 ? 9 : 18;

  const tees =
    raw.tees && raw.tees.length > 0
      ? raw.tees.map((t, idx) => ({
          id: t.teeID || `ext-tee-${idx + 1}`,
          name: t.teeName,
          colorHex: t.teeColor || '#FACC15',
          gender: t.gender || 'mixed',
          courseRating: t.courseRating,
          slopeRating: t.slopeRating,
          totalDistanceMeters: t.totalMeters,
        }))
      : [
          {
            id: 'ext-tee-default',
            name: 'Amarillas',
            colorHex: '#FACC15',
            gender: 'mixed' as const,
            courseRating: parTotal,
            slopeRating: 125,
            totalDistanceMeters: holes.reduce(
              (acc, h) => acc + h.distanceYellowMeters,
              0
            ),
          },
        ];

  return {
    id: `ext-${raw.courseID}`,
    externalGolfApiId: raw.courseID,
    name: raw.courseName,
    clubName: raw.clubName || raw.courseName,
    city: raw.city || 'Desconocida',
    country: raw.country || 'España',
    holesCount,
    parTotal,
    latitude: raw.lat,
    longitude: raw.lng,
    address: raw.address || '',
    phone: raw.phone || '',
    website: raw.website || '',
    tees,
    holes,
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
