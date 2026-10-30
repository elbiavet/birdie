import type { GolfApiHole } from '@/lib/golf-api/types';

export interface HoleScoreInput {
  holeNumber: number;
  strokes: number;
  putts: number;
  fairwayHit: boolean | null;
  greenInRegulation: boolean;
  sandSave: boolean | null;
  penaltyStrokes: number;
}

export interface ComputedHoleScore extends HoleScoreInput {
  par: number;
  strokeIndex: number;
  strokesReceived: number;
  netStrokes: number;
  stablefordPoints: number;
  scoreToParLabel:
    | 'Albatross'
    | 'Eagle'
    | 'Birdie'
    | 'Par'
    | 'Bogey'
    | 'Double Bogey'
    | 'Triple+';
}

export interface RoundScorecardSummary {
  holesPlayed: number;
  outGrossStrokes: number;
  inGrossStrokes: number;
  totalGrossStrokes: number;
  outNetStrokes: number;
  inNetStrokes: number;
  totalNetStrokes: number;
  outStablefordPoints: number;
  inStablefordPoints: number;
  totalStablefordPoints: number;
  totalPutts: number;
  fairwaysHitCount: number;
  fairwaysEligibleCount: number;
  fairwayHitPercentage: number;
  greensInRegulationCount: number;
  girPercentage: number;
  penaltyStrokesTotal: number;
  computedHoles: ComputedHoleScore[];
}

/**
 * Calcula los golpes de hándicap que recibe (o da, si es hándicap plus < 0)
 * un jugador en un hoyo según su Playing Handicap y el Stroke Index (1..18) del hoyo.
 */
export function calculateStrokesReceivedOnHole(
  playingHandicap: number,
  strokeIndex: number,
  holesCount: 9 | 18 = 18
): number {
  if (strokeIndex < 1 || strokeIndex > 18) {
    throw new Error(`Stroke Index inválido (${strokeIndex}): debe estar entre 1 y 18.`);
  }

  if (playingHandicap === 0) {
    return 0;
  }

  if (playingHandicap > 0) {
    const baseStrokes = Math.floor(playingHandicap / holesCount);
    const remainder = playingHandicap % holesCount;
    const effectiveSi =
      holesCount === 9
        ? strokeIndex <= 9
          ? strokeIndex
          : Math.ceil(strokeIndex / 2)
        : strokeIndex;
    const extraStroke = effectiveSi <= remainder ? 1 : 0;
    return baseStrokes + extraStroke;
  }

  // Jugador con hándicap plus (ej. -2 da golpe en los hoyos de menor dificultad: SI 18, 17... o SI 9, 8...)
  const absHandicap = Math.abs(playingHandicap);
  const baseGiven = Math.floor(absHandicap / holesCount);
  const remainderGiven = absHandicap % holesCount;
  const effectiveSi =
    holesCount === 9
      ? strokeIndex <= 9
        ? strokeIndex
        : Math.ceil(strokeIndex / 2)
      : strokeIndex;
  const maxSi = holesCount === 9 ? 9 : 18;
  const reverseIndex = maxSi + 1 - effectiveSi;
  const extraGiven = reverseIndex <= remainderGiven ? 1 : 0;
  const totalGiven = baseGiven + extraGiven;
  return totalGiven === 0 ? 0 : -totalGiven;
}

/**
 * Calcula los puntos Stableford de un hoyo según WHS:
 * - Neto = par + 2 o más -> 0 pts
 * - Neto = par + 1 (Bogey neto) -> 1 pt
 * - Neto = par (Par neto) -> 2 pts
 * - Neto = par - 1 (Birdie neto) -> 3 pts
 * - Neto = par - 2 (Eagle neto) -> 4 pts
 * - Neto = par - 3 (Albatross neto) -> 5 pts
 */
export function calculateHoleStablefordPoints(
  grossStrokes: number,
  par: number,
  strokesReceived: number
): number {
  if (grossStrokes <= 0) {
    return 0;
  }
  const netStrokes = grossStrokes - strokesReceived;
  const diffToPar = netStrokes - par;
  return Math.max(0, 2 - diffToPar);
}

