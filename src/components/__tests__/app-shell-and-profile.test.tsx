import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getClubConfig } from '@/lib/club-config';
import {
  AppShell,
  isHomeAliasPath,
  resolveNavigationItems,
} from '@/components/layout/AppShell';
import { ClubProvider } from '@/components/providers/ClubProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import DashboardPage from '@/app/page';
import EnHomePage from '@/app/en/home/page';
import NotFoundPage from '@/app/not-found';
import ProfilePage from '@/app/(main)/profile/page';
import {
  calculatePlayingHandicap,
  DEMO_HANDICAP_HISTORY,
  DEMO_PROFILES_BY_ROLE,
  isSupabaseConfigured,
} from '@/lib/supabase/client';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

describe('AppShell White-Label Navigation & Perfil con Hándicap', () => {
  it('muestra los 14 módulos de jugador en demo-club (todos los features activos) y oculta /admin a un player', () => {
    const demoClub = getClubConfig('demo-club');
    const playerNav = resolveNavigationItems(demoClub, 'player');

    const ids = playerNav.map((i) => i.id);
    expect(ids).toContain('scorecard');
    expect(ids).toContain('forum');
    expect(ids).toContain('events');
    expect(ids).toContain('admin-chat');
    expect(ids).toContain('profile');
    expect(ids).not.toContain('admin');
  });

  it('habilita el acceso a /admin únicamente para los roles club_admin y superadmin', () => {
    const demoClub = getClubConfig('demo-club');
    const adminNav = resolveNavigationItems(demoClub, 'club_admin');
    const superAdminNav = resolveNavigationItems(demoClub, 'superadmin');

    expect(adminNav.map((i) => i.id)).toContain('admin');
    expect(superAdminNav.map((i) => i.id)).toContain('admin');
  });

  it('filtra automáticamente en AppShell las secciones según las features configuradas del club (ej. forum=false, specialEvents=false)', () => {
    const illescasClub = getClubConfig('senorio-illescas');
    const customConfig = {
      ...illescasClub,
      features: {
        ...illescasClub.features,
        forum: false,
        specialEvents: false,
      },
    };
    const nav = resolveNavigationItems(customConfig, 'player');
    const ids = nav.map((i) => i.id);

    expect(ids).toContain('scorecard');
    expect(ids).toContain('bookings');
    expect(ids).toContain('tournaments');
    expect(ids).not.toContain('forum');
    expect(ids).not.toContain('events');

    // Comprobar que en la configuración oficial de Señorío de Illescas sí están habilitados
    const officialNav = resolveNavigationItems(illescasClub, 'player');
    const officialIds = officialNav.map((i) => i.id);
    expect(officialIds).toContain('forum');
    expect(officialIds).toContain('events');
  });

  it('calcula correctamente el Playing Handicap WHS según Slope, Course Rating y Par', () => {
    // Jugador con Handicap Index 11.4 en barras Amarillas (Slope 128, CR 71.5, Par 72)
    // 11.4 * (128 / 113) + (71.5 - 72) = 12.913 - 0.5 = 12.413 -> 12
    const yellowPlayingHcp = calculatePlayingHandicap({
      handicapIndex: 11.4,
      slopeRating: 128,
      courseRating: 71.5,
      par: 72,
    });
    expect(yellowPlayingHcp).toBe(12);

    // En barras Blancas (Slope 134, CR 73.2, Par 72)
    // 11.4 * (134 / 113) + 1.2 = 13.518 + 1.2 = 14.718 -> 15
    const whitePlayingHcp = calculatePlayingHandicap({
      handicapIndex: 11.4,
      slopeRating: 134,
      courseRating: 73.2,
      par: 72,
    });
    expect(whitePlayingHcp).toBe(15);
  });

  it('proporciona perfiles tipados por rol y detecta configuración de Supabase', () => {
    expect(DEMO_PROFILES_BY_ROLE.player.role).toBe('player');
    expect(DEMO_PROFILES_BY_ROLE.club_admin.role).toBe('club_admin');
    expect(DEMO_PROFILES_BY_ROLE.superadmin.role).toBe('superadmin');
    expect(DEMO_HANDICAP_HISTORY.length).toBeGreaterThanOrEqual(3);

    expect(isSupabaseConfigured('', '')).toBe(false);
    expect(
      isSupabaseConfigured(
        'https://real-club.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      )
    ).toBe(true);
  });

  it('garantiza que la barra superior (<header>) y el menú lateral (<aside>) no se duplican en Inicio, Perfil ni aunque se anide AppShell', () => {
    const dashboardHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(DashboardPage),
        }),
      })
    );
    expect((dashboardHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((dashboardHtml.match(/<aside/g) ?? []).length).toBe(1);

    const profileHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(ProfilePage),
        }),
      })
    );
    expect((profileHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((profileHtml.match(/<aside/g) ?? []).length).toBe(1);

    // Incluso si un componente hijo envuelve por error otro <AppShell>, la guardia de contexto evita duplicar header/aside
    const nestedShellHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(AppShell, {
            children: React.createElement('div', null, 'Contenido Único'),
          }),
        }),
      })
    );
    expect((nestedShellHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((nestedShellHtml.match(/<aside/g) ?? []).length).toBe(1);
    expect(nestedShellHtml).toContain('Contenido Único');
  });

  it('resuelve la ruta /en/home/ y variantes de inicio mostrando la página de Inicio sin error 404', () => {
    expect(isHomeAliasPath('/')).toBe(true);
    expect(isHomeAliasPath('/en/home/')).toBe(true);
    expect(isHomeAliasPath('/en/home')).toBe(true);
    expect(isHomeAliasPath('/es/home/')).toBe(true);
    expect(isHomeAliasPath('/home/')).toBe(true);
    expect(isHomeAliasPath('/en/')).toBe(true);
    expect(isHomeAliasPath('/es/')).toBe(true);
    expect(isHomeAliasPath('/scorecard')).toBe(false);
    expect(isHomeAliasPath('/bookings')).toBe(false);

    const enHomeHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(EnHomePage),
        }),
      })
    );
    expect(enHomeHtml).toContain('Bienvenido,');
    expect(enHomeHtml).toContain('Iniciar Vuelta (Marcador + GPS)');
    expect(enHomeHtml).not.toContain('This page could not be found');
    expect((enHomeHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((enHomeHtml.match(/<aside/g) ?? []).length).toBe(1);

    const notFoundOnAliasHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(NotFoundPage),
        }),
      })
    );
    expect(notFoundOnAliasHtml).toContain('Bienvenido,');
    expect(notFoundOnAliasHtml).not.toContain('This page could not be found');
    expect((notFoundOnAliasHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((notFoundOnAliasHtml.match(/<aside/g) ?? []).length).toBe(1);
  });

  it('renderiza el selector reactivo de tema Dark/Light en AppShell con ThemeProvider sin alterar la navegación', () => {
    const renderedHtml = renderToStaticMarkup(
      React.createElement(ThemeProvider, {
        initialTheme: 'dark',
        children: React.createElement(ClubProvider, {
          initialClubId: 'demo-club',
          children: React.createElement(AppShell, {
            children: React.createElement('div', null, 'Vista con Tema'),
          }),
        }),
      })
    );

    expect(renderedHtml).toContain('Vista con Tema');
    expect(renderedHtml).toContain('aria-label="Cambiar a modo Light"');
    expect((renderedHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((renderedHtml.match(/<aside/g) ?? []).length).toBe(1);
  });

  it('no renderiza etiquetas técnicas como "Online · Supabase Sync" ni "Offline · Local SQLite" en el AppShell', () => {
    const onlineHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement('div', null, 'Contenido'),
        }),
      })
    );

    expect(onlineHtml).not.toContain('Online · Supabase Sync');
    expect(onlineHtml).not.toContain('Offline · Local SQLite');
    expect(onlineHtml).not.toContain('Offline · SQLite Local');
    expect(onlineHtml).not.toContain('Supabase Sync');
    expect(onlineHtml).not.toContain('Local SQLite');
  });

  describe('Navegación Móvil Multisección Accesible en AppShell', () => {
    function extractMobileNavHtml(fullHtml: string): string {
      const match = fullHtml.match(/<nav[^>]*aria-label="Navegación principal móvil"[^>]*>([\s\S]*?)<\/nav>/);
      return match ? match[0] : '';
    }

    it('permite acceder en móvil a todas las secciones disponibles para el rol player (15 módulos sin recortar a 5)', () => {
      const html = renderToStaticMarkup(
        React.createElement(ClubProvider, {
          initialClubId: 'demo-club',
          children: React.createElement(AppShell, {
            children: React.createElement('div', null, 'Contenido Móvil'),
          }),
        })
      );

      const mobileNav = extractMobileNavHtml(html);
      expect(mobileNav).not.toBe('');

      // Extraer todos los hrefs dentro de la barra de navegación móvil
      const hrefMatches = Array.from(mobileNav.matchAll(/href="([^"]+)"/g)).map((m) => m[1]);

      // Verificar que NO está recortado a 5 ítems
      expect(hrefMatches.length).toBe(15);

      // Comprobar que todas las secciones del socio están presentes
      const expectedHrefs = [
        '/',
        '/course',
        '/scorecard',
        '/stats',
        '/bookings',
        '/calendar',
        '/tournaments',
        '/events',
        '/players',
        '/clubs',
        '/news',
        '/info',
        '/forum',
        '/admin-chat',
        '/profile',
      ];
      expectedHrefs.forEach((href) => {
        expect(hrefMatches).toContain(href);
      });

      // El panel de admin debe estar oculto para el socio
      expect(hrefMatches).not.toContain('/admin');

      // El elemento activo de inicio ('/') debe tener aria-current="page"
      expect(mobileNav).toContain('aria-current="page"');

      // Comprobar que el contenedor principal tiene la clase de compensación de padding inferior
      expect(html).toContain('app-content-container');
      expect(mobileNav).toContain('mobile-bottom-nav');
    });

    it('incluye el módulo /admin en la barra móvil para el rol club_admin y superadmin (16 módulos)', () => {
      const demoClub = getClubConfig('demo-club');
      const adminNavItems = resolveNavigationItems(demoClub, 'club_admin');
      const superadminNavItems = resolveNavigationItems(demoClub, 'superadmin');

      expect(adminNavItems.length).toBe(16);
      expect(superadminNavItems.length).toBe(16);
      expect(adminNavItems.map((i) => i.href)).toContain('/admin');
      expect(superadminNavItems.map((i) => i.href)).toContain('/admin');
    });

    it('filtra automáticamente en la barra móvil las secciones deshabilitadas en features del club', () => {
      const illescasClub = getClubConfig('senorio-illescas');
      const customClub = {
        ...illescasClub,
        features: {
          ...illescasClub.features,
          forum: false,
          specialEvents: false,
        },
      };
      const filteredItems = resolveNavigationItems(customClub, 'player');
      const hrefs = filteredItems.map((i) => i.href);

      expect(hrefs).not.toContain('/forum');
      expect(hrefs).not.toContain('/events');
      expect(hrefs).toContain('/scorecard');
      expect(hrefs).toContain('/bookings');
      expect(hrefs).toContain('/profile');
    });

    it('garantiza títulos legibles y soporte en temas Dark y Light en la barra de navegación móvil', () => {
      const darkHtml = renderToStaticMarkup(
        React.createElement(ThemeProvider, {
          initialTheme: 'dark',
          children: React.createElement(ClubProvider, {
            initialClubId: 'demo-club',
            children: React.createElement(AppShell, {
              children: React.createElement('div', null, 'Vista Dark'),
            }),
          }),
        })
      );
      const darkNav = extractMobileNavHtml(darkHtml);
      expect(darkNav).toContain('title="Inicio"');
      expect(darkNav).toContain('title="Marcador &amp; GPS"');
      expect(darkNav).toContain('title="Perfil y Hándicap"');

      const lightHtml = renderToStaticMarkup(
        React.createElement(ThemeProvider, {
          initialTheme: 'light',
          children: React.createElement(ClubProvider, {
            initialClubId: 'demo-club',
            children: React.createElement(AppShell, {
              children: React.createElement('div', null, 'Vista Light'),
            }),
          }),
        })
      );
      const lightNav = extractMobileNavHtml(lightHtml);
      expect(lightNav).toContain('title="Inicio"');
      expect(lightNav).toContain('title="Marcador &amp; GPS"');
      expect(lightNav).toContain('title="Perfil y Hándicap"');
    });
  });

  describe('Reorganización de Controles en Menú de Ajustes de Cabecera (Fase 16)', () => {
    it('agrupa los controles de configuración (tema, idioma, club) dentro de un panel de ajustes accesible desde un botón con icono', () => {
      const html = renderToStaticMarkup(
        React.createElement(ClubProvider, {
          initialClubId: 'demo-club',
          children: React.createElement(AppShell, {
            children: React.createElement('div', null, 'Contenido Principal'),
          }),
        })
      );

      // Botón activador del menú de ajustes en la cabecera
      expect(html).toContain('aria-controls="header-settings-menu"');
      expect(html).toContain('aria-haspopup="dialog"');
      expect(html).toContain('aria-label="Ajustes"');

      // Panel desplegable de ajustes estructurado
      expect(html).toContain('id="header-settings-menu"');
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-label="Ajustes y Preferencias"');

      // Controles agrupados dentro del panel
      expect(html).toContain('aria-label="Selector de club white-label"');
      expect(html).toContain('aria-label="Cambiar a Español"');
      expect(html).toContain('aria-label="Switch to English"');
      expect(html).toContain('aria-label="Cerrar ajustes"');
    });

    it('proporciona etiquetas claras y accesibilidad para teclado y lectores de pantalla en los ajustes', () => {
      const html = renderToStaticMarkup(
        React.createElement(ThemeProvider, {
          initialTheme: 'dark',
          children: React.createElement(ClubProvider, {
            initialClubId: 'demo-club',
            children: React.createElement(AppShell, {
              children: React.createElement('div', null, 'Vista Accesibilidad'),
            }),
          }),
        })
      );

      // Comprobar atributos ARIA
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-label="Cambiar a modo Light"');
      expect(html).toContain('title="Ajustes"');
      expect(html).toContain('Ajustes y Preferencias');
      expect(html).toContain('Tema visual');
      expect(html).toContain('Idioma');
      expect(html).toContain('Club de Golf');
    });

    it('reserva espacio para la identidad del club y evita desbordamiento en pantallas móviles', () => {
      const html = renderToStaticMarkup(
        React.createElement(ClubProvider, {
          initialClubId: 'demo-club',
          children: React.createElement(AppShell, {
            children: React.createElement('div', null, 'Vista Identidad'),
          }),
        })
      );

      // Identidad del club destacada en la cabecera
      expect(html).toContain('Real Club de Golf Valle Verde');
      expect(html).toContain('/clubs/demo-club/logo.svg');

      // Clases de contención para evitar que el menú se salga en pantallas móviles estrechas
      expect(html).toContain('max-w-xs');
      expect(html).toContain('w-[calc(100vw-2rem)]');
      expect(html).toContain('right-0');
    });
  });
});
