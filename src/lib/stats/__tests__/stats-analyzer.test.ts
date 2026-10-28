import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  computePlayerStatistics,
  DEMO_HISTORICAL_HOLE_SAMPLES,
  type AnalyzedHoleSample,
} from '../analyzer';
import { HoleGpsPanel } from '@/components/modules/scorecard/HoleGpsPanel';
import { ClubProvider } from '@/components/providers/ClubProvider';
import ClubsDirectoryPage from '@/app/(main)/clubs/page';
import ScorecardAndGpsPage from '@/app/(main)/scorecard/page';
import PlayerStatsPage from '@/app/(main)/stats/page';
import { getCourseById } from '@/lib/golf-api';

vi.mock('next/navigation', () => ({
  usePathname: () => '/scorecard',
}));

describe('Analizador de Estadísticas Deportivas, Panel GPS y Pantallas Fase 2 (Subfases 2.2, 2.4 y 2.5)', () => {
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
    expect(stats.fairwayHitPercentage).toBe(66.7);
    expect(stats.girPercentage).toBe(50);
    expect(stats.scramblingPercentage).toBe(50);
    expect(stats.sandSavePercentage).toBe(50);
    expect(stats.par3AverageStrokes).toBe(4);
    expect(stats.par4AverageStrokes).toBe(3.5);
    expect(stats.par5AverageStrokes).toBe(3);
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

  it('renderiza HoleGpsPanel mostrando distancias a Frente, Centro, Fondo de Green y POIs del hoyo activo', () => {
    const course = getCourseById('golfapi_course_1024')!;
    const html = renderToStaticMarkup(
      React.createElement(HoleGpsPanel, { hole: course.holes[0] })
    );

    expect(html).toContain('Telémetro GPS · Hoyo 1');
    expect(html).toContain('Frente Green');
    expect(html).toContain('Centro Bandera');
    expect(html).toContain('Fondo Green');
    expect(html).toContain('Bunker Izquierdo Green');
    expect(html).toContain('Caída de Drive / Dogleg');
  });

  it('renderiza las páginas /clubs, /scorecard y /stats dentro de ClubProvider mostrando datos del recorrido, marcador y analítica', () => {
    const clubsHtml = renderToStaticMarkup(
      React.createElement(
        ClubProvider,
        { initialClubId: 'demo-club', children: React.createElement(ClubsDirectoryPage) }
      )
    );
    expect(clubsHtml).toContain('Directorio de Clubes y Campos');
    expect(clubsHtml).toContain('Primera Vuelta — IDA');
    expect(clubsHtml).toContain('Segunda Vuelta — VUELTA');

    const scorecardHtml = renderToStaticMarkup(
      React.createElement(
        ClubProvider,
        { initialClubId: 'demo-club', children: React.createElement(ScorecardAndGpsPage) }
      )
    );
    expect(scorecardHtml).toContain('Marcador Digital y Telémetro GPS');
    expect(scorecardHtml).toContain('Guardar Hoyo 1 en SQLite Offline');
    expect(scorecardHtml).toContain('Resumen de Tarjeta en Vivo');

    const statsHtml = renderToStaticMarkup(
      React.createElement(
        ClubProvider,
        { initialClubId: 'demo-club', children: React.createElement(PlayerStatsPage) }
      )
    );
    expect(statsHtml).toContain('Estadísticas de Rendimiento');
    expect(statsHtml).toContain('Rendimiento por Par de Hoyo');
    expect(statsHtml).toContain('Distribución de Resultados por Hoyo');
  });
});
