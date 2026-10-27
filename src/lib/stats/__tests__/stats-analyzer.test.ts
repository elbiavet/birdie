import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  computePlayerStatistics,
  DEMO_HISTORICAL_HOLE_SAMPLES,
  type AnalyzedHoleSample,
} from '../analyzer';
import { HoleGpsPanel } from '@/components/modules/scorecard/HoleGpsPanel';
import { getCourseById } from '@/lib/golf-api';

describe('Analizador de Estadísticas Deportivas y Panel GPS (Subfases 2.4 y 2.5)', () => {
  it('devuelve métricas en cero cuando no hay muestras de hoyos', () => {
    const empty = computePlayerStatistics([]);
    expect(empty.roundsCount).toBe(0);
    expect(empty.holesCount).toBe(0);
    expect(empty.fairwayHitPercentage).toBe(0);
    expect(empty.girPercentage).toBe(0);
    expect(empty.scramblingPercentage).toBe(0);
  });

  it('calcula FIR %, GIR %, Scrambling %, Sand Save %, medias por Par y distribución de resultados', () => {
    const samples: AnalyzedHoleSample[] = [
      // Hoyo 1: Par 4, Birdie (3), FIR sí, GIR sí, 1 putt
      {
        roundId: 'r1',
        playedDate: '2026-10-20',
        holeNumber: 1,
        par: 4,
        strokes: 3,
        putts: 1,
        fairwayHit: true,
        greenInRegulation: true,
        sandSave: null,
        stablefordPoints: 4,
      },
      // Hoyo 2: Par 4, Par (4) sin GIR (Scramble exitoso + Sand Save exitoso), FIR no, 1 putt
      {
        roundId: 'r1',
        playedDate: '2026-10-20',
        holeNumber: 2,
        par: 4,
        strokes: 4,
        putts: 1,
        fairwayHit: false,
        greenInRegulation: false,
        sandSave: true,
        stablefordPoints: 3,
      },
      // Hoyo 3: Par 3, Bogey (4) sin GIR (Scramble fallido), FIR null, 2 putts
      {
        roundId: 'r1',
        playedDate: '2026-10-20',
        holeNumber: 3,
        par: 3,
        strokes: 4,
        putts: 2,
        fairwayHit: null,
        greenInRegulation: false,
        sandSave: false,
        stablefordPoints: 1,
      },
      // Hoyo 4: Par 5, Eagle (3), FIR sí, GIR sí, 1 putt
      {
        roundId: 'r1',
        playedDate: '2026-10-20',
        holeNumber: 4,
        par: 5,
        strokes: 3,
        putts: 1,
        fairwayHit: true,
        greenInRegulation: true,
        sandSave: null,
        stablefordPoints: 5,
      },
    ];

    const stats = computePlayerStatistics(samples);

    expect(stats.roundsCount).toBe(1);
    expect(stats.holesCount).toBe(4);
    // FIR: 2 de 3 hoyos elegibles (H1 sí, H2 no, H4 sí) = 66.7%
    expect(stats.fairwayHitPercentage).toBe(66.7);
    // GIR: 2 de 4 hoyos (H1 y H4) = 50%
    expect(stats.girPercentage).toBe(50);
    // Scrambling: de los 2 hoyos sin GIR (H2 y H3), H2 salvó el Par -> 50%
    expect(stats.scramblingPercentage).toBe(50);
    // Sand Save: 1 de 2 (H2 sí, H3 no) -> 50%
    expect(stats.sandSavePercentage).toBe(50);
    // Medias por par
    expect(stats.par3AverageStrokes).toBe(4);
    expect(stats.par4AverageStrokes).toBe(3.5);
    expect(stats.par5AverageStrokes).toBe(3);
    // Distribución
    expect(stats.distribution.eaglesOrBetter).toBe(1);
    expect(stats.distribution.birdies).toBe(1);
    expect(stats.distribution.pars).toBe(1);
    expect(stats.distribution.bogeys).toBe(1);
    expect(stats.distribution.doubleBogeysOrWorse).toBe(0);
  });

  it('procesa correctamente la muestra semilla histórica de 18 hoyos (DEMO_HISTORICAL_HOLE_SAMPLES)', () => {
    const stats = computePlayerStatistics(DEMO_HISTORICAL_HOLE_SAMPLES);
    expect(stats.holesCount).toBe(18);
    expect(stats.roundsCount).toBe(1);
    expect(stats.averageGrossPer18).toBe(77);
    expect(stats.averageStablefordPer18).toBe(45);
  });

  it('renderiza HoleGpsPanel mostrando distancias a Frente, Centro y Fondo de Green del hoyo activo', () => {
    const course = getCourseById('golfapi_course_1024')!;
    const html = renderToStaticMarkup(
      React.createElement(HoleGpsPanel, { hole: course.holes[0] })
    );

    expect(html).toContain('Telémetro GPS · Hoyo 1');
    expect(html).toContain('Frente Green');
    expect(html).toContain('Centro Bandera');
    expect(html).toContain('Fondo Green');
  });
});
