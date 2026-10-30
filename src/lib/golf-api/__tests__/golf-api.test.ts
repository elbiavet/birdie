import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildSupabaseCourseSyncBundle,
  calculateCourseNineTotals,
  GOLF_API_COURSES_CATALOG,
  getCourseById,
  normalizeExternalCoursePayload,
  searchCourses,
  syncCourseToOfflineCache,
} from '../index';
import { getCachedCourseData, clearOfflineStore } from '@/lib/capacitor/sqlite';

describe('Adaptador Golf API, Edge Function y Directorio de Campos (Subfases 2.1 y 2.2)', () => {
  beforeEach(async () => {
    await clearOfflineStore();
  });

  it('contiene recorridos completos de 9 o 18 hoyos con coordenadas GPS de frente, centro y fondo de green', () => {
    expect(GOLF_API_COURSES_CATALOG.length).toBeGreaterThanOrEqual(3);

    for (const course of GOLF_API_COURSES_CATALOG) {
      expect(course.holes).toHaveLength(course.holesCount);
      expect([9, 18]).toContain(course.holesCount);
      expect(course.tees.length).toBeGreaterThanOrEqual(2);

      // Verificar que los strokeIndex 1..holesCount son únicos en cada campo
      const strokeIndexes = new Set(course.holes.map((h) => h.strokeIndex));
      expect(strokeIndexes.size).toBe(course.holesCount);

      for (const hole of course.holes) {
        expect(hole.greenFrontLat).toBeGreaterThan(35);
        expect(hole.greenCenterLat).toBeGreaterThan(35);
        expect(hole.greenBackLat).toBeGreaterThan(35);
      }
    }
  });

  it('filtra campos por texto libre y por ciudad en searchCourses y localiza por ID o externalGolfApiId (devolviendo null si no existe)', () => {
    const madridCourses = searchCourses('', 'Madrid');
    expect(madridCourses).toHaveLength(1);
    expect(madridCourses[0].externalGolfApiId).toBe('golfapi_course_1024');

    const valenciaMatches = searchCourses('valencia');
    expect(valenciaMatches).toHaveLength(1);
    expect(valenciaMatches[0].city).toBe('Valencia');

    const byExternal = getCourseById('golfapi_course_3096');
    expect(byExternal).not.toBeNull();
    expect(byExternal?.clubName).toContain('Costa Mediterránea');
    expect(byExternal?.name).toContain('Recorrido Sur');

    const byInternalId = getCourseById('11111111-1111-1111-1111-111111111101');
    expect(byInternalId?.externalGolfApiId).toBe('golfapi_course_1024');

    const illescasMatches = searchCourses('illescas');
    expect(illescasMatches).toHaveLength(1);
    expect(illescasMatches[0].externalGolfApiId).toBe('golfapi_course_8833');
    expect(illescasMatches[0].city).toBe('Illescas (Toledo)');
    expect(illescasMatches[0].parTotal).toBe(35);
    expect(illescasMatches[0].holesCount).toBe(9);
    expect(illescasMatches[0].holes).toHaveLength(9);

    const byIllescasId = getCourseById('golfapi_course_8833');
    expect(byIllescasId).not.toBeNull();
    expect(byIllescasId?.clubName).toBe('Señorío de Illescas Club de Golf & Padel');
    const illescasTotals = calculateCourseNineTotals(byIllescasId!.holes, 'yellow');
    expect(illescasTotals.outPar).toBe(35);
    expect(illescasTotals.inPar).toBe(0);
    expect(illescasTotals.totalPar).toBe(35);
    expect(illescasTotals.outMeters).toBe(2610);
    expect(illescasTotals.inMeters).toBe(0);
    expect(illescasTotals.totalMeters).toBe(2610);

    expect(getCourseById('course-inexistente-999')).toBeNull();
  });

  it('calcula correctamente los totales de Ida (OUT), Vuelta (IN) y Total de 18 hoyos para las 4 barras (white, yellow, blue, red)', () => {
    const demoCourse = getCourseById('golfapi_course_1024')!;
    const whiteTotals = calculateCourseNineTotals(demoCourse.holes, 'white');
    const yellowTotals = calculateCourseNineTotals(demoCourse.holes, 'yellow');
    const blueTotals = calculateCourseNineTotals(demoCourse.holes, 'blue');
    const redTotals = calculateCourseNineTotals(demoCourse.holes, 'red');

    expect(yellowTotals.outPar).toBe(36);
    expect(yellowTotals.inPar).toBe(36);
    expect(yellowTotals.totalPar).toBe(72);
    expect(yellowTotals.totalMeters).toBe(yellowTotals.outMeters + yellowTotals.inMeters);

    expect(whiteTotals.totalMeters).toBeGreaterThan(yellowTotals.totalMeters);
    expect(yellowTotals.totalMeters).toBeGreaterThan(blueTotals.totalMeters);
    expect(blueTotals.totalMeters).toBeGreaterThan(redTotals.totalMeters);
  });

  it('normaliza payloads crudos de proveedores externos, deduplica barras (name + gender) y rechaza valores ausentes o inválidos', () => {
    const rawPayload = {
      courseID: 'ext_999',
      courseName: 'Real Club de Prueba',
      clubName: 'Club Prueba',
      city: 'Sevilla',
      country: 'España',
      lat: 37.3891,
      lng: -5.9845,
      tees: [
        {
          teeID: 'tee-custom-1',
          teeName: 'Campeonato',
          teeColor: '#111827',
          gender: 'men' as const,
          courseRating: 72.4,
          slopeRating: 131,
          totalMeters: 3150,
        },
        {
          teeID: 'tee-custom-1-dup',
          teeName: 'campeonato',
          teeColor: '#000000',
          gender: 'men' as const,
          courseRating: 72.8,
          slopeRating: 133,
          totalMeters: 3165,
        },
      ],
      holes: Array.from({ length: 9 }, (_, i) => ({
        hole: i + 1,
        par: 4 as const,
        handicap: i + 1,
        yellowMeters: 350,
        greenFrontLat: 37.389,
        greenFrontLng: -5.984,
        greenCenterLat: 37.3891,
        greenCenterLng: -5.9841,
        greenBackLat: 37.3892,
        greenBackLng: -5.9842,
      })),
    };

    const normalized = normalizeExternalCoursePayload(rawPayload);
    expect(normalized.externalGolfApiId).toBe('ext_999');
    expect(normalized.holesCount).toBe(9);
    expect(normalized.parTotal).toBe(36);
    // Las 2 barras con el mismo (name, gender) deben deduplicarse en 1 sola
    expect(normalized.tees).toHaveLength(1);
    expect(normalized.tees[0].name).toBe('campeonato');
    expect(normalized.tees[0].slopeRating).toBe(133);

    const bundle = buildSupabaseCourseSyncBundle(rawPayload);
    expect(bundle.course.external_golf_api_id).toBe('ext_999');
    expect(bundle.tees).toHaveLength(1);
    expect(bundle.holes).toHaveLength(9);

    // Rechaza payload con campos vacíos o sin hoyos
    expect(() =>
      normalizeExternalCoursePayload({
        courseID: '',
        courseName: '',
        clubName: '',
        city: '',
        country: '',
        lat: 0,
        lng: 0,
        holes: [],
      })
    ).toThrow(/Payload de Golf API inválido/);

    // Rechaza número de hoyos distinto de 9 o 18
    expect(() =>
      normalizeExternalCoursePayload({
        ...rawPayload,
        holes: rawPayload.holes.slice(0, 5),
      })
    ).toThrow(/9 o 18 hoyos/);

    // Rechaza coordenadas GPS fuera de rango
    expect(() =>
      normalizeExternalCoursePayload({
        ...rawPayload,
        lat: 125,
      })
    ).toThrow(/coordenadas lat\/lng del campo ausentes o fuera de rango/);

    // Rechaza slopeRating fuera del rango oficial WHS (55..155)
    expect(() =>
      normalizeExternalCoursePayload({
        ...rawPayload,
        tees: [
          {
            teeID: 't-bad',
            teeName: 'Blancas',
            teeColor: '#fff',
            gender: 'men',
            courseRating: 72,
            slopeRating: 200,
            totalMeters: 6000,
          },
        ],
      })
    ).toThrow(/slopeRating o courseRating fuera de rango/);

    // Rechaza hoyos con strokeIndex duplicado
    expect(() =>
      normalizeExternalCoursePayload({
        ...rawPayload,
        holes: rawPayload.holes.map((h) => ({ ...h, handicap: 1 })),
      })
    ).toThrow(/strokeIndex\/handicap duplicado/);
  });

  it('sincroniza los hoyos de un recorrido (9 o 18 hoyos) en la caché SQLite local y lanza error si el campo no existe', async () => {
    const result18 = await syncCourseToOfflineCache('golfapi_course_1024');
    expect(result18.cachedHolesCount).toBe(18);

    const cached18 = await getCachedCourseData(result18.course.id);
    expect(cached18).toHaveLength(18);
    expect(cached18[0].holeNumber).toBe(1);
    expect(cached18[17].holeNumber).toBe(18);

    // Recorrido real de 9 hoyos de Señorío de Illescas
    const result9 = await syncCourseToOfflineCache('golfapi_course_8833');
    expect(result9.cachedHolesCount).toBe(9);

    const cached9 = await getCachedCourseData(result9.course.id);
    expect(cached9).toHaveLength(9);
    expect(cached9[0].holeNumber).toBe(1);
    expect(cached9[8].holeNumber).toBe(9);

    await expect(syncCourseToOfflineCache('id-invalido')).rejects.toThrow(
      /No se encontró el campo/
    );
  });

  it('verifica que la Edge Function sync-golf-course comparte el normalizador único y ejecuta el RPC transaccional sync_golf_course_atomic', () => {
    const edgeFnPath = path.resolve(
      process.cwd(),
      'supabase/functions/sync-golf-course/index.ts'
    );
    expect(fs.existsSync(edgeFnPath)).toBe(true);

    const source = fs.readFileSync(edgeFnPath, 'utf-8');
    expect(source).toContain("userRole !== 'club_admin'");
    expect(source).toContain("userRole !== 'superadmin'");
    expect(source).toContain('../../../src/lib/golf-api/normalizer.ts');
    expect(source).toContain('buildSupabaseCourseSyncBundle');
    expect(source).toContain("'sync_golf_course_atomic'");
  });
});
