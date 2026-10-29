import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  filterClubInfoPages,
  filterDirectoryPlayers,
  filterNewsArticles,
  INITIAL_CLUB_INFO_PAGES,
  INITIAL_DIRECTORY_PLAYERS,
  INITIAL_NEWS_ARTICLES,
  loadClubInfoPages,
  loadDirectoryPlayers,
  loadNewsArticles,
  publishNewsArticle,
  updateClubInfoPage,
} from '../index';
import { isValidUuid } from '@/lib/competition';
import { ClubProvider } from '@/components/providers/ClubProvider';
import { AppShell } from '@/components/layout/AppShell';
import PlayerDirectoryPage from '@/app/(main)/players/page';
import ClubNewsPage from '@/app/(main)/news/page';
import ClubInfoPage from '@/app/(main)/info/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/players',
}));

describe('Comunidad y Administración — Subfase 4.1: Directorio de Jugadores (/players)', () => {
  it('excluye estrictamente perfiles con isDirectoryVisible = false y ordena por hándicap ascendente', () => {
    // El catálogo semilla incluye perfiles ocultos para validar el filtro de privacidad
    const hiddenInSeed = INITIAL_DIRECTORY_PLAYERS.filter(
      (p) => !p.isDirectoryVisible
    );
    expect(hiddenInSeed.length).toBeGreaterThanOrEqual(2);

    const visible = filterDirectoryPlayers(INITIAL_DIRECTORY_PLAYERS);
    expect(visible.length).toBe(
      INITIAL_DIRECTORY_PLAYERS.length - hiddenInSeed.length
    );
    expect(visible.every((p) => p.isDirectoryVisible === true)).toBe(true);
    expect(visible.every((p) => isValidUuid(p.id))).toBe(true);

    // Ningún perfil oculto aparece en los resultados
    expect(
      visible.some((p) => p.fullName.includes('Privacidad Activada'))
    ).toBe(false);
    expect(visible.some((p) => p.role === 'superadmin')).toBe(false);

    // Verifica ordenación ascendente por handicapIndex
    for (let i = 1; i < visible.length; i++) {
      expect(visible[i].handicapIndex).toBeGreaterThanOrEqual(
        visible[i - 1].handicapIndex
      );
    }
  });

  it('filtra jugadores por búsqueda libre (nombre, licencia, bio) y por tramos de hándicap (low, mid, high, min/max)', () => {
    const byName = filterDirectoryPlayers(INITIAL_DIRECTORY_PLAYERS, {
      searchQuery: 'elena',
    });
    expect(byName).toHaveLength(1);
    expect(byName[0].fullName).toBe('Elena Ruiz');

    const byLicense = filterDirectoryPlayers(INITIAL_DIRECTORY_PLAYERS, {
      searchQuery: 'AM-284910',
    });
    expect(byLicense).toHaveLength(1);
    expect(byLicense[0].fullName).toBe('Carlos Mendoza');

    // Tramo 1ª categoría (<= 10.0)
    const lowBracket = filterDirectoryPlayers(INITIAL_DIRECTORY_PLAYERS, {
      bracket: 'low',
    });
    expect(lowBracket.length).toBeGreaterThanOrEqual(3);
    expect(lowBracket.every((p) => p.handicapIndex <= 10.0)).toBe(true);

    // Tramo 2ª categoría (10.1 .. 20.0)
    const midBracket = filterDirectoryPlayers(INITIAL_DIRECTORY_PLAYERS, {
      bracket: 'mid',
    });
    expect(midBracket.length).toBeGreaterThanOrEqual(3);
    expect(
      midBracket.every((p) => p.handicapIndex > 10.0 && p.handicapIndex <= 20.0)
    ).toBe(true);

    // Tramo 3ª categoría (> 20.0)
    const highBracket = filterDirectoryPlayers(INITIAL_DIRECTORY_PLAYERS, {
      bracket: 'high',
    });
    expect(highBracket).toHaveLength(1);
    expect(highBracket[0].fullName).toBe('Pedro Navarro');

    // Rango numérico explícito minHandicap / maxHandicap
    const customRange = filterDirectoryPlayers(INITIAL_DIRECTORY_PLAYERS, {
      minHandicap: 5.0,
      maxHandicap: 12.0,
    });
    expect(
      customRange.every(
        (p) => p.handicapIndex >= 5.0 && p.handicapIndex <= 12.0
      )
    ).toBe(true);
  });

  it('carga jugadores desde Supabase mapeando UUIDs reales y descartando perfiles no visibles', async () => {
    const mockClient = {
      from: (table: string) => {
        expect(table).toBe('profiles');
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    id: 'aaaa0000-0000-0000-0000-000000000801',
                    email: 'socio.bd@club.es',
                    full_name: 'Socio Real Supabase',
                    federation_license: 'AM-800801',
                    handicap_index: 8.4,
                    role: 'player',
                    phone: '+34 600 800 801',
                    bio: 'Cargado desde Supabase',
                    is_directory_visible: true,
                    updated_at: '2026-10-28T11:00:00Z',
                  },
                  {
                    id: 'aaaa0000-0000-0000-0000-000000000802',
                    email: 'oculto.bd@club.es',
                    full_name: 'Socio Oculto BD',
                    federation_license: 'AM-800802',
                    handicap_index: 4.0,
                    role: 'player',
                    is_directory_visible: false,
                    updated_at: '2026-10-28T11:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      },
    } as unknown as ReturnType<
      typeof import('@/lib/supabase/client').getSupabaseClient
    >;

    const res = await loadDirectoryPlayers(mockClient);
    expect(res.meta.persistedToBackend).toBe(true);
    expect(res.players).toHaveLength(1);
    expect(res.players[0].fullName).toBe('Socio Real Supabase');
  });

  it('renderiza mediante SSR la pantalla /players dentro de ClubProvider + AppShell sin duplicar navegación y sin mostrar perfiles ocultos', () => {
    const html = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(PlayerDirectoryPage),
        }),
      })
    );

    expect(html).toContain('Directorio de Jugadores');
    expect(html).toContain('Javier Ortega');
    expect(html).toContain('Elena Ruiz');
    expect(html).not.toContain('Socio con Privacidad Activada');
    expect((html.match(/<header/g) ?? []).length).toBe(1);
    expect((html.match(/<aside/g) ?? []).length).toBe(1);
  });

  it('filtra noticias ocultando borradores a socios normales y restringe publishNewsArticle y updateClubInfoPage a club_admin/superadmin (Subfase 4.2)', async () => {
    // Un socio normal ('player') solo ve noticias publicadas (2 de las 3 en semilla), con fijadas primero
    const visibleForPlayer = filterNewsArticles(INITIAL_NEWS_ARTICLES, {
      viewerRole: 'player',
      includeUnpublished: true,
    });
    expect(visibleForPlayer).toHaveLength(2);
    expect(visibleForPlayer[0].isPinned).toBe(true);
    expect(
      visibleForPlayer.some((a) => a.slug === 'borrador-calendario-invierno-2027')
    ).toBe(false);

    // Un club_admin con includeUnpublished ve también los borradores internos (3)
    const visibleForAdmin = filterNewsArticles(INITIAL_NEWS_ARTICLES, {
      viewerRole: 'club_admin',
      includeUnpublished: true,
    });
    expect(visibleForAdmin).toHaveLength(3);

    // Rechaza intento de publicar noticia si el rol es 'player'
    await expect(
      publishNewsArticle(
        INITIAL_NEWS_ARTICLES,
        {
          title: 'Intento no autorizado',
          summary: 'Resumen',
          content: 'Contenido',
          authorId: 'aaaa0000-0000-0000-0000-000000000001',
          actorRole: 'player',
        },
        null
      )
    ).rejects.toThrow(/Permiso denegado \(RLS\)/);

    // Permite publicar a un club_admin y coloca la noticia fijada al inicio
    const pubRes = await publishNewsArticle(
      INITIAL_NEWS_ARTICLES,
      {
        title: 'Nuevo Torneo de Navidad 2026',
        summary: 'Modalidad Scramble por parejas',
        content: 'Inscripciones abiertas a partir del lunes.',
        isPinned: true,
        authorId: 'aaaa0000-0000-0000-0000-000000000003',
        actorRole: 'club_admin',
      },
      null
    );
    expect(pubRes.createdArticle.slug).toBe('nuevo-torneo-de-navidad-2026');
    expect(pubRes.updatedArticles[0].title).toBe('Nuevo Torneo de Navidad 2026');

    // Filtrado de páginas de información por categoría y control de permisos en updateClubInfoPage
    const normativaPages = filterClubInfoPages(
      INITIAL_CLUB_INFO_PAGES,
      'normativa'
    );
    expect(normativaPages).toHaveLength(1);
    expect(normativaPages[0].slug).toBe('reglas-locales');

    await expect(
      updateClubInfoPage(
        INITIAL_CLUB_INFO_PAGES,
        {
          slug: 'reglas-locales',
          title: 'Reglas Alteradas',
          category: 'normativa',
          contentMarkdown: 'Intento de edición por player',
          actorUserId: 'aaaa0000-0000-0000-0000-000000000001',
          actorRole: 'player',
        },
        null
      )
    ).rejects.toThrow(/Permiso denegado \(RLS\)/);

    const updatedInfo = await updateClubInfoPage(
      INITIAL_CLUB_INFO_PAGES,
      {
        slug: 'reglas-locales',
        title: 'Reglas Locales Oficiales 2026',
        category: 'normativa',
        contentMarkdown: '1. Colocación de bola preferente en calle (invierno).',
        actorUserId: 'aaaa0000-0000-0000-0000-000000000003',
        actorRole: 'club_admin',
      },
      null
    );
    expect(updatedInfo.savedPage.title).toBe('Reglas Locales Oficiales 2026');

    // Verifica carga desde cliente Supabase simulado
    const mockNewsAndInfoClient = {
      from: (table: string) => {
        if (table === 'news_articles') {
          return {
            select: () => ({
              order: () => ({
                order: async () => ({
                  data: [
                    {
                      id: '66666666-6666-4666-8666-000000000099',
                      title: 'Noticia desde Supabase',
                      slug: 'noticia-supabase',
                      summary: 'Resumen BD',
                      content: 'Cuerpo BD',
                      is_pinned: true,
                      is_published: true,
                      published_at: '2026-10-28T10:00:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'club_info_pages') {
          return {
            select: () => ({
              order: async () => ({
                data: [
                  {
                    id: '77777777-7777-4777-8777-000000000199',
                    slug: 'reglas-locales',
                    title: 'Reglas desde Supabase',
                    category: 'normativa',
                    content_markdown: 'Texto BD',
                    display_order: 1,
                    updated_at: '2026-10-28T10:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`Tabla inesperada: ${table}`);
      },
    } as unknown as ReturnType<
      typeof import('@/lib/supabase/client').getSupabaseClient
    >;

    const loadedNews = await loadNewsArticles('player', mockNewsAndInfoClient);
    expect(loadedNews.meta.persistedToBackend).toBe(true);
    expect(loadedNews.articles[0].title).toBe('Noticia desde Supabase');

    const loadedInfo = await loadClubInfoPages(mockNewsAndInfoClient);
    expect(loadedInfo.meta.persistedToBackend).toBe(true);
    expect(loadedInfo.pages[0].title).toBe('Reglas desde Supabase');
  });

  it('renderiza mediante SSR las pantallas /news e /info dentro de ClubProvider + AppShell con 1 <header> y 1 <aside>', () => {
    const newsHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(ClubNewsPage),
        }),
      })
    );
    expect(newsHtml).toContain('Noticias de Real Club de Golf Valle Verde');
    expect(newsHtml).toContain(
      'Pinchado hueco de greens y preparación del Torneo de Otoño'
    );
    // Por defecto el rol inicial en ClubProvider es 'player', por lo que no debe renderizar el formulario de publicación ni el borrador interno
    expect(newsHtml).not.toContain('Publicar Comunicado Oficial');
    expect(newsHtml).not.toContain('Borrador interno del Comité');
    expect((newsHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((newsHtml.match(/<aside/g) ?? []).length).toBe(1);

    const infoHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(ClubInfoPage),
        }),
      })
    );
    expect(infoHtml).toContain(
      'Información de Interés — Real Club de Golf Valle Verde'
    );
    expect(infoHtml).toContain('Reglas Locales y Etiqueta');
    expect(infoHtml).toContain('secretaria@rcgvalleverde.es');
    expect(infoHtml).not.toContain('Editar Información del Club');
    expect((infoHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((infoHtml.match(/<aside/g) ?? []).length).toBe(1);
  });
});
