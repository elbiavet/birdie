import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
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

  it('contiene recorridos completos de 18 hoyos con coordenadas GPS de frente, centro y fondo de green', () => {
    expect(GOLF_API_COURSES_CATALOG.length).toBeGreaterThanOrEqual(3);

    for (const course of GOLF_API_COURSES_CATALOG) {
      expect(course.holes).toHaveLength(18);
      expect(course.tees.length).toBeGreaterThanOrEqual(2);

      // Verificar que los strokeIndex 1..18 son únicos en cada campo
      const strokeIndexes = new Set(course.holes.map((h) => h.strokeIndex));
      expect(strokeIndexes.size).toBe(18);

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

    const pinosMatches = searchCourses('pinos');
    expect(pinosMatches).toHaveLength(1);
    expect(pinosMatches[0].city).toBe('Marbella');

    const byExternal = getCourseById('golfapi_course_2048');
    expect(byExternal).not.toBeNull();
    expect(byExternal?.clubName).toContain('Pinos');
    expect(byExternal?.name).toContain('Links del Mar');

    const byInternalId = getCourseById('11111111-1111-1111-1111-111111111101');
    expect(byInternalId?.externalGolfApiId).toBe('golfapi_course_1024');

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

  it('normaliza payloads crudos de proveedores externos con o sin barras explícitas y rechaza payloads inválidos', () => {
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
    expect(normalized.tees).toHaveLength(1);
    expect(normalized.tees[0].name).toBe('Campeonato');
    expect(normalized.tees[0].slopeRating).toBe(131);

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
  });

  it('sincroniza los 18 hoyos de un recorrido en la caché SQLite local y lanza error si el campo no existe', async () => {
    const result = await syncCourseToOfflineCache('golfapi_course_1024');
    expect(result.cachedHolesCount).toBe(18);

    const cachedHoles = await getCachedCourseData(result.course.id);
    expect(cachedHoles).toHaveLength(18);
    expect(cachedHoles[0].holeNumber).toBe(1);
    expect(cachedHoles[17].holeNumber).toBe(18);

    await expect(syncCourseToOfflineCache('id-invalido')).rejects.toThrow(
      /No se encontró el campo/
    );
  });

  it('verifica que la Edge Function sync-golf-course valida roles club_admin/superadmin y hace upsert en courses, course_tees y course_holes', () => {
    const edgeFnPath = path.resolve(
      process.cwd(),
      'supabase/functions/sync-golf-course/index.ts'
    );
    expect(fs.existsSync(edgeFnPath)).toBe(true);

    const source = fs.readFileSync(edgeFnPath, 'utf-8');
    expect(source).toContain("userRole !== 'club_admin'");
    expect(source).toContain("userRole !== 'superadmin'");
    expect(source).toContain(".from('courses')");
    expect(source).toContain(".from('course_tees')");
    expect(source).toContain(".from('course_holes')");
    expect(source).toContain('onConflict: \'course_id,hole_number\'');
  });
});
