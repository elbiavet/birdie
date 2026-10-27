import { beforeEach, describe, expect, it } from 'vitest';
import capacitorConfig from '../../../../capacitor.config';
import {
  calculateDistanceMeters,
  calculateGreenDistances,
  getCurrentGpsPosition,
  metersToYards,
} from '../geolocation';
import {
  cacheCourseHoles,
  clearOfflineStore,
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
  });

  it('persiste golpes de marcador offline, gestiona la cola pending->synced y cachea hoyos', async () => {
    const dbInit = await initOfflineDatabase();
    expect(dbInit.backend).toBe('web-fallback');

    await saveOfflineHoleScore({
      roundId: 'round-1',
      playerId: 'player-1',
      holeNumber: 1,
      strokes: 4,
      putts: 2,
      fairwayHit: true,
      greenInRegulation: true,
      stablefordPoints: 2,
    });

    await saveOfflineHoleScore({
      roundId: 'round-1',
      playerId: 'player-1',
      holeNumber: 2,
      strokes: 5,
      putts: 2,
      fairwayHit: false,
      greenInRegulation: false,
      stablefordPoints: 2,
    });

    const roundScores = await getOfflineRoundScores('round-1', 'player-1');
    expect(roundScores).toHaveLength(2);
    expect(roundScores[0].holeNumber).toBe(1);
    expect(roundScores[0].syncStatus).toBe('pending');

    const pendingBefore = await getPendingSyncScores();
    expect(pendingBefore).toHaveLength(2);

    const marked = await markScoreAsSynced('round-1', 'player-1', 1);
    expect(marked).toBe(true);

    const pendingAfter = await getPendingSyncScores();
    expect(pendingAfter).toHaveLength(1);
    expect(pendingAfter[0].holeNumber).toBe(2);

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
