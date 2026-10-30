import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ClubsDirectoryPage from '@/app/(main)/clubs/page';
import { ClubProvider } from '@/components/providers/ClubProvider';
import { AppShell } from '@/components/layout/AppShell';
import {
  SPAIN_GOLF_COURSES_CATALOG,
  getAllSpainGolfCourses,
  getOsmDatasetMetadata,
  getOsmGolfCourses,
  getSpainGolfCourseById,
  searchSpainGolfCourses,
  OSM_ATTRIBUTION,
} from '../index';
import {
  adaptOsmCourseToSpainGolfCourse,
  calculateDistanceKm,
  extractElementCoordinates,
  isOsmCourseDuplicateOfCurated,
  normalizeOsmCourse,
  normalizeOsmElements,
  validateOverpassResponse,
} from '../osm-normalizer';
import type { OverpassRawElement, OverpassRawResponse } from '../osm-types';

describe('Fase 11: Catálogo Geográfico Nacional de Campos de Golf (OpenStreetMap / ODbL)', () => {
  describe('1. Normalización de Elementos OSM (Node, Way, Relation)', () => {
    it('extrae coordenadas geográficas directas de un Node', () => {
      const nodeElement: OverpassRawElement = {
        type: 'node',
        id: 1001,
        lat: 40.4168,
        lon: -3.7038,
        tags: { leisure: 'golf_course', name: 'Golf de Prueba Node' },
      };

      const coords = extractElementCoordinates(nodeElement);
      expect(coords).not.toBeNull();
      expect(coords?.lat).toBeCloseTo(40.4168);
      expect(coords?.lon).toBeCloseTo(-3.7038);

      const normalized = normalizeOsmCourse(nodeElement);
      expect(normalized).not.toBeNull();
      expect(normalized?.osmId).toBe(1001);
      expect(normalized?.osmType).toBe('node');
      expect(normalized?.osmKey).toBe('node/1001');
      expect(normalized?.name).toBe('Golf de Prueba Node');
      expect(normalized?.hasExplicitName).toBe(true);
    });

    it('extrae coordenadas del centro para Way y Relation', () => {
      const wayElement: OverpassRawElement = {
        type: 'way',
        id: 2002,
        center: { lat: 36.5123, lon: -4.8912 },
        tags: { leisure: 'golf_course', name: 'Campo Way Costa' },
      };

      const relElement: OverpassRawElement = {
        type: 'relation',
        id: 3003,
        center: { lat: 39.5696, lon: 2.6502 },
        tags: { leisure: 'golf_course', name: 'Resort Relation Mallorca' },
      };

      const wayCoords = extractElementCoordinates(wayElement);
      expect(wayCoords?.lat).toBeCloseTo(36.5123);
      expect(wayCoords?.lon).toBeCloseTo(-4.8912);

      const relCoords = extractElementCoordinates(relElement);
      expect(relCoords?.lat).toBeCloseTo(39.5696);
      expect(relCoords?.lon).toBeCloseTo(2.6502);

      const normalizedWay = normalizeOsmCourse(wayElement);
      const normalizedRel = normalizeOsmCourse(relElement);

      expect(normalizedWay?.osmType).toBe('way');
      expect(normalizedRel?.osmType).toBe('relation');
      expect(normalizedWay?.osmUrl).toBe('https://www.openstreetmap.org/way/2002');
      expect(normalizedRel?.osmUrl).toBe('https://www.openstreetmap.org/relation/3003');
    });

    it('calcula el centro geodésico a partir de bounds si center no está presente', () => {
      const wayWithBounds: OverpassRawElement = {
        type: 'way',
        id: 4004,
        bounds: { minlat: 40.0, maxlat: 40.1, minlon: -3.8, maxlon: -3.6 },
        tags: { leisure: 'golf_course', name: 'Campo con Bounding Box' },
      };

      const coords = extractElementCoordinates(wayWithBounds);
      expect(coords).not.toBeNull();
      expect(coords?.lat).toBeCloseTo(40.05);
      expect(coords?.lon).toBeCloseTo(-3.7);
    });

    it('descarta elementos sin coordenadas válidas', () => {
      const elementWithoutCoords: OverpassRawElement = {
        type: 'way',
        id: 5005,
        tags: { leisure: 'golf_course', name: 'Sin Coordenadas' },
      };

      expect(extractElementCoordinates(elementWithoutCoords)).toBeNull();
      expect(normalizeOsmCourse(elementWithoutCoords)).toBeNull();
    });
  });

  describe('2. Integridad de Datos y Tratamiento de Información Ausente', () => {
    it('maneja campos sin nombre sin inventar identidades falsas', () => {
      const unnamedElement: OverpassRawElement = {
        type: 'way',
        id: 6006,
        center: { lat: 41.3851, lon: 2.1734 },
        tags: { leisure: 'golf_course' }, // Sin tag name
      };

      const normalized = normalizeOsmCourse(unnamedElement);
      expect(normalized).not.toBeNull();
      expect(normalized?.hasExplicitName).toBe(false);
      expect(normalized?.name).toBe('Campo de golf (sin nombre en OSM #6006)');
      expect(normalized?.clubName).toBeUndefined();
    });

    it('no inventa pares, distancias, barras ni hoyos cuando faltan en OSM', () => {
      const bareElement: OverpassRawElement = {
        type: 'node',
        id: 7007,
        lat: 37.3891,
        lon: -5.9845,
        tags: { leisure: 'golf_course', name: 'Golf Sevillano' },
      };

      const normalized = normalizeOsmCourse(bareElement)!;
      expect(normalized.holesCount).toBeUndefined();
      expect(normalized.parTotal).toBeUndefined();
      expect(normalized.phone).toBeUndefined();
      expect(normalized.email).toBeUndefined();
      expect(normalized.website).toBeUndefined();

      // Al adaptarlo al contrato SpainGolfCourse:
      const adapted = adaptOsmCourseToSpainGolfCourse(normalized);
      expect(adapted.hasHoleDetail).toBe(false);
      expect(adapted.hasVerifiedGpsTelemetry).toBe(false);
      expect(adapted.tees).toHaveLength(0);
      expect(adapted.holes).toHaveLength(0);
      expect(adapted.designer).toBeUndefined();
      expect(adapted.yearFounded).toBeUndefined();
    });

    it('parsea correctamente etiquetas opcionales cuando existen', () => {
      const richElement: OverpassRawElement = {
        type: 'way',
        id: 8008,
        center: { lat: 28.1234, lon: -15.4321 },
        tags: {
          leisure: 'golf_course',
          name: 'Gran Canaria Golf Park',
          'golf:holes': '18',
          'golf:par': '72',
          phone: '+34 928 000 111',
          website: 'https://www.gcgolfpark.es',
          'addr:city': 'Las Palmas',
          'addr:postcode': '35010',
          'addr:street': 'Avenida del Golf, 10',
        },
      };

      const normalized = normalizeOsmCourse(richElement)!;
      expect(normalized.holesCount).toBe(18);
      expect(normalized.parTotal).toBe(72);
      expect(normalized.phone).toBe('+34 928 000 111');
      expect(normalized.website).toBe('https://www.gcgolfpark.es');
      expect(normalized.city).toBe('Las Palmas');
      expect(normalized.postalCode).toBe('35010');
      expect(normalized.address).toContain('Avenida del Golf');
    });
  });

  describe('3. Deduplicación por Tipo/ID y frente al Catálogo Curado', () => {
    it('deduplica elementos repetidos en la respuesta cruda de Overpass por osmKey', () => {
      const rawElements: OverpassRawElement[] = [
        {
          type: 'way',
          id: 9001,
          center: { lat: 40.4, lon: -3.7 },
          tags: { leisure: 'golf_course', name: 'Club Duplicado' },
        },
        {
          type: 'way',
          id: 9001, // Mismo ID y tipo
          center: { lat: 40.4, lon: -3.7 },
          tags: { leisure: 'golf_course', name: 'Club Duplicado' },
        },
        {
          type: 'node',
          id: 9001, // Mismo ID pero distinto tipo (node vs way) -> se conserva
          lat: 40.41,
          lon: -3.71,
          tags: { leisure: 'golf_course', name: 'Nodo Distinto' },
        },
      ];

      const deduplicated = normalizeOsmElements(rawElements);
      expect(deduplicated).toHaveLength(2);
      expect(deduplicated.map((d) => d.osmKey)).toEqual(['way/9001', 'node/9001']);
    });

    it('detecta duplicados de campos curados por nombre exacto o proximidad geográfica', () => {
      // 1. Campo que simula Real Club Valderrama en OSM (mismo nombre y coordenadas cercanas)
      const valderramaCurated = SPAIN_GOLF_COURSES_CATALOG.find((c) =>
        c.name.toLowerCase().includes('valderrama')
      )!;

      const valderramaOsm = normalizeOsmCourse({
        type: 'way',
        id: 99991,
        center: { lat: valderramaCurated.latitude, lon: valderramaCurated.longitude },
        tags: { leisure: 'golf_course', name: 'Real Club Valderrama' },
      })!;

      expect(isOsmCourseDuplicateOfCurated(valderramaOsm, SPAIN_GOLF_COURSES_CATALOG)).toBe(true);

      // 2. Campo que está a menos de 1 km de Puerta de Hierro pero con nombre ligeramente diferente
      const puertaHierroCurated = SPAIN_GOLF_COURSES_CATALOG.find((c) =>
        c.name.toLowerCase().includes('puerta de hierro')
      )!;

      const puertaHierroOsm = normalizeOsmCourse({
        type: 'relation',
        id: 99992,
        center: {
          lat: puertaHierroCurated.latitude + 0.003, // ~300 metros
          lon: puertaHierroCurated.longitude + 0.002,
        },
        tags: { leisure: 'golf_course', name: 'Golf Puerta de Hierro instalaciones' },
      })!;

      expect(isOsmCourseDuplicateOfCurated(puertaHierroOsm, SPAIN_GOLF_COURSES_CATALOG)).toBe(true);

      // 3. Campo completamente nuevo y alejado (no es duplicado)
      const newCourseOsm = normalizeOsmCourse({
        type: 'way',
        id: 99993,
        center: { lat: 42.85, lon: -8.54 }, // Santiago de Compostela
        tags: { leisure: 'golf_course', name: 'Pitch & Putt Nuevo Gallego' },
      })!;

      expect(isOsmCourseDuplicateOfCurated(newCourseOsm, SPAIN_GOLF_COURSES_CATALOG)).toBe(false);
    });
  });

  describe('4. Validación de Respuestas de Overpass y Protección contra Fallos', () => {
    it('valida respuestas correctas de Overpass y extrae elementos', () => {
      const validResponse: OverpassRawResponse = {
        version: 0.6,
        generator: 'Overpass API',
        elements: [
          {
            type: 'node',
            id: 111,
            lat: 40.0,
            lon: -3.0,
            tags: { leisure: 'golf_course' },
          },
        ],
      };

      const elements = validateOverpassResponse(validResponse);
      expect(elements).toHaveLength(1);
    });

    it('lanza error informativo cuando la respuesta no es un objeto válido o carece de elements', () => {
      expect(() => validateOverpassResponse(null)).toThrow('Respuesta de Overpass no válida');
      expect(() => validateOverpassResponse('cadena')).toThrow('Respuesta de Overpass no válida');
      expect(() => validateOverpassResponse({})).toThrow('campo "elements" ausente');
      expect(() => validateOverpassResponse({ elements: 'no es un array' })).toThrow(
        'campo "elements" ausente o no es un array'
      );
    });

    it('lanza error cuando la respuesta contiene una advertencia de error o está vacía', () => {
      expect(() =>
        validateOverpassResponse({
          remark: 'runtime error: Query timed out',
          elements: [],
        })
      ).toThrow('Overpass devolvió error: runtime error: Query timed out');

      expect(() =>
        validateOverpassResponse({
          elements: [],
        })
      ).toThrow('Respuesta de Overpass vacía: no contiene elementos');
    });
  });

  describe('5. Integración del Catálogo en el Buscador y Filtro de Procedencia', () => {
    it('carga el inventario OSM con metadatos de versión y licencia ODbL', () => {
      const meta = getOsmDatasetMetadata();
      expect(meta.schemaVersion).toBe('1.0.0');
      expect(meta.attribution).toContain('OpenStreetMap');
      expect(meta.elementsCount).toBeGreaterThan(0);

      const osmCourses = getOsmGolfCourses();
      expect(osmCourses.length).toBeGreaterThan(0);
      for (const course of osmCourses) {
        expect(course.provenance).toBe('osm');
        expect(course.osmId).toBeDefined();
        expect(course.osmType).toBeDefined();
        expect(course.hasHoleDetail).toBe(false);
      }
    });

    it('permite filtrar por procedencia (all, curated, osm)', () => {
      const allCourses = getAllSpainGolfCourses('all');
      const curatedCourses = getAllSpainGolfCourses('curated');
      const osmCourses = getAllSpainGolfCourses('osm');

      expect(curatedCourses.length).toBe(SPAIN_GOLF_COURSES_CATALOG.length);
      expect(osmCourses.length).toBe(getOsmGolfCourses().length);
      expect(allCourses.length).toBe(curatedCourses.length + osmCourses.length);

      // Búsqueda filtrada por procedencia
      const curatedSearch = searchSpainGolfCourses({ provenance: 'curated' });
      expect(curatedSearch.every((c) => c.provenance === 'curated')).toBe(true);

      const osmSearch = searchSpainGolfCourses({ provenance: 'osm' });
      expect(osmSearch.every((c) => c.provenance === 'osm')).toBe(true);
    });

    it('encuentra campos de OSM por ID unificado, externalGolfApiId o clave osmKey', () => {
      const firstOsm = getOsmGolfCourses()[0];
      expect(firstOsm).toBeDefined();

      const byId = getSpainGolfCourseById(firstOsm.id);
      expect(byId).not.toBeNull();
      expect(byId?.id).toBe(firstOsm.id);

      const byExtId = getSpainGolfCourseById(firstOsm.externalGolfApiId);
      expect(byExtId).not.toBeNull();
      expect(byExtId?.id).toBe(firstOsm.id);

      if (firstOsm.osmKey) {
        const byKey = getSpainGolfCourseById(firstOsm.osmKey);
        expect(byKey).not.toBeNull();
        expect(byKey?.id).toBe(firstOsm.id);
      }
    });
  });

  describe('6. Renderizado SSR, Atribución ODbL y Aislamiento de Funciones de Marcador', () => {
    it('renderiza la página de directorio con la atribución visible a OpenStreetMap y ODbL', () => {
      const html = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club">
          <ClubsDirectoryPage />
        </ClubProvider>
      );

      // Verificación de la atribución exigida por la licencia ODbL 1.0
      expect(html).toContain('© OpenStreetMap contributors');
      expect(html).toContain('https://www.openstreetmap.org/copyright');
      expect(html).toContain('Open Database License ODbL 1.0');
      expect(html).toContain('Guía Oficial e Inventario Nacional de Golf · España');
    });

    it('garantiza la estructura SSR del AppShell sin duplicar elementos semánticos', () => {
      const html = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club">
          <AppShell>
            <ClubsDirectoryPage />
          </AppShell>
        </ClubProvider>
      );

      const headerCount = (html.match(/<header/g) || []).length;
      const asideCount = (html.match(/<aside/g) || []).length;

      expect(headerCount).toBe(1);
      expect(asideCount).toBe(1);
    });
  });
});
