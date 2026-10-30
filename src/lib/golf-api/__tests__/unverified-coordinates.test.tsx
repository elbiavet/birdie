import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GOLF_API_COURSES_CATALOG, getCourseById } from '../index';
import { HoleDiagramView } from '@/components/modules/course/HoleDiagramView';
import { HoleCartographyMap } from '@/components/modules/course/HoleCartographyMap';
import type { GolfApiHole, GolfApiCourse } from '../types';

describe('Detección y Tratamiento de Telemetría GPS No Verificada por Hoyo', () => {
  const illescasCourse = getCourseById('golfapi_course_8833')!;
  const valleverdeCourse = getCourseById('golfapi_course_1024')!;
  const illescasHole1 = illescasCourse.holes[0];
  const valleverdeHole1 = valleverdeCourse.holes[0];

  describe('1. Contrato de Telemetría y Ausencia de Geometrías Sintéticas en el Catálogo', () => {
    it('Señorío de Illescas está catalogado explícitamente con hasVerifiedGpsTelemetry: false', () => {
      expect(illescasCourse).toBeDefined();
      expect(illescasCourse.hasVerifiedGpsTelemetry).toBe(false);
    });

    it('todos los hoyos de Señorío de Illescas tienen pois estrictamente vacío (sin bunkers ni doglegs inventados)', () => {
      expect(illescasCourse.holes).toHaveLength(9);
      for (const hole of illescasCourse.holes) {
        expect(hole.pois).toEqual([]);
      }
    });

    it('Valle Verde dispone de telemetría verificada (hasVerifiedGpsTelemetry: true)', () => {
      expect(valleverdeCourse).toBeDefined();
      expect(valleverdeCourse.hasVerifiedGpsTelemetry).toBe(true);
    });

    it('detecta si un campo arbitrario carece de telemetría GPS verificada', () => {
      const unverifiedCourse: GolfApiCourse = {
        ...illescasCourse,
        id: 'test-unverified-course',
        hasVerifiedGpsTelemetry: false,
      };

      const isVerified = (course: GolfApiCourse) => Boolean(course.hasVerifiedGpsTelemetry);
      expect(isVerified(unverifiedCourse)).toBe(false);
      expect(isVerified(valleverdeCourse)).toBe(true);
    });
  });

  describe('2. Vista Aérea del Campo Completo en HoleDiagramView y HoleCartographyMap', () => {
    it('muestra el distintivo "Campo Completo · Telemetría pendiente" cuando hasVerifiedGpsTelemetry={false}', () => {
      const html = renderToStaticMarkup(
        <HoleDiagramView
          hole={illescasHole1}
          clubName={illescasCourse.clubName}
          courseName={illescasCourse.name}
          hasVerifiedGpsTelemetry={false}
          courseLatitude={illescasCourse.latitude}
          courseLongitude={illescasCourse.longitude}
        />
      );

      expect(html).toContain('Campo Completo · Telemetría pendiente');
      expect(html).not.toContain('GPS Oficial');
    });

    it('muestra el botón selector "Campo Completo (PNOA)" y no ofrece el plano técnico vectorial genérico', () => {
      const html = renderToStaticMarkup(
        <HoleDiagramView
          hole={illescasHole1}
          clubName={illescasCourse.clubName}
          courseName={illescasCourse.name}
          hasVerifiedGpsTelemetry={false}
          courseLatitude={illescasCourse.latitude}
          courseLongitude={illescasCourse.longitude}
        />
      );

      expect(html).toContain('Campo Completo (PNOA)');
      // No debe dibujarse el plano vectorial SVG genérico
      expect(html).not.toContain('Plano vectorial del hoyo');
      expect(html).not.toContain('Plano Técnico');
    });

    it('muestra el banner explícito informando de la vista aérea general del campo completo', () => {
      const html = renderToStaticMarkup(
        <HoleDiagramView
          hole={illescasHole1}
          clubName={illescasCourse.clubName}
          courseName={illescasCourse.name}
          hasVerifiedGpsTelemetry={false}
          courseLatitude={illescasCourse.latitude}
          courseLongitude={illescasCourse.longitude}
        />
      );

      expect(html).toContain('Vista aérea del campo completo:');
      expect(html).toContain('Mostrando ortofoto general PNOA/IGN. La posición precisa y el plano de cada hoyo todavía no están disponibles.');
    });

    it('muestra "GPS Oficial" y permite alternar a "Plano Técnico" cuando la telemetría está verificada', () => {
      const html = renderToStaticMarkup(
        <HoleDiagramView
          hole={valleverdeHole1}
          clubName={valleverdeCourse.clubName}
          courseName={valleverdeCourse.name}
          hasVerifiedGpsTelemetry={true}
          courseLatitude={valleverdeCourse.latitude}
          courseLongitude={valleverdeCourse.longitude}
        />
      );

      expect(html).toContain('GPS Oficial');
      expect(html).not.toContain('Campo Completo · Telemetría pendiente');
      expect(html).toContain('Plano Técnico');
    });

    it('renderiza el contenedor accesible de HoleCartographyMap para campo completo con atribución oficial', () => {
      const html = renderToStaticMarkup(
        <HoleCartographyMap
          hole={illescasHole1}
          clubName={illescasCourse.clubName}
          courseName={illescasCourse.name}
          hasVerifiedGpsTelemetry={false}
          courseCoordinates={{
            latitude: illescasCourse.latitude,
            longitude: illescasCourse.longitude,
          }}
        />
      );

      expect(html).toContain('role="region"');
      expect(html).toContain('Mapa satelital PNOA del campo completo');
      expect(html).toContain('Vista Aérea General · Campo Completo');
    });

    it('muestra un estado explicativo si no hay coordenadas verificadas del club en modo campo completo', () => {
      const html = renderToStaticMarkup(
        <HoleCartographyMap
          hole={illescasHole1}
          clubName="Club Sin Coordenadas"
          courseName="Campo Sin Coordenadas"
          hasVerifiedGpsTelemetry={false}
          courseCoordinates={null}
        />
      );

      expect(html).toContain('Ubicación del club no disponible');
      expect(html).toContain('No se dispone de coordenadas geodésicas verificadas de las instalaciones para encuadrar la imagen aérea del campo.');
    });
  });
});
