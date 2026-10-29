import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  assertAdminRole,
  canAccessAdminPanel,
  computeAdminDashboardStats,
  createForumThread,
  filterClubInfoPages,
  filterDirectoryPlayers,
  filterForumThreads,
  filterNewsArticles,
  getVisibleAdminChatRooms,
  INITIAL_ADMIN_CHAT_ROOMS,
  INITIAL_CLUB_INFO_PAGES,
  INITIAL_DIRECTORY_PLAYERS,
  INITIAL_FORUM_THREADS,
  INITIAL_NEWS_ARTICLES,
  loadAdminChatRooms,
  loadAdminDashboardStats,
  loadClubInfoPages,
  loadDirectoryPlayers,
  loadForumThreads,
  loadNewsArticles,
  publishNewsArticle,
  replyToForumThread,
  sendAdminChatMessage,
  subscribeToAdminChatRealtime,
  subscribeToForumRealtime,
  toggleForumThreadLock,
  updateClubInfoPage,
} from '../index';
import { isValidUuid } from '@/lib/competition';
import { DEMO_PROFILES_BY_ROLE } from '@/lib/supabase/client';
import { ClubProvider } from '@/components/providers/ClubProvider';
import { AppShell } from '@/components/layout/AppShell';
import PlayerDirectoryPage from '@/app/(main)/players/page';
import ClubNewsPage from '@/app/(main)/news/page';
import ClubInfoPage from '@/app/(main)/info/page';
import ForumPage from '@/app/(main)/forum/page';
import AdminChatPage from '@/app/(main)/admin-chat/page';
import AdminDashboardPage from '@/app/(main)/admin/page';

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