export function classifyGrossScoreToPar(
  grossStrokes: number,
  par: number
): ComputedHoleScore['scoreToParLabel'] {
  const diff = grossStrokes - par;
  if (diff <= -3) return 'Albatross';
  if (diff === -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double Bogey';
  return 'Triple+';
}

/**
 * Agrega y resume la tarjeta completa de una ronda combinando la definición de los 18 hoyos
 * con los golpes registrados y el Playing Handicap del jugador.
 */
export function summarizeRoundScorecard(
  courseHoles: Pick<GolfApiHole, 'holeNumber' | 'par' | 'strokeIndex'>[],
  recordedScores: HoleScoreInput[],
  playingHandicap: number
): RoundScorecardSummary {
  const holeMap = new Map(courseHoles.map((h) => [h.holeNumber, h]));

  const computedHoles: ComputedHoleScore[] = recordedScores
    .filter((s) => s.strokes > 0 && holeMap.has(s.holeNumber))
    .map((score) => {
      const holeDef = holeMap.get(score.holeNumber)!;
      const strokesReceived = calculateStrokesReceivedOnHole(
        playingHandicap,
        holeDef.strokeIndex,
        courseHoles.length <= 9 ? 9 : 18
      );
      const netStrokes = score.strokes - strokesReceived;
      const stablefordPoints = calculateHoleStablefordPoints(
        score.strokes,
        holeDef.par,
        strokesReceived
      );

      return {
        ...score,
        par: holeDef.par,
        strokeIndex: holeDef.strokeIndex,
        strokesReceived,
        netStrokes,
        stablefordPoints,
        scoreToParLabel: classifyGrossScoreToPar(score.strokes, holeDef.par),
      };
    })
    .sort((a, b) => a.holeNumber - b.holeNumber);

  const outHoles = computedHoles.filter((h) => h.holeNumber <= 9);
  const inHoles = computedHoles.filter((h) => h.holeNumber >= 10);

  const sum = (items: ComputedHoleScore[], pick: (h: ComputedHoleScore) => number) =>
    items.reduce((acc, item) => acc + pick(item), 0);

  const outGrossStrokes = sum(outHoles, (h) => h.strokes);
  const inGrossStrokes = sum(inHoles, (h) => h.strokes);
  const outNetStrokes = sum(outHoles, (h) => h.netStrokes);
  const inNetStrokes = sum(inHoles, (h) => h.netStrokes);
  const outStablefordPoints = sum(outHoles, (h) => h.stablefordPoints);
  const inStablefordPoints = sum(inHoles, (h) => h.stablefordPoints);
  const totalPutts = sum(computedHoles, (h) => h.putts);
  const penaltyStrokesTotal = sum(computedHoles, (h) => h.penaltyStrokes);

  // Fairways elegibles: hoyos Par 4 y Par 5 donde fairwayHit no sea null
  const fairwaysEligible = computedHoles.filter(
    (h) => h.par >= 4 && h.fairwayHit !== null
  );
  const fairwaysHitCount = fairwaysEligible.filter((h) => h.fairwayHit === true).length;
  const fairwayHitPercentage =
    fairwaysEligible.length > 0
      ? Number(((fairwaysHitCount / fairwaysEligible.length) * 100).toFixed(1))
      : 0;

  const greensInRegulationCount = computedHoles.filter(
    (h) => h.greenInRegulation
  ).length;
  const girPercentage =
    computedHoles.length > 0
      ? Number(((greensInRegulationCount / computedHoles.length) * 100).toFixed(1))
      : 0;

  return {
    holesPlayed: computedHoles.length,
    outGrossStrokes,
    inGrossStrokes,
    totalGrossStrokes: outGrossStrokes + inGrossStrokes,
    outNetStrokes,
    inNetStrokes,
    totalNetStrokes: outNetStrokes + inNetStrokes,
    outStablefordPoints,
    inStablefordPoints,
    totalStablefordPoints: outStablefordPoints + inStablefordPoints,
    totalPutts,
    fairwaysHitCount,
    fairwaysEligibleCount: fairwaysEligible.length,
    fairwayHitPercentage,
    greensInRegulationCount,
    girPercentage,
    penaltyStrokesTotal,
    computedHoles,
  };
}
