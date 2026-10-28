import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateHoleStablefordPoints,
  calculateStrokesReceivedOnHole,
  classifyGrossScoreToPar,
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

  it('reparte exactamente los golpes de Playing Handicap en 18 y 9 hoyos y valida strokeIndex fuera de rango', () => {
    // Jugador con Playing Handicap 18 recibe 1 golpe en todos los hoyos (SI 1..18)
    for (let si = 1; si <= 18; si++) {
      expect(calculateStrokesReceivedOnHole(18, si, 18)).toBe(1);
    }

    // Jugador con Playing Handicap 22 recibe 2 golpes en SI 1..4 y 1 golpe en SI 5..18
    expect(calculateStrokesReceivedOnHole(22, 1, 18)).toBe(2);
    expect(calculateStrokesReceivedOnHole(22, 4, 18)).toBe(2);
    expect(calculateStrokesReceivedOnHole(22, 5, 18)).toBe(1);
    expect(calculateStrokesReceivedOnHole(22, 18, 18)).toBe(1);

    // Modo 9 hoyos: Playing Handicap 11 -> 1 golpe base + 1 extra en los 2 primeros hoyos de 9 (SI 1..4)
    expect(calculateStrokesReceivedOnHole(11, 1, 9)).toBe(2);
    expect(calculateStrokesReceivedOnHole(11, 5, 9)).toBe(1);

    // Jugador scratch (0) recibe 0 golpes
    expect(calculateStrokesReceivedOnHole(0, 1, 18)).toBe(0);

    // Jugador con hándicap plus (-2) cede golpe en los hoyos más fáciles (SI 18 y 17)
    expect(calculateStrokesReceivedOnHole(-2, 18, 18)).toBe(-1);
    expect(calculateStrokesReceivedOnHole(-2, 17, 18)).toBe(-1);
    expect(calculateStrokesReceivedOnHole(-2, 1, 18)).toBe(0);

    // Validación de rango de Stroke Index
    expect(() => calculateStrokesReceivedOnHole(10, 0, 18)).toThrow(/Stroke Index inválido/);
    expect(() => calculateStrokesReceivedOnHole(10, 19, 18)).toThrow(/Stroke Index inválido/);
  });

  it('calcula puntos Stableford WHS y clasifica todas las etiquetas respecto al Par (classifyGrossScoreToPar)', () => {
    // Hoyo Par 4, jugador recibe 1 golpe:
    expect(calculateHoleStablefordPoints(4, 4, 1)).toBe(3);
    expect(calculateHoleStablefordPoints(5, 4, 1)).toBe(2);
    expect(calculateHoleStablefordPoints(6, 4, 1)).toBe(1);
    expect(calculateHoleStablefordPoints(7, 4, 1)).toBe(0);
    expect(calculateHoleStablefordPoints(0, 4, 1)).toBe(0);

    // Clasificación completa de etiquetas
    expect(classifyGrossScoreToPar(2, 5)).toBe('Albatross');
    expect(classifyGrossScoreToPar(3, 5)).toBe('Eagle');
    expect(classifyGrossScoreToPar(3, 4)).toBe('Birdie');
    expect(classifyGrossScoreToPar(4, 4)).toBe('Par');
    expect(classifyGrossScoreToPar(5, 4)).toBe('Bogey');
    expect(classifyGrossScoreToPar(6, 4)).toBe('Double Bogey');
    expect(classifyGrossScoreToPar(8, 4)).toBe('Triple+');
  });

  it('resume una tarjeta de 18 hoyos y maneja tarjeta vacía sin dividir por cero', () => {
    const course = getCourseById('golfapi_course_1024')!;

    const emptySummary = summarizeRoundScorecard(course.holes, [], 18);
    expect(emptySummary.holesPlayed).toBe(0);
    expect(emptySummary.fairwayHitPercentage).toBe(0);
    expect(emptySummary.girPercentage).toBe(0);

    const scores = course.holes.map((h) => ({
      holeNumber: h.holeNumber,
      strokes: h.par,
      putts: 2,
      fairwayHit: h.par >= 4 ? true : null,
      greenInRegulation: true,
      sandSave: null,
      penaltyStrokes: 0,
    }));

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

  it('persiste hoyos offline-first en SQLite, conserva pendientes ante fallos parciales de red y vacía la cola al recuperar conexión', async () => {
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
    expect(h1.stablefordPoints).toBe(3);

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

    // Simular fallo de red en el hoyo 2 durante el primer intento de vaciado
    const partialFlush = await flushPendingScoresToSupabase(async (score) => ({
      ok: score.holeNumber === 1,
      error: score.holeNumber === 2 ? 'Timeout de red' : undefined,
    }));
    expect(partialFlush.status).toBe('partial_or_failed');
    expect(partialFlush.attemptedCount).toBe(2);
    expect(partialFlush.syncedCount).toBe(1);
    expect(partialFlush.remainingPendingCount).toBe(1);

    // Si no se pasa uploader personalizado y no hay credenciales reales de Supabase, NO marca sincronización ficticia
    const unconfiguredFlush = await flushPendingScoresToSupabase();
    expect(unconfiguredFlush.status).toBe('skipped_unconfigured');
    expect(unconfiguredFlush.syncedCount).toBe(0);
    expect(unconfiguredFlush.remainingPendingCount).toBe(1);

    // Segundo intento con uploader confirmado hacia Supabase vacía el pendiente restante
    const finalFlush = await flushPendingScoresToSupabase(async () => ({
      ok: true,
    }));
    expect(finalFlush.status).toBe('synced');
    expect(finalFlush.attemptedCount).toBe(1);
    expect(finalFlush.syncedCount).toBe(1);
    expect(finalFlush.remainingPendingCount).toBe(0);

    const storedRound = await getOfflineRoundScores(roundId, playerId);
    expect(storedRound).toHaveLength(2);
    expect(storedRound.every((s) => s.syncStatus === 'synced')).toBe(true);
  });

  it('calcula correctamente rondas de 9 hoyos en recordHoleScoreOfflineFirst y protege la cola contra vaciados concurrentes y revisiones obsoletas', async () => {
    const roundId = 'round-9holes-concurrency';
    const playerId = 'player-demo-09';

    // Ronda de 9 hoyos: Playing Handicap 11 en SI 1 recibe 2 golpes (1 base + 1 extra en los 2 primeros hoyos de los 9 jugados)
    const nineHoleScore = await recordHoleScoreOfflineFirst({
      roundId,
      playerId,
      holeNumber: 1,
      par: 4,
      strokeIndex: 1,
      playingHandicap: 11,
      holesCount: 9,
      strokes: 4,
      putts: 2,
    });
    expect(nineHoleScore.strokes).toBe(4);
    expect(nineHoleScore.stablefordPoints).toBe(4);
    expect(nineHoleScore.revision).toBe(1);

    // 1. Prueba de mutex en vaciados concurrentes: dos llamadas simultáneas comparten la misma ejecución en vuelo
    let uploaderCallCount = 0;
    const slowUploader = async () => {
      uploaderCallCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { ok: true };
    };

    const [flushA, flushB] = await Promise.all([
      flushPendingScoresToSupabase(slowUploader),
      flushPendingScoresToSupabase(slowUploader),
    ]);

    expect(uploaderCallCount).toBe(1);
    expect(flushA.syncedCount).toBe(1);
    expect(flushB.syncedCount).toBe(1);

    // 2. Prueba de control de versiones (revision): si el jugador edita el hoyo mientras se envía la revisión anterior, no se marca como 'synced'
    const editV2 = await recordHoleScoreOfflineFirst({
      roundId,
      playerId,
      holeNumber: 1,
      par: 4,
      strokeIndex: 1,
      playingHandicap: 11,
      holesCount: 9,
      strokes: 5,
      putts: 2,
    });
    expect(editV2.revision).toBe(2);
    expect(editV2.syncStatus).toBe('pending');

    const staleFlush = await flushPendingScoresToSupabase(async (snapshot) => {
      expect(snapshot.revision).toBe(2);
      // Mientras el envío de revision=2 está en vuelo, el usuario corrige el golpe a 6 (revision=3)
      await recordHoleScoreOfflineFirst({
        roundId,
        playerId,
        holeNumber: 1,
        par: 4,
        strokeIndex: 1,
        playingHandicap: 11,
        holesCount: 9,
        strokes: 6,
        putts: 3,
      });
      return { ok: true };
    });

    expect(staleFlush.syncedCount).toBe(0);
    expect(staleFlush.remainingPendingCount).toBe(1);

    const afterStale = await getOfflineRoundScores(roundId, playerId);
    expect(afterStale[0].strokes).toBe(6);
    expect(afterStale[0].revision).toBe(3);
    expect(afterStale[0].syncStatus).toBe('pending');
  });
});
