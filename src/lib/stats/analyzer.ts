export interface AnalyzedHoleSample {
  roundId: string;
  playedDate: string;
  holeNumber: number;
  par: 3 | 4 | 5;
  strokes: number;
  putts: number;
  fairwayHit: boolean | null;
  greenInRegulation: boolean;
  sandSave: boolean | null;
  stablefordPoints: number;
}

export interface ScoreDistributionBreakdown {
  eaglesOrBetter: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeysOrWorse: number;
}

export interface PlayerPerformanceStatistics {
  roundsCount: number;
  holesCount: number;
  averageGrossPer18: number;
  averageStablefordPer18: number;
  averagePuttsPerHole: number;
  averagePuttsPer18: number;
  averagePuttsOnGir: number;
  fairwayHitPercentage: number;
  girPercentage: number;
  scramblingPercentage: number;
  sandSavePercentage: number;
  par3AverageStrokes: number;
  par4AverageStrokes: number;
  par5AverageStrokes: number;
  distribution: ScoreDistributionBreakdown;
}

/**
 * Calcula las estadísticas deportivas agregadas de un jugador a partir de sus hoyos jugados:
 * - FIR % (Calles cogidas en hoyos Par 4 y Par 5)
 * - GIR % (Greenes en regulación)
 * - Scrambling % (Porcentaje de hoyos donde NO se cogió GIR pero se logró Par o mejor)
 * - Putts por hoyo, por vuelta de 18 hoyos y Putts en GIR
 * - Media de golpes en Par 3, Par 4 y Par 5
 * - Distribución de resultados (Eagles+, Birdies, Pares, Bogeys, Doble Bogey+)
 */
export function computePlayerStatistics(
  samples: AnalyzedHoleSample[]
): PlayerPerformanceStatistics {
  const valid = samples.filter((s) => s.strokes > 0);
  if (valid.length === 0) {
    return {
      roundsCount: 0,
      holesCount: 0,
      averageGrossPer18: 0,
      averageStablefordPer18: 0,
      averagePuttsPerHole: 0,
      averagePuttsPer18: 0,
      averagePuttsOnGir: 0,
      fairwayHitPercentage: 0,
      girPercentage: 0,
      scramblingPercentage: 0,
      sandSavePercentage: 0,
      par3AverageStrokes: 0,
      par4AverageStrokes: 0,
      par5AverageStrokes: 0,
      distribution: {
        eaglesOrBetter: 0,
        birdies: 0,
        pars: 0,
        bogeys: 0,
        doubleBogeysOrWorse: 0,
      },
    };
  }

  const uniqueRoundIds = new Set(valid.map((s) => s.roundId));
  const holesCount = valid.length;

  const totalStrokes = valid.reduce((acc, s) => acc + s.strokes, 0);
  const totalStableford = valid.reduce((acc, s) => acc + s.stablefordPoints, 0);
  const totalPutts = valid.reduce((acc, s) => acc + s.putts, 0);

  const averageGrossPer18 = Number(((totalStrokes / holesCount) * 18).toFixed(1));
  const averageStablefordPer18 = Number(
    ((totalStableford / holesCount) * 18).toFixed(1)
  );
  const averagePuttsPerHole = Number((totalPutts / holesCount).toFixed(2));
  const averagePuttsPer18 = Number(((totalPutts / holesCount) * 18).toFixed(1));

  // FIR % (solo Par 4 y Par 5 con dato de calle)
  const firEligible = valid.filter((s) => s.par >= 4 && s.fairwayHit !== null);
  const firHit = firEligible.filter((s) => s.fairwayHit === true).length;
  const fairwayHitPercentage =
    firEligible.length > 0
      ? Number(((firHit / firEligible.length) * 100).toFixed(1))
      : 0;

  // GIR %
  const girHoles = valid.filter((s) => s.greenInRegulation);
  const girPercentage = Number(((girHoles.length / holesCount) * 100).toFixed(1));

  // Putts en GIR
  const averagePuttsOnGir =
    girHoles.length > 0
      ? Number(
          (
            girHoles.reduce((acc, s) => acc + s.putts, 0) / girHoles.length
          ).toFixed(2)
        )
      : 0;

  // Scrambling % (Hoyos sin GIR donde strokes <= par)
  const missedGirHoles = valid.filter((s) => !s.greenInRegulation);
  const scrambledCount = missedGirHoles.filter((s) => s.strokes <= s.par).length;
  const scramblingPercentage =
    missedGirHoles.length > 0
      ? Number(((scrambledCount / missedGirHoles.length) * 100).toFixed(1))
      : 0;

  // Sand Save %
  const sandEligible = valid.filter((s) => s.sandSave !== null);
  const sandSaved = sandEligible.filter((s) => s.sandSave === true).length;
  const sandSavePercentage =
    sandEligible.length > 0
      ? Number(((sandSaved / sandEligible.length) * 100).toFixed(1))
      : 0;

  // Media por Par 3, Par 4 y Par 5
  const avgByPar = (targetPar: 3 | 4 | 5): number => {
    const matching = valid.filter((s) => s.par === targetPar);
    if (matching.length === 0) return 0;
    const sum = matching.reduce((acc, s) => acc + s.strokes, 0);
    return Number((sum / matching.length).toFixed(2));
  };

  const distribution: ScoreDistributionBreakdown = {
    eaglesOrBetter: 0,
    birdies: 0,
    pars: 0,
    bogeys: 0,
    doubleBogeysOrWorse: 0,
  };

  for (const s of valid) {
    const diff = s.strokes - s.par;
    if (diff <= -2) {
      distribution.eaglesOrBetter += 1;
    } else if (diff === -1) {
      distribution.birdies += 1;
    } else if (diff === 0) {
      distribution.pars += 1;
    } else if (diff === 1) {
      distribution.bogeys += 1;
    } else {
      distribution.doubleBogeysOrWorse += 1;
    }
  }

  return {
    roundsCount: uniqueRoundIds.size,
    holesCount,
    averageGrossPer18,
    averageStablefordPer18,
    averagePuttsPerHole,
    averagePuttsPer18,
    averagePuttsOnGir,
    fairwayHitPercentage,
    girPercentage,
    scramblingPercentage,
    sandSavePercentage,
    par3AverageStrokes: avgByPar(3),
    par4AverageStrokes: avgByPar(4),
    par5AverageStrokes: avgByPar(5),
    distribution,
  };
}

