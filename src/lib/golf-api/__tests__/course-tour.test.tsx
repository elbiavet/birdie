import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GOLF_API_COURSES_CATALOG,
  getCourseById,
  calculateCourseNineTotals,
  type GolfApiHole,
} from '@/lib/golf-api';
import { HoleDiagramView } from '@/components/modules/course/HoleDiagramView';
import CourseTourPage from '@/app/(main)/course/page';
import { ALL_NAVIGATION_ITEMS, resolveNavigationItems } from '@/components/layout/AppShell';
import { ClubProvider } from '@/components/providers/ClubProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { getClubConfig } from '@/lib/club-config';

vi.mock('next/navigation', () => ({
  usePathname: () => '/course',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const sampleHole: GolfApiHole = {
  holeNumber: 1,
  par: 4,
  strokeIndex: 11,
  distanceWhiteMeters: 368,
  distanceYellowMeters: 352,
  distanceBlueMeters: 320,
  distanceRedMeters: 305,
  teeLat: 40.4682,
  teeLng: -3.7815,
  greenFrontLat: 40.46911,
  greenFrontLng: -3.78021,
  greenCenterLat: 40.46922,
  greenCenterLng: -3.78015,
  greenBackLat: 40.46933,
  greenBackLng: -3.78009,
  pois: [
    {
      id: 'poi-bunker-1',
      poiType: 'bunker',
      label: 'Bunker Frontal Izquierdo',
      lat: 40.469,
      lng: -3.7803,
    },
    {
      id: 'poi-water-1',
      poiType: 'water_hazard',
      label: 'Lago Lateral Derecho',
      lat: 40.4688,
      lng: -3.7808,
    },
    {
      id: 'poi-dogleg-1',
      poiType: 'dogleg',
      label: 'Caída de Drive Dogleg',
      lat: 40.4687,
      lng: -3.7809,
    },
  ],
};

describe('Fase 8 - Subfase 8.2: Módulo Recorrido y Trazados Técnicos de Hoyos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Golf API Catalog y Cálculo de Vueltas', () => {
    it('obtiene el campo correcto por ID externo y por UUID', () => {
      const byExternalId = getCourseById('golfapi_course_1024');
      expect(byExternalId).not.toBeNull();
      expect(byExternalId?.name).toBe('Recorrido Championship 18 Hoyos');
      expect(byExternalId?.clubName).toBe('Real Club de Golf Valle Verde');

      const byUuid = getCourseById(GOLF_API_COURSES_CATALOG[0].id);
      expect(byUuid).not.toBeNull();
      expect(byUuid?.id).toBe(GOLF_API_COURSES_CATALOG[0].id);
    });

    it('calcula los totales de ida, vuelta y acumulado de 18 hoyos', () => {
      const course = GOLF_API_COURSES_CATALOG[0];
      const totals = calculateCourseNineTotals(course.holes, 'yellow');

      expect(totals.outPar).toBeGreaterThan(0);
      expect(totals.inPar).toBeGreaterThan(0);
      expect(totals.totalPar).toBe(totals.outPar + totals.inPar);
      expect(totals.totalPar).toBe(course.parTotal);
      expect(totals.totalMeters).toBe(totals.outMeters + totals.inMeters);
      expect(totals.totalMeters).toBeGreaterThan(5000);
    });
  });

  describe('2. Componente HoleDiagramView', () => {
    it('renderiza estado de carga cuando isLoading es true', () => {
      const html = renderToStaticMarkup(<HoleDiagramView hole={null} isLoading={true} />);
      expect(html).toContain('role="status"');
      expect(html).toContain('Cargando trazado técnico del hoyo');
      expect(html).toContain('Calculando cotas y coordenadas GPS oficiales');
    });

    it('renderiza mensaje de error y botón de reintento cuando error está presente', () => {
      const onRetryMock = vi.fn();
      const html = renderToStaticMarkup(
        <HoleDiagramView
          hole={null}
          isLoading={false}
          error="No se pudo conectar con el servicio de cartografía GPS"
          onRetry={onRetryMock}
        />
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain('Error al cargar el trazado');
      expect(html).toContain('No se pudo conectar con el servicio de cartografía GPS');
      expect(html).toContain('Reintentar');
    });

    it('renderiza estado vacío cuando hole es null y no hay carga ni error', () => {
      const html = renderToStaticMarkup(<HoleDiagramView hole={null} />);
      expect(html).toContain('Sin información del hoyo');
    });

    it('renderiza plano técnico vectorial interactivo con datos oficiales del hoyo', () => {
      const html = renderToStaticMarkup(
        <HoleDiagramView
          hole={sampleHole}
          clubName="RCG Valle Verde"
          courseName="Campo Principal"
        />
      );

      expect(html).toContain('H1');
      expect(html).toContain('Par 4');
      expect(html).toContain('HCP 11');
      expect(html).toContain('352m (Amarillas)');
      expect(html).toContain('GPS Oficial');
      expect(html).toContain('aria-label="Plano vectorial del hoyo 1, par 4"');
      expect(html).toContain('100m');
      expect(html).toContain('150m');
      expect(html).toContain('200m');
    });

    it('soporta fotografía cuando photoUrl está presente', () => {
      const holeWithPhoto: GolfApiHole = {
        ...sampleHole,
        photoUrl: 'https://images.birdie.app/holes/valleverde/hole-1.jpg',
      };

      const html = renderToStaticMarkup(<HoleDiagramView hole={holeWithPhoto} />);
      expect(html).toContain('Plano Técnico');
      expect(html).toContain('Fotografía');
    });
  });

  describe('3. Pantalla CourseTourPage (/course) e Integración de Navegación', () => {
    it('renderiza la página de recorrido completa con ficha técnica y cotas oficiales', () => {
      const html = renderToStaticMarkup(
        <ThemeProvider>
          <ClubProvider initialClubId="demo-club">
            <CourseTourPage />
          </ClubProvider>
        </ThemeProvider>
      );

      // Banner principal
      expect(html).toContain('Recorrido del Campo');
      expect(html).toContain('Guía Oficial del Campo · Golf API');

      // Ficha de distancias por barra
      expect(html).toContain('Blancas');
      expect(html).toContain('Amarillas');
      expect(html).toContain('Azules');
      expect(html).toContain('Rojas');
      expect(html).toContain('368 m');
      expect(html).toContain('352 m');

      // Coordenadas GPS oficiales
      expect(html).toContain('Coordenadas GPS Oficiales (Green y Salida)');
      expect(html).toContain('Tee de Salida');
      expect(html).toContain('Green (Centro / Bandera)');

      // Resumen de vueltas
      expect(html).toContain('Resumen Técnico de Vueltas');
      expect(html).toContain('Ida (Hoyos 1 a 9)');
      expect(html).toContain('Vuelta (Hoyos 10 a 18)');
      expect(html).toContain('Total del Campo (18 Hoyos)');
    });

    it('ALL_NAVIGATION_ITEMS incluye la opción Recorrido (/course) para todos los clubes', () => {
      const courseItem = ALL_NAVIGATION_ITEMS.find((item) => item.id === 'course');
      expect(courseItem).toBeDefined();
      expect(courseItem?.href).toBe('/course');
      expect(courseItem?.label).toBe('Recorrido');
      expect(courseItem?.group).toBe('core');

      const demoClub = getClubConfig('demo-club');
      const resolved = resolveNavigationItems(demoClub, 'player');
      expect(resolved.some((item) => item.id === 'course')).toBe(true);
    });
  });
});