describe('Comunidad y Administración — Subfase 4.3: Foro del Club en Tiempo Real (/forum)', () => {
  it('filtra hilos por categoría, busca texto y sitúa debates fijados (isPinned = true) en primer lugar con UUIDs válidos', () => {
    expect(INITIAL_FORUM_THREADS.length).toBeGreaterThanOrEqual(4);
    for (const thread of INITIAL_FORUM_THREADS) {
      expect(isValidUuid(thread.id)).toBe(true);
      expect(isValidUuid(thread.authorId)).toBe(true);
      for (const post of thread.posts ?? []) {
        expect(isValidUuid(post.id)).toBe(true);
        expect(isValidUuid(post.threadId)).toBe(true);
        expect(isValidUuid(post.authorId)).toBe(true);
      }
    }

    // Filtrar por categoría rules
    const rulesThreads = filterForumThreads(INITIAL_FORUM_THREADS, {
      category: 'rules',
    });
    expect(rulesThreads.length).toBeGreaterThanOrEqual(1);
    expect(rulesThreads.every((t) => t.category === 'rules')).toBe(true);

    // Búsqueda por texto (fitting / varillas)
    const equipmentMatches = filterForumThreads(INITIAL_FORUM_THREADS, {
      searchQuery: 'fitting',
    });
    expect(equipmentMatches.length).toBeGreaterThanOrEqual(1);
    expect(equipmentMatches[0].category).toBe('equipment');

    // Debates fijados (isPinned = true) van primero
    const sorted = filterForumThreads(INITIAL_FORUM_THREADS, { category: 'all' });
    expect(sorted[0].isPinned).toBe(true);
  });

  it('permite abrir debates, añadir respuestas y bloquea respuestas de socios estándar en hilos cerrados (RLS)', async () => {
    // 1. Crear nuevo debate
    const { updatedThreads, createdThread } = await createForumThread(
      INITIAL_FORUM_THREADS,
      {
        authorId: 'aaaa0000-0000-0000-0000-000000000201',
        authorName: 'Elena Ruiz',
        actorRole: 'player',
        category: 'general',
        title: 'Horario del Restaurante en días de torneo',
        body: '¿Alguien sabe si el menú de golfistas abre a las 13:00 en días de mediodía?',
      }
    );
    expect(createdThread.title).toBe('Horario del Restaurante en días de torneo');
    expect(createdThread.isPinned).toBe(false); // Un player no puede fijar
    expect(updatedThreads.some((t) => t.id === createdThread.id)).toBe(true);

    // 2. Responder a debate abierto
    const { updatedThreads: threadsWithReply, createdPost } = await replyToForumThread(
      updatedThreads,
      {
        threadId: createdThread.id,
        authorId: 'aaaa0000-0000-0000-0000-000000000001',
        authorName: 'Carlos Mendoza',
        actorRole: 'player',
        body: 'Sí, la cocina abre a las 13:00 ininterrumpida.',
      }
    );
    expect(createdPost.body).toContain('ininterrumpida');
    const repliedThread = threadsWithReply.find((t) => t.id === createdThread.id);
    expect(repliedThread?.postsCount).toBe(1);

    // 3. Intento de responder a hilo cerrado como 'player' -> Debe lanzar error
    const lockedThread = INITIAL_FORUM_THREADS.find((t) => t.isLocked);
    expect(lockedThread).toBeDefined();

    await expect(
      replyToForumThread(INITIAL_FORUM_THREADS, {
        threadId: lockedThread!.id,
        authorId: 'aaaa0000-0000-0000-0000-000000000201',
        authorName: 'Elena Ruiz',
        actorRole: 'player',
        body: 'Intento de escribir en hilo cerrado',
      })
    ).rejects.toThrow(/Debate cerrado \(RLS\)/);

    // 4. Un 'club_admin' sí puede responder en un hilo cerrado
    const { createdPost: adminReply } = await replyToForumThread(INITIAL_FORUM_THREADS, {
      threadId: lockedThread!.id,
      authorId: 'aaaa0000-0000-0000-0000-000000000003',
      authorName: 'Laura Gómez (Comité)',
      actorRole: 'club_admin',
      body: 'Nota adicional de administración en debate cerrado.',
    });
    expect(adminReply.authorRole).toBe('club_admin');

    // 5. Intento de alternar bloqueo como 'player' -> Debe fallar
    await expect(
      toggleForumThreadLock(INITIAL_FORUM_THREADS, {
        threadId: lockedThread!.id,
        actorRole: 'player',
        isLocked: false,
      })
    ).rejects.toThrow(/Permiso denegado \(RLS\)/);

    // 6. Un 'club_admin' sí puede alternar el bloqueo
    const { updatedThread: unlockedThread } = await toggleForumThreadLock(
      INITIAL_FORUM_THREADS,
      {
        threadId: lockedThread!.id,
        actorRole: 'club_admin',
        isLocked: false,
      }
    );
    expect(unlockedThread.isLocked).toBe(false);
  });

  it('carga hilos desde cliente Supabase mockeado y gestiona suscripción Realtime', async () => {
    const mockForumClient = {
      from: (table: string) => {
        if (table === 'forum_threads') {
          return {
            select: () => ({
              order: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: '88888888-8888-4888-8888-000000000099',
                        author_id: 'aaaa0000-0000-0000-0000-000000000003',
                        category: 'competitions',
                        title: 'Debate cargado de Supabase',
                        body: 'Cuerpo del debate en base de datos.',
                        is_pinned: true,
                        is_locked: false,
                        created_at: '2026-10-28T10:00:00Z',
                        updated_at: '2026-10-28T10:00:00Z',
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'forum_posts') {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: '99999999-9999-4999-8999-000000000099',
                      thread_id: '88888888-8888-4888-8888-000000000099',
                      author_id: 'aaaa0000-0000-0000-0000-000000000001',
                      body: 'Respuesta cargada de Supabase',
                      created_at: '2026-10-28T10:15:00Z',
                      updated_at: '2026-10-28T10:15:00Z',
                    },
                  ],
                  error: null,
                }),
            }),
          };
        }
        throw new Error(`Tabla no esperada: ${table}`);
      },
      channel: (name: string) => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        name,
      }),
      removeChannel: vi.fn(),
    } as unknown as ReturnType<
      typeof import('@/lib/supabase/client').getSupabaseClient
    >;

    const { threads, meta } = await loadForumThreads(mockForumClient);
    expect(meta.persistedToBackend).toBe(true);
    expect(threads).toHaveLength(1);
    expect(threads[0].title).toBe('Debate cargado de Supabase');
    expect(threads[0].posts).toHaveLength(1);
    expect(threads[0].posts![0].body).toBe('Respuesta cargada de Supabase');

    // Suscripción Realtime
    let threadNotified = false;
    let postNotified = false;
    const unsub = subscribeToForumRealtime(
      {
        channelName: 'test_channel',
        onThreadChange: () => {
          threadNotified = true;
        },
        onPostChange: () => {
          postNotified = true;
        },
      },
      mockForumClient
    );
    expect(typeof unsub).toBe('function');
    unsub();
    expect(mockForumClient?.removeChannel).toHaveBeenCalled();
  });

  it('renderiza mediante SSR la pantalla /forum dentro de ClubProvider + AppShell respetando la unicidad estructural de layouts (1 <header> y 1 <aside>)', () => {
    const forumHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(ForumPage),
        }),
      })
    );

    expect(forumHtml).toContain('Foro del Club');
    expect(forumHtml).toContain('Buscar Compañero');
    expect(forumHtml).toContain('Reglas y Normativa');
    expect(forumHtml).toContain('Normativa sobre bolas provisionales en los hoyos 4 y 7');
    expect(forumHtml).toContain('Fijado');
    expect(forumHtml).toContain('Cerrado');
    expect(forumHtml).toContain('Tiempo Real');

    // Unicidad estructural exigida por la sección 2B de AGENTS.md y Flujo 3 de birdie-workflows
    expect((forumHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((forumHtml.match(/<aside/g) ?? []).length).toBe(1);
  });
});