/**
 * Muestra semilla de 2 vueltas históricas completas (36 hoyos) para combinar con
 * los hoyos registrados en vivo en SQLite durante la sesión.
 */
export const DEMO_HISTORICAL_HOLE_SAMPLES: AnalyzedHoleSample[] = [
  // Ronda histórica 1 (18 hoyos)
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 1, par: 4, strokes: 4, putts: 2, fairwayHit: true, greenInRegulation: true, sandSave: null, stablefordPoints: 3 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 2, par: 5, strokes: 5, putts: 2, fairwayHit: true, greenInRegulation: true, sandSave: null, stablefordPoints: 3 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 3, par: 3, strokes: 3, putts: 2, fairwayHit: null, greenInRegulation: true, sandSave: null, stablefordPoints: 2 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 4, par: 4, strokes: 5, putts: 2, fairwayHit: false, greenInRegulation: false, sandSave: false, stablefordPoints: 2 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 5, par: 4, strokes: 4, putts: 1, fairwayHit: true, greenInRegulation: false, sandSave: true, stablefordPoints: 3 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 6, par: 3, strokes: 4, putts: 2, fairwayHit: null, greenInRegulation: false, sandSave: null, stablefordPoints: 1 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 7, par: 5, strokes: 4, putts: 1, fairwayHit: true, greenInRegulation: true, sandSave: null, stablefordPoints: 4 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 8, par: 4, strokes: 5, putts: 2, fairwayHit: false, greenInRegulation: false, sandSave: null, stablefordPoints: 2 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 9, par: 4, strokes: 4, putts: 2, fairwayHit: true, greenInRegulation: true, sandSave: null, stablefordPoints: 3 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 10, par: 4, strokes: 4, putts: 2, fairwayHit: true, greenInRegulation: true, sandSave: null, stablefordPoints: 3 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 11, par: 3, strokes: 3, putts: 2, fairwayHit: null, greenInRegulation: true, sandSave: null, stablefordPoints: 2 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 12, par: 5, strokes: 6, putts: 2, fairwayHit: true, greenInRegulation: false, sandSave: null, stablefordPoints: 2 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 13, par: 4, strokes: 4, putts: 1, fairwayHit: false, greenInRegulation: false, sandSave: true, stablefordPoints: 3 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 14, par: 4, strokes: 5, putts: 2, fairwayHit: true, greenInRegulation: false, sandSave: null, stablefordPoints: 2 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 15, par: 3, strokes: 2, putts: 1, fairwayHit: null, greenInRegulation: true, sandSave: null, stablefordPoints: 3 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 16, par: 5, strokes: 5, putts: 2, fairwayHit: true, greenInRegulation: true, sandSave: null, stablefordPoints: 3 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 17, par: 4, strokes: 6, putts: 3, fairwayHit: false, greenInRegulation: false, sandSave: false, stablefordPoints: 1 },
  { roundId: 'hist-round-01', playedDate: '2026-10-12', holeNumber: 18, par: 4, strokes: 4, putts: 2, fairwayHit: true, greenInRegulation: true, sandSave: null, stablefordPoints: 3 },
];
