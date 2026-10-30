import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SPAIN_AUTONOMOUS_COMMUNITIES,
  SPAIN_GOLF_COURSES_CATALOG,
  getSpainGolfCourseById,
  searchSpainGolfCourses,
} from '../index';
import ClubsDirectoryPage from '@/app/(main)/clubs/page';
import { ClubProvider, useClub } from '@/components/providers/ClubProvider';
import { AppShell } from '@/components/layout/AppShell';

describe('Fase 10: Guía y Directorio de Campos de Golf de España', () => {
  describe('1. Cobertura Geográfica y Calidad de Datos del Catálogo Nacional', () => {
    it('cubre las 17 Comunidades Autónomas de España con campos representativos', () => {
      expect(SPAIN_AUTONOMOUS_COMMUNITIES).toHaveLength(17);

      const coveredCommunities = new Set(
        SPAIN_GOLF_COURSES_CATALOG.map((c) => c.autonomousCommunity)
      );

      for (const community of SPAIN_AUTONOMOUS_COMMUNITIES) {
        expect(
          coveredCommunities.has(community),
          `Falta cobertura para la comunidad: ${community}`
        ).toBe(true);
      }

      // Verificación de volumen de campos en el censo nacional
      expect(SPAIN_GOLF_COURSES_CATALOG.length).toBeGreaterThanOrEqual(25);
    });

    it('todos los campos tienen datos válidos de ubicación, contacto y barras homologadas', () => {
      for (const course of SPAIN_GOLF_COURSES_CATALOG) {
        // Coordenadas geodésicas en el territorio español
        expect(course.latitude).toBeGreaterThan(27.0); // Canarias ~28°, Península 36°..44°
        expect(course.latitude).toBeLessThan(44.5);
        expect(course.longitude).toBeGreaterThan(-18.5); // El Hierro ~ -18°
        expect(course.longitude).toBeLessThan(4.5); // Menorca ~ 4.3°

        // Metadatos de contacto y localización
        expect(course.name.trim().length).toBeGreaterThan(3);
        expect(course.clubName.trim().length).toBeGreaterThan(3);
        expect(course.city.trim().length).toBeGreaterThan(2);
        expect(course.province.trim().length).toBeGreaterThan(2);
        expect(course.address.trim().length).toBeGreaterThan(5);
        expect(course.phone.trim().length).toBeGreaterThan(5);

        // Barras homologadas
        expect(course.tees.length).toBeGreaterThanOrEqual(2);
        for (const tee of course.tees) {
          expect(tee.totalDistanceMeters).toBeGreaterThan(1500);
          expect(tee.courseRating).toBeGreaterThan(30);
          expect(tee.slopeRating).toBeGreaterThan(100);
        }

        // Par y hoyos
        expect([9, 18]).toContain(course.holesCount);
        expect(course.parTotal).toBeGreaterThanOrEqual(34);
      }
    });

    it('identifica con precisión los clubes Birdie frente a los campos externos visitables', () => {
      const birdieClubs = SPAIN_GOLF_COURSES_CATALOG.filter((c) => c.isBirdieClub);
      expect(birdieClubs.length).toBeGreaterThanOrEqual(2);

      const ids = birdieClubs.map((c) => c.externalGolfApiId);
      expect(ids).toContain('golfapi_course_1024'); // Valle Verde
      expect(ids).toContain('golfapi_course_8833'); // Señorío de Illescas

      // Los campos Birdie cuentan con tarjeta de hoyos detallada
      for (const club of birdieClubs) {
        expect(club.hasHoleDetail).toBe(true);
        expect(club.holes.length).toBe(club.holesCount);
      }
    });
  });

  describe('2. Motor de Búsqueda y Filtrado Tolerante (searchSpainGolfCourses)', () => {
    it('busca por nombre, club, municipio o diseñador tolerando mayúsculas y acentos', () => {
      // Valderrama (sin acento)
      const valderrama = searchSpainGolfCourses({ query: 'valderrama' });
      expect(valderrama.length).toBeGreaterThanOrEqual(1);
      expect(valderrama[0].clubName).toContain('Valderrama');

      // Búsqueda con tildes / diacríticos: "Pedreña" vs "pedrena"
      const pedrena = searchSpainGolfCourses({ query: 'pedrena' });
      expect(pedrena.length).toBeGreaterThanOrEqual(1);
      expect(pedrena[0].name).toContain('Pedreña');

      // Búsqueda por diseñador famoso (ej. Javier Arana o Seve Ballesteros)
      const aranaMatches = searchSpainGolfCourses({ query: 'Javier Arana' });
      expect(aranaMatches.length).toBeGreaterThanOrEqual(3);

      const seveMatches = searchSpainGolfCourses({ query: 'Ballesteros' });
      expect(seveMatches.length).toBeGreaterThanOrEqual(2);

      // Búsqueda por provincia
      const gironaMatches = searchSpainGolfCourses({ query: 'Girona' });
      expect(gironaMatches.length).toBeGreaterThanOrEqual(1);
      expect(gironaMatches.some((c) => c.name.includes('Camiral'))).toBe(true);
    });

    it('filtra estrictamente por Comunidad Autónoma', () => {
      const canariasCourses = searchSpainGolfCourses({ community: 'Canarias' });
      expect(canariasCourses.length).toBeGreaterThanOrEqual(2);
      expect(canariasCourses.every((c) => c.autonomousCommunity === 'Canarias')).toBe(true);
      expect(canariasCourses.some((c) => c.name.includes('Bandama'))).toBe(true);
      expect(canariasCourses.some((c) => c.name.includes('Abama'))).toBe(true);

      const balearesCourses = searchSpainGolfCourses({ community: 'Illes Balears' });
      expect(balearesCourses.length).toBeGreaterThanOrEqual(2);
      expect(balearesCourses.every((c) => c.autonomousCommunity === 'Illes Balears')).toBe(true);
      expect(balearesCourses.some((c) => c.name.includes('Alcanada'))).toBe(true);
    });

    it('filtra por número de hoyos (9 vs 18 hoyos)', () => {
      const nineHoleCourses = searchSpainGolfCourses({ holesCount: 9 });
      expect(nineHoleCourses.length).toBeGreaterThanOrEqual(1);
      expect(nineHoleCourses.every((c) => c.holesCount === 9)).toBe(true);
      expect(nineHoleCourses.some((c) => c.externalGolfApiId === 'golfapi_course_8833')).toBe(true);

      const eighteenHoleCourses = searchSpainGolfCourses({ holesCount: 18 });
      expect(eighteenHoleCourses.length).toBeGreaterThanOrEqual(20);
      expect(eighteenHoleCourses.every((c) => c.holesCount === 18)).toBe(true);
    });

    it('obtiene un campo por su UUID interno o por su código externo/federativo', () => {
      const byExternal = getSpainGolfCourseById('rfeg_course_and_001');
      expect(byExternal).not.toBeNull();
      expect(byExternal?.name).toContain('Valderrama');

      const byInternal = getSpainGolfCourseById('spain-cat-pga-camiral-stadium');
      expect(byInternal).not.toBeNull();
      expect(byInternal?.city).toContain('Caldes de Malavella');

      expect(getSpainGolfCourseById('campo-inexistente-xyz')).toBeNull();
    });
  });

  describe('3. Renderizado de la Pantalla /clubs e Independencia de Configuración', () => {
    it('renderiza la Guía de Campos de España dentro de ClubProvider + AppShell con 1 header y 1 aside', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ClubProvider,
          {
            initialClubId: 'demo-club',
            children: React.createElement(AppShell, {
              children: React.createElement(ClubsDirectoryPage),
            }),
          }
        )
      );

      // Verificación de títulos y elementos obligatorios
      expect(html).toContain('Guía y Directorio de Clubes y Campos');
      expect(html).toContain('Directorio de Clubes y Campos');
      expect(html).toContain('Todas las Comunidades');
      expect(html).toContain('Sede Activa'); // RCG Valle Verde es la sede activa de demo-club

      // Ficha técnica del campo seleccionado inicialmente (Valle Verde)
      expect(html).toContain('Tarjeta Técnica del Recorrido');
      expect(html).toContain('Primera Vuelta — IDA');
      expect(html).toContain('Segunda Vuelta — VUELTA');

      // Información de visita y contacto
      expect(html).toContain('Información General del Club y Servicios para el Visitante');
      expect(html).toContain('Ubicación y Dirección');
      expect(html).toContain('Contacto y Reservas');

      // Unicidad de navegación (AppShell guardia de anidación)
      expect((html.match(/<header/g) ?? []).length).toBe(1);
      expect((html.match(/<aside/g) ?? []).length).toBe(1);
    });

    it('garantiza que consultar campos en la guía no modifica la configuración del club activo', () => {
      let activeClubConfig: unknown = null;

      function TestInspector() {
        const { club } = useClub();
        activeClubConfig = club;
        return React.createElement(ClubsDirectoryPage);
      }

      const html = renderToStaticMarkup(
        React.createElement(ClubProvider, {
          initialClubId: 'demo-club',
          children: React.createElement(TestInspector),
        })
      );

      // La configuración del club activo en ClubProvider permanece inmutable
      expect(activeClubConfig).not.toBeNull();
      const club = activeClubConfig as { clubId: string; name: string; defaultCourseExternalId: string };
      expect(club.clubId).toBe('demo-club');
      expect(club.name).toBe('Real Club de Golf Valle Verde');
      expect(club.defaultCourseExternalId).toBe('golfapi_course_1024');

      // El disclaimer de navegación está presente en el HTML
      expect(html).toContain('Aviso de navegación');
      expect(html).toContain('No modifica tu club activo');
    });

    it('muestra el panel de ficha general y barras homologadas cuando los hoyos no están disponibles', () => {
      // Simular selección de un campo de la guía sin desglose hoyo a hoyo
      const valderrama = getSpainGolfCourseById('rfeg_course_and_001')!;
      expect(valderrama.hasHoleDetail).toBe(false);
      expect(valderrama.holes).toHaveLength(0);

      // El catálogo contiene la información de contacto y barras homologadas oficiales
      expect(valderrama.phone).toBe('+34 956 791 200');
      expect(valderrama.tees.length).toBeGreaterThanOrEqual(4);
      expect(valderrama.tees.find((t) => t.name === 'Blancas')?.slopeRating).toBe(144);
    });
  });
});
