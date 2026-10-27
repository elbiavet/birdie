import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateHoleStablefordPoints,
  calculateStrokesReceivedOnHole,
  summarizeRoundScorecard,
} from '../engine';
import {
  flushPendingScoresToSupabase,
  getOfflineRoundScores,
  getSyncQueueState,
  recordHoleScoreOfflineFirst,
} from '@/lib/offline-sync';
import { clearOfflineStore } from '@/lib/capacitor/sqlite';
import { getCourseById } from '@/lib/golf-api';

describe('Motor Matemático de Golf (Stableford / WHS) y Cola Offline (Subfase 2.3)', () => {
  beforeEach(async () => {
    await clearOfflineStore();
  });

  it('reparte exactamente los golpes de Playing Handicap según el Stroke Index (1..18)', () => {
    // Jugador con Playing Handicap 18 recibe 1 golpe en todos los hoyos (SI 1..18)
    for (let si = 1; si <= 18; si++) {
      expect(calculateStrokesReceivedOnHole(18, si, 18)).toBe(1);
    }

    // Jugador con Playing Handicap 22 recibe 2 golpes en SI 1..4 y 1 golpe en SI 5..18
    expect(calculateStrokesReceivedOnHole(22, 1, 18)).toBe(2);
    expect(calculateStrokesReceivedOnHole(22, 4, 18)).toBe(2);
    expect(calculateStrokesReceivedOnHole(22, 5, 18)).toBe(1);
    expect(calculateStrokesReceivedOnHole(22, 18, 18)).toBe(1);

    // Jugador scratch (0) recibe 0 golpes
    expect(calculateStrokesReceivedOnHole(0, 1, 18)).toBe(0);

    // Jugador con hándicap plus (-2) cede golpe en los hoyos más fáciles (SI 18 y 17)
    expect(calculateStrokesReceivedOnHole(-2, 18, 18)).toBe(-1);
    expect(calculateStrokesReceivedOnHole(-2, 17, 18)).toBe(-1);
    expect(calculateStrokesReceivedOnHole(-2, 1, 18)).toBe(0);
  });

  it('calcula puntos Stableford WHS para distintos resultados brutos y golpes recibidos', () => {
    // Hoyo Par 4, jugador recibe 1 golpe:
    // - Hace 4 brutos (3 netos = Birdie neto) -> 3 pts Stableford
    expect(calculateHoleStablefordPoints(4, 4, 1)).toBe(3);
    // - Hace 5 brutos (4 netos = Par neto) -> 2 pts Stableford
    expect(calculateHoleStablefordPoints(5, 4, 1)).toBe(2);
    // - Hace 6 brutos (5 netos = Bogey neto) -> 1 pt Stableford
    expect(calculateHoleStablefordPoints(6, 4, 1)).toBe(1);
    // - Hace 7 brutos (6 netos = Doble Bogey neto) -> 0 pts Stableford
    expect(calculateHoleStablefordPoints(7, 4, 1)).toBe(0);
    // - Raya / 0 golpes -> 0 pts
    expect(calculateHoleStablefordPoints(0, 4, 1)).toBe(0);
  });

  it('resume una tarjeta de 18 hoyos con golpes brutos, netos, Stableford y porcentajes FIR/GIR', () => {
    const course = getCourseById('golfapi_course_1024')!;
    const scores = course.holes.map((h) => ({
      holeNumber: h.holeNumber,
      strokes: h.par, // Juega al par bruto en los 18 hoyos (72 golpes)
      putts: 2,
      fairwayHit: h.par >= 4 ? true : null,
      greenInRegulation: true,
      sandSave: null,
      penaltyStrokes: 0,
    }));

    // Playing Handicap 18 -> recibe 1 golpe por hoyo -> hace Birdie neto (3 pts) en cada hoyo = 54 pts
    const summary = summarizeRoundScorecard(course.holes, scores, 18);

    expect(summary.holesPlayed).toBe(18);
    expect(summary.outGrossStrokes).toBe(36);
    expect(summary.inGrossStrokes).toBe(36);
    expect(summary.totalGrossStrokes).toBe(72);
    expect(summary.totalNetStrokes).toBe(54);
    expect(summary.totalStablefordPoints).toBe(54);
    expect(summary.totalPutts).toBe(36);
    expect(summary.fairwayHitPercentage).toBe(100);
    expect(summary.girPercentage).toBe(100);
  });

  it('persiste hoyos offline-first en SQLite con estado pending y vacía la cola hacia Supabase', async () => {
    const roundId = 'round-offline-2026';
    const playerId = 'player-demo-01';

    const h1 = await recordHoleScoreOfflineFirst({
      roundId,
      playerId,
      holeNumber: 1,
      par: 4,
      strokeIndex: 11,
      playingHandicap: 14,
      strokes: 4,
      putts: 2,
      fairwayHit: true,
      greenInRegulation: true,
    });

    expect(h1.syncStatus).toBe('pending');
    expect(h1.stablefordPoints).toBe(3); // SI 11 <= 14 -> 1 golpe recibido -> 3 netos en Par 4 = 3 pts

    await recordHoleScoreOfflineFirst({
      roundId,
      playerId,
      holeNumber: 2,
      par: 5,
      strokeIndex: 3,
      playingHandicap: 14,
      strokes: 6,
      putts: 2,
      fairwayHit: false,
      greenInRegulation: false,
    });

    const queueBefore = await getSyncQueueState();
    expect(queueBefore.pendingCount).toBe(2);

    const flushResult = await flushPendingScoresToSupabase();
    expect(flushResult.attemptedCount).toBe(2);
    expect(flushResult.syncedCount).toBe(2);
    expect(flushResult.remainingPendingCount).toBe(0);

    const storedRound = await getOfflineRoundScores(roundId, playerId);
    expect(storedRound).toHaveLength(2);
    expect(storedRound.every((s) => s.syncStatus === 'synced')).toBe(true);
  });
});
