import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { SQLiteConnection } from '@capacitor-community/sqlite';
import capacitorConfig from '../../../../capacitor.config';
import {
  calculateDistanceMeters,
  calculateGreenDistances,
  getCurrentGpsPosition,
  getCurrentPosition,
  metersToYards,
  watchPosition,
} from '../geolocation';
import {
  cacheCourseData,
  cacheCourseHoles,
  clearOfflineStore,
  getCachedCourseData,
  getCachedCourseHoles,
  getOfflineRoundScores,
  getPendingSyncScores,
  initOfflineDatabase,
  markScoreAsSynced,
  saveOfflineHoleScore,
} from '../sqlite';
import { detectPushPlatform, registerForPushNotifications } from '../push';

describe('Capacitor Config & Wrappers Nativos (Geolocation, SQLite Offline, Push)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearOfflineStore();
  });

  it('parametriza capacitor.config.ts con webDir="out" y los plugins nativos requeridos', () => {
    expect(capacitorConfig.webDir).toBe('out');
    expect(capacitorConfig.appId).toMatch(/^com\.birdie\./);
    expect(capacitorConfig.plugins?.PushNotifications).toBeDefined();
    expect(capacitorConfig.plugins?.CapacitorSQLite).toBeDefined();
  });

  it('calcula distancias GPS exactas a frente, centro y fondo de green en metros y yardas', async () => {
    const teeHoyo1 = { lat: 40.4682, lng: -3.7815 };
    const greenHoyo1 = {
      front: { lat: 40.46911, lng: -3.78021 },
      center: { lat: 40.46922, lng: -3.78015 },
      back: { lat: 40.46933, lng: -3.78009 },
    };

    const dFront = calculateDistanceMeters(teeHoyo1, greenHoyo1.front);
    expect(dFront).toBeGreaterThan(130);
    expect(dFront).toBeLessThan(170);
    expect(metersToYards(100)).toBe(109);

    const distances = calculateGreenDistances(teeHoyo1, greenHoyo1);
    expect(distances.frontMeters).toBeLessThan(distances.centerMeters);
    expect(distances.centerMeters).toBeLessThan(distances.backMeters);
    expect(distances.centerYards).toBeGreaterThan(distances.centerMeters);

    const pos = await getCurrentGpsPosition(teeHoyo1);
    expect(pos.lat).toBe(teeHoyo1.lat);
    expect(pos.source).toBe('simulated');

    const aliasPos = await getCurrentPosition(teeHoyo1);
    expect(aliasPos.lng).toBe(teeHoyo1.lng);

    let watchedCoord = { lat: 0, lng: 0 };
    const stopWatch = await watchPosition((updated) => {
      watchedCoord = { lat: updated.lat, lng: updated.lng };
    }, teeHoyo1);
    expect(watchedCoord).toEqual(teeHoyo1);
    await stopWatch();
  });

  it('persiste golpes de marcador offline, incrementa revision en cada edición, verifica expectedRevision y cachea hoyos', async () => {
    const dbInit = await initOfflineDatabase();
    expect(dbInit.backend).toBe('web-fallback');

    const firstSave = await saveOfflineHoleScore({
      roundId: 'round-1',
      playerId: 'player-1',
      holeNumber: 1,
      strokes: 4,
      putts: 2,
      fairwayHit: true,
      greenInRegulation: true,
      stablefordPoints: 2,
    });
    expect(firstSave.revision).toBe(1);

    // Editar el mismo hoyo incrementa revision a 2
    const secondSave = await saveOfflineHoleScore({
      roundId: 'round-1',
      playerId: 'player-1',
      holeNumber: 1,
      strokes: 5,
      putts: 2,
      fairwayHit: false,
      greenInRegulation: false,
      stablefordPoints: 1,
    });
    expect(secondSave.revision).toBe(2);

    // Una respuesta tardía de la revisión 1 NO debe marcar como sincronizada la revisión 2
    const staleMarked = await markScoreAsSynced('round-1', 'player-1', 1, 1);
    expect(staleMarked).toBe(false);

    const stillPending = await getPendingSyncScores();
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0].revision).toBe(2);

    // Confirmar con la revisión actual (2) sí marca como synced
    const currentMarked = await markScoreAsSynced('round-1', 'player-1', 1, 2);
    expect(currentMarked).toBe(true);

    const pendingAfter = await getPendingSyncScores();
    expect(pendingAfter).toHaveLength(0);

    await cacheCourseHoles('course-1', [
      {
        courseId: 'course-1',
        holeNumber: 1,
        par: 4,
        strokeIndex: 11,
        distanceYellowMeters: 352,
        greenFrontLat: 40.46911,
        greenFrontLng: -3.78021,
        greenCenterLat: 40.46922,
        greenCenterLng: -3.78015,
        greenBackLat: 40.46933,
        greenBackLng: -3.78009,
      },
    ]);

    const cachedHoles = await getCachedCourseHoles('course-1');
    expect(cachedHoles).toHaveLength(1);
    expect(cachedHoles[0].par).toBe(4);

    await cacheCourseData('course-2', cachedHoles);
    const cachedData = await getCachedCourseData('course-2');
    expect(cachedData).toHaveLength(1);
  });

  it('conecta initOfflineDatabase y todas las operaciones CRUD con la conexión SQLite nativa en Android', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

    const executedSql: string[] = [];
    const runCalls: Array<{ sql: string; params: unknown[] }> = [];
    const storedRows = new Map<string, Record<string, unknown>>();

    const fakeNativeDb = {
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockImplementation(async (sql: string) => {
        executedSql.push(sql);
        return { changes: { changes: 1 } };
      }),
      query: vi.fn().mockImplementation(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT revision FROM local_hole_scores')) {
          const key = `${params[0]}::${params[1]}::${params[2]}`;
          const row = storedRows.get(key);
          return { values: row ? [{ revision: row.revision }] : [] };
        }
        if (sql.includes('FROM local_hole_scores')) {
          const rows = Array.from(storedRows.values()).filter((r) => {
            if (sql.includes("sync_status = 'pending'")) {
              return r.sync_status === 'pending';
            }
            return r.round_id === params[0];
          });
          return { values: rows };
        }
        return { values: [] };
      }),
      run: vi.fn().mockImplementation(async (sql: string, params: unknown[] = []) => {
        runCalls.push({ sql, params });
        if (sql.includes('INSERT INTO local_hole_scores')) {
          const key = `${params[0]}::${params[1]}::${params[2]}`;
          storedRows.set(key, {
            round_id: params[0],
            player_id: params[1],
            hole_number: params[2],
            strokes: params[3],
            putts: params[4],
            fairway_hit: params[5],
            green_in_regulation: params[6],
            sand_save: params[7],
            penalty_strokes: params[8],
            stableford_points: params[9],
            sync_status: 'pending',
            revision: params[10],
            updated_at: params[11],
          });
          return { changes: { changes: 1 } };
        }
        if (sql.includes("UPDATE local_hole_scores SET sync_status = 'synced'")) {
          const key = `${params[1]}::${params[2]}::${params[3]}`;
          const existing = storedRows.get(key);
          if (!existing || (params[4] !== undefined && existing.revision !== params[4])) {
            return { changes: { changes: 0 } };
          }
          existing.sync_status = 'synced';
          return { changes: { changes: 1 } };
        }
        return { changes: { changes: 1 } };
      }),
    };

    vi.spyOn(SQLiteConnection.prototype, 'createConnection').mockResolvedValue(
      fakeNativeDb as never
    );

    const initRes = await initOfflineDatabase();
    expect(initRes.backend).toBe('sqlite-native');
    expect(executedSql[0]).toContain('CREATE TABLE IF NOT EXISTS local_hole_scores');
    expect(executedSql[0]).toContain('CREATE TABLE IF NOT EXISTS local_course_holes');

    const saved = await saveOfflineHoleScore({
      roundId: 'native-round-1',
      playerId: 'native-player-1',
      holeNumber: 1,
      strokes: 4,
      putts: 2,
      fairwayHit: true,
      greenInRegulation: true,
      stablefordPoints: 3,
    });
    expect(saved.revision).toBe(1);
    expect(runCalls.some((c) => c.sql.includes('INSERT INTO local_hole_scores'))).toBe(
      true
    );

    const roundScores = await getOfflineRoundScores('native-round-1', 'native-player-1');
    expect(roundScores).toHaveLength(1);
    expect(roundScores[0].strokes).toBe(4);

    // Intento con revisión obsoleta (99) falla en SQLite nativo
    const wrongRev = await markScoreAsSynced(
      'native-round-1',
      'native-player-1',
      1,
      99
    );
    expect(wrongRev).toBe(false);

    // Intento con revisión exacta (1) marca como synced en SQLite nativo
    const rightRev = await markScoreAsSynced(
      'native-round-1',
      'native-player-1',
      1,
      1
    );
    expect(rightRev).toBe(true);

    const pendingAfter = await getPendingSyncScores();
    expect(pendingAfter).toHaveLength(0);
  });

  it('valida rangos de hoyos y golpes en el marcador offline', async () => {
    await expect(
      saveOfflineHoleScore({
        roundId: 'round-1',
        playerId: 'player-1',
        holeNumber: 19,
        strokes: 4,
        putts: 2,
        fairwayHit: true,
        greenInRegulation: true,
        stablefordPoints: 2,
      })
    ).rejects.toThrow(/holeNumber debe estar entre 1 y 18/);
  });

  it('registra token de notificaciones push en modo fallback web', async () => {
    expect(detectPushPlatform()).toBe('web');
    const reg = await registerForPushNotifications('pinos-golf');
    expect(reg.platform).toBe('web');
    expect(reg.token).toContain('pinos-golf');
  });
});
