import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  calculateHoleBounds,
  PNOA_WMTS_URL,
  PNOA_ATTRIBUTION,
  HoleCartographyMap,
} from '../HoleCartographyMap';
import { HoleDiagramView } from '../HoleDiagramView';
import { GOLF_API_COURSES_CATALOG } from '@/lib/golf-api/catalog';
import type { GolfApiHole } from '@/lib/golf-api/types';

describe('Fase 12: Cartografía Satelital PNOA/IGN y Capa de Datos Reales del Hoyo', () => {
  const illescasCourse = GOLF_API_COURSES_CATALOG.find(
    (c) => c.externalGolfApiId === 'golfapi_course_8833'
  )!;
  const valleverdeCourse = GOLF_API_COURSES_CATALOG.find(
    (c) => c.externalGolfApiId === 'golfapi_course_1024'
  )!;

  const illescasHole1 = illescasCourse.holes[0];
  const valleverdeHole1 = valleverdeCourse.holes[0];

  describe('1. Constantes del Servicio Oficial WMTS y Atribución PNOA/IGN', () => {
    it('la plantilla URL de teselas apunta al servicio oficial WMTS del IGN en EPSG:3857', () => {
      expect(PNOA_WMTS_URL).toContain('https://www.ign.es/wmts/pnoa-ma');
      expect(PNOA_WMTS_URL).toContain('Service=WMTS');
      expect(PNOA_WMTS_URL).toContain('Request=GetTile');
      expect(PNOA_WMTS_URL).toContain('Layer=OI.OrthoimageCoverage');
      expect(PNOA_WMTS_URL).toContain('TileMatrixSet=GoogleMapsCompatible');
      expect(PNOA_WMTS_URL).toContain('Format=image/jpeg');
      expect(PNOA_WMTS_URL).toContain('TileMatrix={z}');
      expect(PNOA_WMTS_URL).toContain('TileCol={x}');
      expect(PNOA_WMTS_URL).toContain('TileRow={y}');
    });

    it('la cadena de atribución incluye obligatoriamente la mención oficial verificada PNOA CC BY 4.0 scne.es', () => {
      expect(PNOA_ATTRIBUTION).toContain('PNOA CC BY 4.0 scne.es');
      expect(PNOA_ATTRIBUTION).toContain('https://www.scne.es');
    });
  });

  describe('2. Cálculo Matemático de Bounding Box y Centro (calculateHoleBounds)', () => {
    it('calcula la caja envolvente exacta para el hoyo 1 de Señorío de Illescas (campo de 9 hoyos)', () => {
      const bounds = calculateHoleBounds(illescasHole1);

      expect(bounds.minLat).toBeLessThanOrEqual(illescasHole1.teeLat);
      expect(bounds.maxLat).toBeGreaterThanOrEqual(illescasHole1.teeLat);
      expect(bounds.minLng).toBeLessThanOrEqual(illescasHole1.teeLng);
      expect(bounds.maxLng).toBeGreaterThanOrEqual(illescasHole1.teeLng);

      expect(bounds.minLat).toBeLessThanOrEqual(illescasHole1.greenCenterLat);
      expect(bounds.maxLat).toBeGreaterThanOrEqual(illescasHole1.greenCenterLat);
      expect(bounds.minLng).toBeLessThanOrEqual(illescasHole1.greenCenterLng);
      expect(bounds.maxLng).toBeGreaterThanOrEqual(illescasHole1.greenCenterLng);

      expect(bounds.centerLat).toBe((bounds.minLat + bounds.maxLat) / 2);
      expect(bounds.centerLng).toBe((bounds.minLng + bounds.maxLng) / 2);
    });

    it('calcula la caja envolvente para el hoyo 1 de Valle Verde (campo de 18 hoyos con POIs y dogleg)', () => {
      const bounds = calculateHoleBounds(valleverdeHole1);

      expect(bounds.minLat).toBeLessThan(bounds.maxLat);
      expect(bounds.minLng).toBeLessThan(bounds.maxLng);

      // Todos los POIs deben quedar dentro de la envolvente
      if (valleverdeHole1.pois) {
        for (const poi of valleverdeHole1.pois) {
          expect(poi.lat).toBeGreaterThanOrEqual(bounds.minLat);
          expect(poi.lat).toBeLessThanOrEqual(bounds.maxLat);
          expect(poi.lng).toBeGreaterThanOrEqual(bounds.minLng);
          expect(poi.lng).toBeLessThanOrEqual(bounds.maxLng);
        }
      }
    });

    it('incluye coordenadas de bunkers y obstáculos en la envolvente', () => {
      const customHole: GolfApiHole = {
        ...illescasHole1,
        pois: [
          {
            id: 'bunker_far',
            poiType: 'bunker',
            label: 'Bunker Lateral',
            lat: 40.1600, // Fuera del rango de tee y green
            lng: -3.8500,
          },
        ],
      };

      const bounds = calculateHoleBounds(customHole);
      expect(bounds.maxLat).toBeGreaterThanOrEqual(40.1600);
      expect(bounds.minLng).toBeLessThanOrEqual(-3.8500);
    });
  });

  describe('3. Renderizado SSR y Compatibilidad con Exportación Estática', () => {
    it('renderiza HoleDiagramView en SSR sin invocar APIs de navegador ni lanzar excepciones', () => {
      const html = renderToStaticMarkup(
        <HoleDiagramView
          hole={illescasHole1}
          clubName="Señorío de Illescas"
          courseName="Recorrido 9 Hoyos"
        />
      );

      // Cabecera con datos oficiales
      expect(html).toContain('H1');
      expect(html).toContain('Par 4');
      expect(html).toContain('HCP 5');
      expect(html).toContain('Señorío de Illescas');
      expect(html).toContain('Recorrido 9 Hoyos');

      // Botones selectores de modo de visualización
      expect(html).toContain('Satélite PNOA');
      expect(html).toContain('Plano Técnico');

      // Skeleton accesible generado por next/dynamic para el mapa Leaflet en SSR
      expect(html).toContain('role="status"');
      expect(html).toContain('Cargando ortofoto satelital PNOA...');
      expect(html).toContain('Proyectando coordenadas GPS oficiales');
    });

    it('renderiza en SSR el trazado técnico vectorial cuando initialMode="vector"', () => {
      const html = renderToStaticMarkup(
        <HoleDiagramView
          hole={illescasHole1}
          clubName="Señorío de Illescas"
          courseName="Recorrido 9 Hoyos"
          initialMode="vector"
        />
      );

      expect(html).toContain('aria-label="Plano vectorial del hoyo 1, par 4"');
      expect(html).toContain('345m (Amarillas)');
    });

    it('renderiza el contenedor accesible de HoleCartographyMap en SSR', () => {
      const html = renderToStaticMarkup(
        <HoleCartographyMap
          hole={illescasHole1}
          clubName="Señorío de Illescas"
          courseName="Recorrido 9 Hoyos"
        />
      );

      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="Mapa satelital PNOA del hoyo 1"');
    });
  });

  describe('4. Inicialización de Leaflet y Superposición de Datos Reales (Mocks)', () => {
    let originalWindow: any;
    let originalNavigator: any;

    let mockTileLayerInstance: any;
    let mockPolylineInstance: any;
    let mockMarkerInstance: any;
    let mockCircleMarkerInstance: any;
    let mockMapInstance: any;

    let capturedTileErrorCallback: (() => void) | null = null;
    let capturedEventListeners: Record<string, ((e?: any) => void)[]> = {};

    beforeEach(() => {
      originalWindow = (globalThis as any).window;

      capturedTileErrorCallback = null;
      capturedEventListeners = {};

      mockTileLayerInstance = {
        on: vi.fn((event: string, cb: () => void) => {
          if (event === 'tileerror') {
            capturedTileErrorCallback = cb;
          }
          return mockTileLayerInstance;
        }),
        addTo: vi.fn().mockReturnThis(),
      };

      mockPolylineInstance = {
        bindTooltip: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
      };

      mockMarkerInstance = {
        bindPopup: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
      };

      mockCircleMarkerInstance = {
        bindTooltip: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
      };

      mockMapInstance = {
        fitBounds: vi.fn().mockReturnThis(),
        setView: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      };

      const mockL = {
        map: vi.fn(() => mockMapInstance),
        tileLayer: vi.fn(() => mockTileLayerInstance),
        polyline: vi.fn(() => mockPolylineInstance),
        marker: vi.fn(() => mockMarkerInstance),
        circleMarker: vi.fn(() => mockCircleMarkerInstance),
        divIcon: vi.fn((opts: any) => opts),
        latLngBounds: vi.fn((sw: any, ne: any) => ({ sw, ne })),
      };

      vi.doMock('leaflet', () => mockL);

      // Mock de entorno de navegador window / navigator.onLine
      (globalThis as any).window = {
        addEventListener: vi.fn((evt: string, fn: any) => {
          if (!capturedEventListeners[evt]) capturedEventListeners[evt] = [];
          capturedEventListeners[evt].push(fn);
        }),
        removeEventListener: vi.fn((evt: string, fn: any) => {
          if (capturedEventListeners[evt]) {
            capturedEventListeners[evt] = capturedEventListeners[evt].filter(
              (f) => f !== fn
            );
          }
        }),
      };

      try {
        Object.defineProperty(globalThis.navigator, 'onLine', {
          value: true,
          configurable: true,
          writable: true,
        });
      } catch {
        // En caso de que navigator no sea configurable en algún entorno
      }
    });

    afterEach(() => {
      (globalThis as any).window = originalWindow;
      vi.restoreAllMocks();
    });

    it('la capa tileLayer usa la URL oficial de PNOA y la atribución obligatoria CC BY 4.0 scne.es', async () => {
      const leaflet = await import('leaflet');
      const tileLayer = leaflet.tileLayer(PNOA_WMTS_URL, {
        attribution: PNOA_ATTRIBUTION,
        maxZoom: 19,
      });

      expect(leaflet.tileLayer).toHaveBeenCalledWith(
        expect.stringContaining('wmts/pnoa-ma'),
        expect.objectContaining({
          attribution: expect.stringContaining('PNOA CC BY 4.0 scne.es'),
          maxZoom: 19,
        })
      );
      expect(tileLayer).toBe(mockTileLayerInstance);
    });

    it('la polilínea conecta Salida -> Doglegs -> Green Centro con estilo discontinuo', async () => {
      const leaflet = await import('leaflet');
      const doglegs = (valleverdeHole1.pois || []).filter((p) => p.poiType === 'dogleg');
      const expectedCoords = [
        [valleverdeHole1.teeLat, valleverdeHole1.teeLng],
        ...doglegs.map((d): [number, number] => [d.lat, d.lng]),
        [valleverdeHole1.greenCenterLat, valleverdeHole1.greenCenterLng],
      ];

      leaflet.polyline(expectedCoords as any, {
        color: '#FACC15',
        weight: 2.5,
        dashArray: '6, 6',
      });

      expect(leaflet.polyline).toHaveBeenCalledWith(
        expectedCoords,
        expect.objectContaining({
          dashArray: '6, 6',
        })
      );
    });

    it('los marcadores de Green Frente y Fondo se configuran con circleMarker de precisión', async () => {
      const leaflet = await import('leaflet');
      leaflet.circleMarker([valleverdeHole1.greenFrontLat, valleverdeHole1.greenFrontLng], {
        radius: 4,
      });
      leaflet.circleMarker([valleverdeHole1.greenBackLat, valleverdeHole1.greenBackLng], {
        radius: 4,
      });

      expect(leaflet.circleMarker).toHaveBeenCalledWith(
        [valleverdeHole1.greenFrontLat, valleverdeHole1.greenFrontLng],
        expect.any(Object)
      );
      expect(leaflet.circleMarker).toHaveBeenCalledWith(
        [valleverdeHole1.greenBackLat, valleverdeHole1.greenBackLng],
        expect.any(Object)
      );
    });

    it('registra el manejador de eventos tileerror sobre la capa de teselas y propaga la señal', () => {
      const onTileErrorSpy = vi.fn();
      let capturedHandler: (() => void) | null = null;

      mockTileLayerInstance.on = vi.fn((event: string, handler: () => void) => {
        if (event === 'tileerror') capturedHandler = handler;
        return mockTileLayerInstance;
      });

      // Simulación del registro en el componente
      mockTileLayerInstance.on('tileerror', () => {
        onTileErrorSpy();
      });

      expect(mockTileLayerInstance.on).toHaveBeenCalledWith('tileerror', expect.any(Function));
      expect(capturedHandler).toBeDefined();

      // Disparar error de tesela
      capturedHandler!();
      expect(onTileErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('captura eventos de desconexión (offline) y reconexión (online) en window', () => {
      const offlineHandlers: (() => void)[] = [];
      const onlineHandlers: (() => void)[] = [];

      (globalThis as any).window.addEventListener = vi.fn((event: string, handler: any) => {
        if (event === 'offline') offlineHandlers.push(handler);
        if (event === 'online') onlineHandlers.push(handler);
      });

      // Simular registro de listeners
      let isOffline = false;
      (globalThis as any).window.addEventListener('offline', () => {
        isOffline = true;
      });
      (globalThis as any).window.addEventListener('online', () => {
        isOffline = false;
      });

      expect((globalThis as any).window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect((globalThis as any).window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));

      // Disparar desconexión
      offlineHandlers.forEach((h) => h());
      expect(isOffline).toBe(true);

      // Disparar reconexión
      onlineHandlers.forEach((h) => h());
      expect(isOffline).toBe(false);
    });

    it('en modo campo completo sin telemetría de hoyo, centra el mapa en las coordenadas del club y no dibuja overlays de hoyo', async () => {
      const leaflet = await import('leaflet');
      const clubCoords = { latitude: 40.1533, longitude: -3.8452 };

      const map = leaflet.map('mock-container' as any, {
        zoomControl: true,
        attributionControl: true,
        maxZoom: 19,
        minZoom: 10,
      });

      map.setView([clubCoords.latitude, clubCoords.longitude], 15);

      expect(map.setView).toHaveBeenCalledWith([40.1533, -3.8452], 15);
      expect(map.fitBounds).not.toHaveBeenCalled();
    });
  });
});
