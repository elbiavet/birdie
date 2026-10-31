import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  es,
  en,
  getTranslation,
  isValidLanguage,
  resolveInitialLanguage,
  LANGUAGE_STORAGE_KEY,
  DEFAULT_LANGUAGE,
} from '@/lib/i18n';
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { AppShell } from '@/components/layout/AppShell';
import { ClubProvider } from '@/components/providers/ClubProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import CourseTourPage from '@/app/(main)/course/page';
import DashboardPage from '@/app/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

describe('Fase 8 - Subfase 8.3: Sistema de Internacionalización (i18n Español / Inglés)', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        }),
      },
      navigator: {
        language: 'es-ES',
      },
      location: {
        pathname: '/',
        assign: vi.fn(),
      },
      history: {
        replaceState: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('1. Paridad Estricta de Diccionarios (es / en)', () => {
    function getLeafKeys(obj: Record<string, any>, prefix = ''): string[] {
      let keys: string[] = [];
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          keys = keys.concat(getLeafKeys(obj[key], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    }

    it('los diccionarios en español e inglés contienen exactamente las mismas claves', () => {
      const esKeys = getLeafKeys(es).sort();
      const enKeys = getLeafKeys(en).sort();

      expect(esKeys).toEqual(enKeys);
      expect(esKeys.length).toBeGreaterThan(40);
    });

    it('ningún valor en los diccionarios es una cadena vacía o undefined', () => {
      const esKeys = getLeafKeys(es);
      for (const k of esKeys) {
        const esVal = getTranslation('es', k);
        const enVal = getTranslation('en', k);
        expect(esVal.trim().length).toBeGreaterThan(0);
        expect(enVal.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('2. Motor de Traducción y Validación de Idiomas', () => {
    it('valida estrictamente idiomas soportados y rechaza no válidos o corruptos', () => {
      expect(isValidLanguage('es')).toBe(true);
      expect(isValidLanguage('en')).toBe(true);
      expect(isValidLanguage('fr')).toBe(false);
      expect(isValidLanguage('')).toBe(false);
      expect(isValidLanguage(null)).toBe(false);
      expect(isValidLanguage(undefined)).toBe(false);
      expect(isValidLanguage(123)).toBe(false);
      expect(isValidLanguage({ lang: 'es' })).toBe(false);
    });

    it('traduce correctamente claves anidadas en español e inglés', () => {
      expect(getTranslation('es', 'nav.course')).toBe('Recorrido');
      expect(getTranslation('en', 'nav.course')).toBe('Course Tour');

      expect(getTranslation('es', 'common.login')).toBe('Iniciar Sesión');
      expect(getTranslation('en', 'common.login')).toBe('Log In');

      expect(getTranslation('es', 'home.exactHandicap')).toBe('Hándicap Exacto');
      expect(getTranslation('en', 'home.exactHandicap')).toBe('Exact Handicap');
    });

    it('aplica fallback a español o fallback explícito ante claves inexistentes', () => {
      expect(getTranslation('en', 'inexistente.clave', 'Texto de Respaldo')).toBe('Texto de Respaldo');
      expect(getTranslation('es', 'inexistente.clave')).toBe('inexistente.clave');
    });
  });

  describe('3. Detección y Resolución de Idioma Inicial', () => {
    it('recupera el idioma guardado en localStorage si es válido', () => {
      mockStorage[LANGUAGE_STORAGE_KEY] = 'en';
      expect(resolveInitialLanguage()).toBe('en');

      mockStorage[LANGUAGE_STORAGE_KEY] = 'es';
      expect(resolveInitialLanguage()).toBe('es');
    });

    it('realiza fallback seguro a DEFAULT_LANGUAGE (es) ante preferencias corruptas o no válidas', () => {
      mockStorage[LANGUAGE_STORAGE_KEY] = 'de';
      expect(resolveInitialLanguage()).toBe(DEFAULT_LANGUAGE);

      mockStorage[LANGUAGE_STORAGE_KEY] = 'INVALID_LANG_CODE';
      expect(resolveInitialLanguage()).toBe(DEFAULT_LANGUAGE);

      mockStorage[LANGUAGE_STORAGE_KEY] = '';
      expect(resolveInitialLanguage()).toBe(DEFAULT_LANGUAGE);
    });

    it('detecta inglés desde el navegador si no hay preferencia en localStorage', () => {
      delete mockStorage[LANGUAGE_STORAGE_KEY];
      (window.navigator as any).language = 'en-US';
      expect(resolveInitialLanguage()).toBe('en');

      (window.navigator as any).language = 'en-GB';
      expect(resolveInitialLanguage()).toBe('en');

      (window.navigator as any).language = 'es-ES';
      expect(resolveInitialLanguage()).toBe('es');
    });
  });

  describe('4. Renderizado SSR en Ambos Idiomas con AppShell y Pantallas', () => {
    it('renderiza AppShell con textos en español cuando el idioma es es', () => {
      const html = renderToStaticMarkup(
        <ThemeProvider>
          <LanguageProvider initialLanguage="es">
            <ClubProvider initialClubId="demo-club">
              <AppShell>
                <div data-testid="content">Contenido de prueba</div>
              </AppShell>
            </ClubProvider>
          </LanguageProvider>
        </ThemeProvider>
      );

      // Elementos de navegación en español
      expect(html).toContain('Recorrido');
      expect(html).toContain('Inicio');
      expect(html).toContain('Marcador &amp; GPS');
      expect(html).toContain('Estadísticas');

      // Botón selector de idioma presente con opciones ES y EN
      expect(html).toContain('aria-label="Cambiar a Español"');
      expect(html).toContain('aria-label="Switch to English"');
      expect(html).toContain('ES');
      expect(html).toContain('EN');
    });

    it('renderiza AppShell con textos en inglés cuando el idioma es en', () => {
      const html = renderToStaticMarkup(
        <ThemeProvider>
          <LanguageProvider initialLanguage="en">
            <ClubProvider initialClubId="demo-club">
              <AppShell>
                <div data-testid="content">Test Content</div>
              </AppShell>
            </ClubProvider>
          </LanguageProvider>
        </ThemeProvider>
      );

      // Elementos de navegación traducidos a inglés
      expect(html).toContain('Course Tour');
      expect(html).toContain('Dashboard');
      expect(html).toContain('Scorecard &amp; GPS');
      expect(html).toContain('Statistics');
      expect(html).toContain('Tee Bookings');
      expect(html).toContain('Match Calendar');
    });

    it('renderiza la página de Recorrido (/course) completamente en inglés cuando language es en', () => {
      const html = renderToStaticMarkup(
        <ThemeProvider>
          <LanguageProvider initialLanguage="en">
            <ClubProvider initialClubId="demo-club">
              <CourseTourPage />
            </ClubProvider>
          </LanguageProvider>
        </ThemeProvider>
      );

      expect(html).toContain('Course Tour');
      expect(html).toContain('Official Course Guide · Golf API');
      expect(html).toContain('Distances from Tee Boxes');
      expect(html).toContain('White');
      expect(html).toContain('Yellow');
      expect(html).toContain('Blue');
      expect(html).toContain('Red');
      expect(html).toContain('Official GPS Coordinates (Green &amp; Tee)');
      expect(html).toContain('Course Loop Technical Summary');
      expect(html).toContain('Front Nine (Holes 1 to 9)');
      expect(html).toContain('Back Nine (Holes 10 to 18)');
      expect(html).toContain('Full Course (18 Holes)');
    });

    it('renderiza el Dashboard principal (/) traducido al inglés cuando language es en', () => {
      const html = renderToStaticMarkup(
        <ThemeProvider>
          <LanguageProvider initialLanguage="en">
            <ClubProvider initialClubId="demo-club" initialProfile={null}>
              <DashboardPage />
            </ClubProvider>
          </LanguageProvider>
        </ThemeProvider>
      );

      expect(html).toContain('Welcome, Guest');
      expect(html).toContain('Federation License');
      expect(html).toContain('Exact Handicap');
      expect(html).toContain('Scorecard Engine');
      expect(html).toContain('Synchronized');
      expect(html).not.toContain('Realtime + SQLite');
      expect(html).toContain('Active Modules');
      expect(html).toContain('Start Round (Scorecard + GPS)');
      expect(html).toContain('Book Tee Time');
      expect(html).toContain('My Profile &amp; WHS Handicap');
      expect(html).toContain('Club Ecosystem');
    });
  });
});
