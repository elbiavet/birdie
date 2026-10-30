import type {
  ExternalGolfApiRawPayload,
  GolfApiCourse,
  GolfApiHole,
  GolfApiTee,
} from './types';

function isValidLat(lat: unknown): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLng(lng: unknown): lng is number {
  return typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/**
 * Fuente única de verdad (compartida entre el cliente Next.js y la Edge Function Deno)
 * para validar y normalizar payloads de proveedores externos (golfapi.io / GolfCourseAPI).
 */
export function normalizeExternalCoursePayload(
  raw: ExternalGolfApiRawPayload
): GolfApiCourse {
  if (
    !raw ||
    typeof raw.courseID !== 'string' ||
    !raw.courseID.trim() ||
    typeof raw.courseName !== 'string' ||
    !raw.courseName.trim() ||
    !Array.isArray(raw.holes) ||
    (raw.holes.length !== 9 && raw.holes.length !== 18)
  ) {
    throw new Error(
      'Payload de Golf API inválido: se requiere courseID, courseName y exactamente 9 o 18 hoyos.'
    );
  }

  if (!isValidLat(raw.lat) || !isValidLng(raw.lng)) {
    throw new Error(
      'Payload de Golf API inválido: coordenadas lat/lng del campo ausentes o fuera de rango (-90..90 / -180..180).'
    );
  }

  const seenHoleNumbers = new Set<number>();
  const seenStrokeIndexes = new Set<number>();

  const holes: GolfApiHole[] = raw.holes
    .map((h) => {
      if (
        typeof h.hole !== 'number' ||
        !Number.isInteger(h.hole) ||
        h.hole < 1 ||
        h.hole > (raw.holes.length === 9 ? 9 : 18)
      ) {
        throw new Error(`Payload de Golf API inválido: número de hoyo fuera de rango (${String(h.hole)}).`);
      }
      if (seenHoleNumbers.has(h.hole)) {
        throw new Error(`Payload de Golf API inválido: número de hoyo duplicado (${h.hole}).`);
      }
      seenHoleNumbers.add(h.hole);

      if (h.par !== 3 && h.par !== 4 && h.par !== 5) {
        throw new Error(`Payload de Golf API inválido: par inválido en hoyo ${h.hole} (${String(h.par)}).`);
      }

      if (
        typeof h.handicap !== 'number' ||
        !Number.isInteger(h.handicap) ||
        h.handicap < 1 ||
        h.handicap > 18
      ) {
        throw new Error(
          `Payload de Golf API inválido: strokeIndex/handicap inválido en hoyo ${h.hole} (${String(h.handicap)}).`
        );
      }
      if (seenStrokeIndexes.has(h.handicap)) {
        throw new Error(
          `Payload de Golf API inválido: strokeIndex/handicap duplicado (${h.handicap}).`
        );
      }
      seenStrokeIndexes.add(h.handicap);

      if (
        typeof h.yellowMeters !== 'number' ||
        !Number.isFinite(h.yellowMeters) ||
        h.yellowMeters <= 0
      ) {
        throw new Error(
          `Payload de Golf API inválido: distancia yellowMeters inválida en hoyo ${h.hole}.`
        );
      }

      if (
        !isValidLat(h.greenFrontLat) ||
        !isValidLng(h.greenFrontLng) ||
        !isValidLat(h.greenCenterLat) ||
        !isValidLng(h.greenCenterLng) ||
        !isValidLat(h.greenBackLat) ||
        !isValidLng(h.greenBackLng)
      ) {
        throw new Error(
          `Payload de Golf API inválido: coordenadas GPS de green ausentes o fuera de rango en hoyo ${h.hole}.`
        );
      }

      return {
        holeNumber: h.hole,
        par: h.par,
        strokeIndex: h.handicap,
        distanceWhiteMeters: h.whiteMeters ?? h.yellowMeters + 15,
        distanceYellowMeters: h.yellowMeters,
        distanceBlueMeters: h.blueMeters ?? Math.max(90, h.yellowMeters - 25),
        distanceRedMeters: h.redMeters ?? Math.max(80, h.yellowMeters - 45),
        teeLat: isValidLat(h.teeLat) ? h.teeLat : raw.lat,
        teeLng: isValidLng(h.teeLng) ? h.teeLng : raw.lng,
        greenFrontLat: h.greenFrontLat,
        greenFrontLng: h.greenFrontLng,
        greenCenterLat: h.greenCenterLat,
        greenCenterLng: h.greenCenterLng,
        greenBackLat: h.greenBackLat,
        greenBackLng: h.greenBackLng,
        pois: [],
      };
    })
    .sort((a, b) => a.holeNumber - b.holeNumber);

  const parTotal = holes.reduce((acc, h) => acc + h.par, 0);
  const holesCount: 9 | 18 = holes.length === 9 ? 9 : 18;

  const deduplicatedTeesMap = new Map<string, GolfApiTee>();

  if (raw.tees && raw.tees.length > 0) {
    raw.tees.forEach((t, idx) => {
      const name = (t.teeName ?? '').trim();
      const gender = t.gender ?? 'mixed';
      if (!name) {
        throw new Error('Payload de Golf API inválido: teeName vacío en barras de salida.');
      }
      if (
        typeof t.slopeRating !== 'number' ||
        t.slopeRating < 55 ||
        t.slopeRating > 155 ||
        typeof t.courseRating !== 'number' ||
        t.courseRating <= 0
      ) {
        throw new Error(
          `Payload de Golf API inválido: slopeRating o courseRating fuera de rango en barra "${name}".`
        );
      }

      const uniqueKey = `${name.toLowerCase()}::${gender}`;
      deduplicatedTeesMap.set(uniqueKey, {
        id: t.teeID || `ext-tee-${idx + 1}`,
        name,
        colorHex: t.teeColor || '#FACC15',
        gender,
        courseRating: t.courseRating,
        slopeRating: t.slopeRating,
        totalDistanceMeters: t.totalMeters,
      });
    });
  } else {
    deduplicatedTeesMap.set('amarillas::mixed', {
      id: 'ext-tee-default',
      name: 'Amarillas',
      colorHex: '#FACC15',
      gender: 'mixed',
      courseRating: parTotal,
      slopeRating: 125,
      totalDistanceMeters: holes.reduce((acc, h) => acc + h.distanceYellowMeters, 0),
    });
  }

  return {
    id: `ext-${raw.courseID.trim()}`,
    externalGolfApiId: raw.courseID.trim(),
    name: raw.courseName.trim(),
    clubName: (raw.clubName || raw.courseName).trim(),
    city: (raw.city || 'Desconocida').trim(),
    country: (raw.country || 'España').trim(),
    holesCount,
    parTotal,
    latitude: raw.lat,
    longitude: raw.lng,
    address: raw.address || '',
    phone: raw.phone || '',
    website: raw.website || '',
    tees: Array.from(deduplicatedTeesMap.values()),
    holes,
  };
}

/**
 * Construye el lote normalizado listo para la función transaccional `public.sync_golf_course_atomic`
 * en PostgreSQL / Supabase. Acepta tanto un `GolfApiCourse` ya normalizado como un payload crudo.
 */
export function buildSupabaseCourseSyncBundle(
  courseOrRaw: GolfApiCourse | ExternalGolfApiRawPayload,
  isHomeCourse = false
) {
  const course: GolfApiCourse =
    'externalGolfApiId' in courseOrRaw
      ? courseOrRaw
      : normalizeExternalCoursePayload(courseOrRaw);

  return {
    course: {
      external_golf_api_id: course.externalGolfApiId,
      name: course.name,
      club_name: course.clubName,
      city: course.city,
      country: course.country,
      holes_count: course.holesCount,
      par_total: course.parTotal,
      latitude: course.latitude,
      longitude: course.longitude,
      address: course.address,
      phone: course.phone,
      website: course.website,
      is_home_course: Boolean(isHomeCourse),
    },
    tees: course.tees.map((t) => ({
      name: t.name,
      color_hex: t.colorHex,
      gender: t.gender,
      course_rating: t.courseRating,
      slope_rating: t.slopeRating,
      total_distance_meters: t.totalDistanceMeters,
    })),
    holes: course.holes.map((h) => ({
      hole_number: h.holeNumber,
      par: h.par,
      stroke_index: h.strokeIndex,
      distance_white_meters: h.distanceWhiteMeters,
      distance_yellow_meters: h.distanceYellowMeters,
      distance_blue_meters: h.distanceBlueMeters,
      distance_red_meters: h.distanceRedMeters,
      tee_lat: h.teeLat,
      tee_lng: h.teeLng,
      green_front_lat: h.greenFrontLat,
      green_front_lng: h.greenFrontLng,
      green_center_lat: h.greenCenterLat,
      green_center_lng: h.greenCenterLng,
      green_back_lat: h.greenBackLat,
      green_back_lng: h.greenBackLng,
    })),
  };
}