describe('Comunidad y Administración — Subfase 4.4: Chat Privado con Administración (/admin-chat)', () => {
  it('aplica aislamiento estricto por jugador: un player solo ve su propia sala privada y un admin ve todas', () => {
    // Verificar que todas las salas y mensajes semilla usan UUIDs RFC-4122 válidos
    expect(INITIAL_ADMIN_CHAT_ROOMS.length).toBeGreaterThanOrEqual(3);
    for (const room of INITIAL_ADMIN_CHAT_ROOMS) {
      expect(isValidUuid(room.id)).toBe(true);
      expect(isValidUuid(room.playerId)).toBe(true);
      for (const msg of room.messages) {
        expect(isValidUuid(msg.id)).toBe(true);
        expect(isValidUuid(msg.roomId)).toBe(true);
        expect(isValidUuid(msg.senderId)).toBe(true);
      }
    }

    // Caso 1: Carlos Mendoza (player) solo ve su sala
    const carlosId = 'aaaa0000-0000-0000-0000-000000000001';
    const carlosRooms = getVisibleAdminChatRooms(INITIAL_ADMIN_CHAT_ROOMS, {
      id: carlosId,
      role: 'player',
      name: 'Carlos Mendoza',
    });
    expect(carlosRooms).toHaveLength(1);
    expect(carlosRooms[0].playerId).toBe(carlosId);
    expect(carlosRooms[0].subject).toContain('correspondencias');

    // Ninguna sala de Elena o Javier debe filtrarse a Carlos
    expect(carlosRooms.some((r) => r.playerName === 'Elena Ruiz')).toBe(false);
    expect(carlosRooms.some((r) => r.playerName === 'Javier Ortega')).toBe(false);

    // Caso 2: Jugador sin sala previa obtiene su sala inicial privada
    const newPlayerId = 'aaaa0000-0000-0000-0000-000000000999';
    const newPlayerRooms = getVisibleAdminChatRooms(INITIAL_ADMIN_CHAT_ROOMS, {
      id: newPlayerId,
      role: 'player',
      name: 'Nuevo Socio',
    });
    expect(newPlayerRooms).toHaveLength(1);
    expect(newPlayerRooms[0].playerId).toBe(newPlayerId);
    expect(newPlayerRooms[0].messages).toHaveLength(0);

    // Caso 3: Administrador del club ve todas las salas de socios
    const adminRooms = getVisibleAdminChatRooms(INITIAL_ADMIN_CHAT_ROOMS, {
      id: 'aaaa0000-0000-0000-0000-000000000003',
      role: 'club_admin',
      name: 'Laura Gómez (Comité)',
    });
    expect(adminRooms.length).toBeGreaterThanOrEqual(3);
  });

  it('prohíbe estrictamente a un jugador enviar mensajes en la sala privada de otro socio (RLS enforcement)', async () => {
    const elenaRoom = INITIAL_ADMIN_CHAT_ROOMS.find((r) => r.playerName === 'Elena Ruiz');
    expect(elenaRoom).toBeDefined();

    // Carlos Mendoza (player) intenta enviar un mensaje a la sala privada de Elena Ruiz -> Debe fallar
    const carlosId = 'aaaa0000-0000-0000-0000-000000000001';
    await expect(
      sendAdminChatMessage(INITIAL_ADMIN_CHAT_ROOMS, {
        roomId: elenaRoom!.id,
        senderId: carlosId,
        senderName: 'Carlos Mendoza',
        senderRole: 'player',
        body: 'Intento de intrusión en conversación ajena',
      })
    ).rejects.toThrow(/Acceso denegado \(RLS\)/);

    // Carlos Mendoza en su propia sala sí puede enviar mensajes
    const carlosRoom = INITIAL_ADMIN_CHAT_ROOMS.find((r) => r.playerId === carlosId);
    expect(carlosRoom).toBeDefined();

    const { updatedRooms, createdMessage } = await sendAdminChatMessage(
      INITIAL_ADMIN_CHAT_ROOMS,
      {
        roomId: carlosRoom!.id,
        senderId: carlosId,
        senderName: 'Carlos Mendoza',
        senderRole: 'player',
        body: 'Muchas gracias por la respuesta rápida.',
      }
    );
    expect(createdMessage.body).toBe('Muchas gracias por la respuesta rápida.');
    const myUpdatedRoom = updatedRooms.find((r) => r.id === carlosRoom!.id);
    expect(myUpdatedRoom?.messages.some((m) => m.id === createdMessage.id)).toBe(true);

    // Un club_admin sí puede responder en la sala de Elena
    const { createdMessage: adminMsg } = await sendAdminChatMessage(
      INITIAL_ADMIN_CHAT_ROOMS,
      {
        roomId: elenaRoom!.id,
        senderId: 'aaaa0000-0000-0000-0000-000000000003',
        senderName: 'Laura Gómez (Comité)',
        senderRole: 'club_admin',
        body: 'Confirmamos la recogida de llaves.',
      }
    );
    expect(adminMsg.senderRole).toBe('club_admin');
  });

  it('carga salas desde cliente Supabase mockeado y gestiona suscripción Realtime de mensajes', async () => {
    const mockAdminChatClient = {
      from: (table: string) => {
        if (table === 'admin_chat_rooms') {
          return {
            select: () => ({
              order: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: '77770000-0000-4000-8000-000000000099',
                        player_id: 'aaaa0000-0000-0000-0000-000000000001',
                        subject: 'Sala de Supabase',
                        status: 'open',
                        last_message_at: '2026-10-28T10:00:00Z',
                        created_at: '2026-10-28T10:00:00Z',
                      },
                    ],
                    error: null,
                  }),
                then: (resolve: (arg: unknown) => void) =>
                  resolve({
                    data: [
                      {
                        id: '77770000-0000-4000-8000-000000000099',
                        player_id: 'aaaa0000-0000-0000-0000-000000000001',
                        subject: 'Sala de Supabase',
                        status: 'open',
                        last_message_at: '2026-10-28T10:00:00Z',
                        created_at: '2026-10-28T10:00:00Z',
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'admin_chat_messages') {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: '77771111-0000-4000-8000-000000000099',
                      room_id: '77770000-0000-4000-8000-000000000099',
                      sender_id: 'aaaa0000-0000-0000-0000-000000000001',
                      body: 'Mensaje desde base de datos',
                      is_read: false,
                      created_at: '2026-10-28T10:05:00Z',
                    },
                  ],
                  error: null,
                }),
            }),
          };
        }
        throw new Error(`Tabla inesperada: ${table}`);
      },
      channel: (name: string) => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        name,
      }),
      removeChannel: vi.fn(),
    } as unknown as ReturnType<
      typeof import('@/lib/supabase/client').getSupabaseClient
    >;

    const { rooms, meta } = await loadAdminChatRooms(
      {
        id: 'aaaa0000-0000-0000-0000-000000000001',
        role: 'player',
        name: 'Carlos Mendoza',
      },
      mockAdminChatClient
    );

    expect(meta.persistedToBackend).toBe(true);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].messages).toHaveLength(1);
    expect(rooms[0].messages[0].body).toBe('Mensaje desde base de datos');

    // Suscripción Realtime
    const unsub = subscribeToAdminChatRealtime(
      {
        channelName: 'test_admin_chat_channel',
        onMessageReceived: vi.fn(),
      },
      mockAdminChatClient
    );
    expect(typeof unsub).toBe('function');
    unsub();
    expect(mockAdminChatClient?.removeChannel).toHaveBeenCalled();
  });

  it('renderiza mediante SSR la pantalla /admin-chat dentro de ClubProvider + AppShell respetando la unicidad estructural de layouts (1 <header> y 1 <aside>)', () => {
    const chatHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(AdminChatPage),
        }),
      })
    );

    expect(chatHtml).toContain('Chat con Administración');
    expect(chatHtml).toContain('Canal Privado 1-a-1');
    expect(chatHtml).toContain('Tiempo Real');
    expect(chatHtml).toContain('Enviar');

    // Unicidad estructural exigida por la sección 2B de AGENTS.md y Flujo 3 de birdie-workflows
    expect((chatHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((chatHtml.match(/<aside/g) ?? []).length).toBe(1);
  });
});

describe('Comunidad y Administración — Subfase 4.5: Panel de Administración del Club (/admin)', () => {
  it('aplica guardias estrictos: canAccessAdminPanel y assertAdminRole deniegan acceso a player y autorizan a admin', () => {
    // 1. canAccessAdminPanel
    expect(canAccessAdminPanel('player')).toBe(false);
    expect(canAccessAdminPanel('club_admin')).toBe(true);
    expect(canAccessAdminPanel('superadmin')).toBe(true);

    // 2. assertAdminRole
    expect(() => assertAdminRole('player')).toThrow(/Acceso denegado \(403\)/);
    expect(() => assertAdminRole('club_admin')).not.toThrow();
    expect(() => assertAdminRole('superadmin')).not.toThrow();
  });

  it('calcula y agrega los KPIs de administración correctamente (computeAdminDashboardStats y loadAdminDashboardStats)', async () => {
    // 1. Cálculo en memoria sobre catálogos semilla
    const localStats = computeAdminDashboardStats();
    expect(localStats.totalMembers).toBe(INITIAL_DIRECTORY_PLAYERS.length);
    expect(localStats.publishedNewsCount).toBeGreaterThanOrEqual(1);
    expect(localStats.openForumThreadsCount).toBeGreaterThanOrEqual(1);
    expect(localStats.openAdminChatRoomsCount).toBeGreaterThanOrEqual(1);

    // 2. Carga en modo demo
    const demoLoad = await loadAdminDashboardStats('club_admin');
    expect(demoLoad.meta.persistedToBackend).toBe(false);
    expect(demoLoad.stats.totalMembers).toBe(INITIAL_DIRECTORY_PLAYERS.length);

    // 3. Intento de carga con rol 'player' -> Debe lanzar error 403
    await expect(loadAdminDashboardStats('player')).rejects.toThrow(/Acceso denegado \(403\)/);

    // 4. Carga con cliente Supabase simulado
    const mockSupabaseAdminClient = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ count: 12, data: null, error: null }),
          head: true,
          then: (resolve: (arg: unknown) => void) =>
            resolve({ count: 45, data: null, error: null }),
        }),
      }),
    } as unknown as ReturnType<
      typeof import('@/lib/supabase/client').getSupabaseClient
    >;

    const remoteLoad = await loadAdminDashboardStats('superadmin', mockSupabaseAdminClient);
    expect(remoteLoad.meta.persistedToBackend).toBe(true);
    expect(remoteLoad.stats.totalMembers).toBe(45);
  });

  it('renderiza mediante SSR la pantalla /admin con bloqueo 403 para rol player y consola completa para club_admin', () => {
    // Caso 1: Usuario estándar (player) recibe vista de acceso denegado (403)
    const playerHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(AdminDashboardPage),
        }),
      })
    );

    expect(playerHtml).toContain('Acceso Exclusivo para Administración');
    expect(playerHtml).toContain('Error 403 · Permiso Denegado');
    expect(playerHtml).toContain('Volver al Inicio');
    expect(playerHtml).not.toContain('Consola de Administración del Club');

    // Unicidad estructural de layouts (1 <header> y 1 <aside>)
    expect((playerHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((playerHtml.match(/<aside/g) ?? []).length).toBe(1);

    // Caso 2: Administrador (club_admin) accede a la consola y sus accesos directos
    const adminHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        initialProfile: DEMO_PROFILES_BY_ROLE.club_admin,
        children: React.createElement(AppShell, {
          children: React.createElement(AdminDashboardPage),
        }),
      })
    );

    expect(adminHtml).toContain('Panel de Administración del Club');
    expect(adminHtml).toContain('Directorio de Socios');
    expect(adminHtml).toContain('Noticias y Avisos');
    expect(adminHtml).toContain('Foros y Comunidad');
    expect(adminHtml).toContain('Atención al Socio');
    expect(adminHtml).toContain('Operaciones y Accesos de Gestión');
    expect(adminHtml).not.toContain('Error 403');

    // Unicidad estructural de layouts (1 <header> y 1 <aside>)
    expect((adminHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((adminHtml.match(/<aside/g) ?? []).length).toBe(1);
  });
});
