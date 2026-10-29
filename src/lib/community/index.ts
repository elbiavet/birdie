import {
  isValidUuid,
  resolvePersistenceMetadata,
  type ActionPersistenceMetadata,
} from '@/lib/competition';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { PlayerProfile, UserRole } from '@/types/database';

// ============================================================================
// SUBFASE 4.1: DIRECTORIO DE JUGADORES DEL CLUB (/players)
// ============================================================================

export type HandicapBracket = 'all' | 'low' | 'mid' | 'high';

export interface DirectoryFilterOptions {
  searchQuery?: string;
  bracket?: HandicapBracket;
  minHandicap?: number;
  maxHandicap?: number;
}

/**
 * Catálogo semilla de socios del club con UUIDs RFC-4122 válidos.
 * Incluye perfiles con `isDirectoryVisible = false` para verificar que el filtro de privacidad
 * los excluye estrictamente del directorio público de socios.
 */
export const INITIAL_DIRECTORY_PLAYERS: PlayerProfile[] = [
  {
    id: 'aaaa0000-0000-0000-0000-000000000203',
    email: 'javier.ortega@socio.es',
    fullName: 'Javier Ortega',
    federationLicense: 'AM-104512',
    handicapIndex: 3.2,
    role: 'player',
    phone: '+34 611 220 330',
    bio: 'Jugador scratch campeonato del club. Disponible sábados primera hora.',
    isDirectoryVisible: true,
    updatedAt: '2026-10-25T09:00:00Z',
  },
  {
    id: 'aaaa0000-0000-0000-0000-000000000003',
    email: 'comite@rcgvalleverde.es',
    fullName: 'Laura Gómez (Comité de Competición)',
    federationLicense: 'AM-102938',
    handicapIndex: 5.2,
    role: 'club_admin',
    phone: '+34 910 000 100',
    bio: 'Dirección deportiva y organización de torneos oficiales.',
    isDirectoryVisible: true,
    updatedAt: '2026-10-26T10:00:00Z',
  },
  {
    id: 'aaaa0000-0000-0000-0000-000000000201',
    email: 'elena.ruiz@socio.es',
    fullName: 'Elena Ruiz',
    federationLicense: 'AM-219044',
    handicapIndex: 6.8,
    role: 'player',
    phone: '+34 622 340 550',
    bio: 'Socia federada. Modalidad Fourball y vueltas de entrenamiento.',
    isDirectoryVisible: true,
    updatedAt: '2026-10-24T17:30:00Z',
  },
  {
    id: 'aaaa0000-0000-0000-0000-000000000001',
    email: 'carlos.mendoza@socio.es',
    fullName: 'Carlos Mendoza',
    federationLicense: 'AM-284910',
    handicapIndex: 11.4,
    role: 'player',
    phone: '+34 600 123 456',
    bio: 'Socio jugador habitual los fines de semana. Salidas de mañana.',
    isDirectoryVisible: true,
    updatedAt: '2026-10-27T10:00:00Z',
  },
  {
    id: 'aaaa0000-0000-0000-0000-000000000205',
    email: 'lucia.fernandez@socio.es',
    fullName: 'Lucía Fernández',
    federationLicense: 'AM-339102',
    handicapIndex: 14.2,
    role: 'player',
    phone: '+34 644 889 100',
    bio: 'Partidas sociales los domingos y torneos mixtos Greensome.',
    isDirectoryVisible: true,
    updatedAt: '2026-10-23T12:15:00Z',
  },
  {
    id: 'aaaa0000-0000-0000-0000-000000000206',
    email: 'marta.gomez@socio.es',
    fullName: 'Marta Gómez',
    federationLicense: 'AM-410288',
    handicapIndex: 18.6,
    role: 'player',
    phone: '+34 655 771 200',
    bio: 'Enfocada en bajar hándicap esta temporada. Juego corto y approach.',
    isDirectoryVisible: true,
    updatedAt: '2026-10-22T15:40:00Z',
  },
  {
    id: 'aaaa0000-0000-0000-0000-000000000207',
    email: 'pedro.navarro@socio.es',
    fullName: 'Pedro Navarro',
    federationLicense: 'AM-512090',
    handicapIndex: 24.5,
    role: 'player',
    phone: '+34 666 901 300',
    bio: 'Nuevo socio del club. Busco compañeros para salidas de 9 o 18 hoyos entre semana.',
    isDirectoryVisible: true,
    updatedAt: '2026-10-21T11:00:00Z',
  },
  {
    id: 'aaaa0000-0000-0000-0000-000000000004',
    email: 'ops@birdie.app',
    fullName: 'Javier Ruiz (Birdie Superadmin — Perfil Oculto)',
    federationLicense: 'PRO-001122',
    handicapIndex: 1.8,
    role: 'superadmin',
    phone: '+34 699 000 999',
    bio: 'Administración global multi-club Birdie.',
    isDirectoryVisible: false,
    updatedAt: '2026-10-27T10:00:00Z',
  },
  {
    id: 'aaaa0000-0000-0000-0000-000000000209',
    email: 'socio.privado@socio.es',
    fullName: 'Socio con Privacidad Activada',
    federationLicense: 'AM-999999',
    handicapIndex: 9.0,
    role: 'player',
    phone: null,
    bio: 'Este perfil tiene isDirectoryVisible = false y nunca debe mostrarse en /players.',
    isDirectoryVisible: false,
    updatedAt: '2026-10-20T08:00:00Z',
  },
];

/**
 * Filtra la lista de perfiles del directorio:
 * 1. Excluye estrictamente cualquier perfil con `isDirectoryVisible !== true`.
 * 2. Aplica búsqueda por nombre completo, licencia federativa o biografía.
 * 3. Aplica filtro por tramo de hándicap (`bracket`: 'all' | 'low' | 'mid' | 'high') y límites numéricos opcionales.
 * 4. Ordena ascendentemente por `handicapIndex` y alfabéticamente en caso de empate.
 */
export function filterDirectoryPlayers(
  profiles: PlayerProfile[],
  filters: DirectoryFilterOptions = {}
): PlayerProfile[] {
  const q = (filters.searchQuery ?? '').trim().toLowerCase();
  const bracket = filters.bracket ?? 'all';

  return profiles
    .filter((profile) => {
      if (!profile.isDirectoryVisible) {
        return false;
      }

      if (q) {
        const matchesName = profile.fullName.toLowerCase().includes(q);
        const matchesLicense = (profile.federationLicense ?? '')
          .toLowerCase()
          .includes(q);
        const matchesBio = (profile.bio ?? '').toLowerCase().includes(q);
        if (!matchesName && !matchesLicense && !matchesBio) {
          return false;
        }
      }

      if (bracket === 'low' && profile.handicapIndex > 10.0) {
        return false;
      }
      if (
        bracket === 'mid' &&
        (profile.handicapIndex <= 10.0 || profile.handicapIndex > 20.0)
      ) {
        return false;
      }
      if (bracket === 'high' && profile.handicapIndex <= 20.0) {
        return false;
      }

      if (
        typeof filters.minHandicap === 'number' &&
        Number.isFinite(filters.minHandicap) &&
        profile.handicapIndex < filters.minHandicap
      ) {
        return false;
      }
      if (
        typeof filters.maxHandicap === 'number' &&
        Number.isFinite(filters.maxHandicap) &&
        profile.handicapIndex > filters.maxHandicap
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (a.handicapIndex !== b.handicapIndex) {
        return a.handicapIndex - b.handicapIndex;
      }
      return a.fullName.localeCompare(b.fullName, 'es');
    });
}

/**
 * Carga los perfiles públicos del directorio de socios desde `public.profiles` en Supabase
 * (restringido a `is_directory_visible = true`), o devuelve el catálogo semilla filtrado en modo demo.
 */
export async function loadDirectoryPlayers(
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  players: PlayerProfile[];
  meta: ActionPersistenceMetadata;
}> {
  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      players: filterDirectoryPlayers(INITIAL_DIRECTORY_PLAYERS),
      meta: resolvePersistenceMetadata(false),
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, avatar_url, federation_license, handicap_index, role, phone, bio, is_directory_visible, updated_at'
    )
    .eq('is_directory_visible', true)
    .order('handicap_index', { ascending: true });

  if (error) {
    throw new Error(
      `Error al cargar el directorio de jugadores desde Supabase: ${error.message}`
    );
  }

  const mapped: PlayerProfile[] = (data ?? [])
    .map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      email: String(row.email ?? ''),
      fullName: String(row.full_name ?? 'Socio del Club'),
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
      federationLicense: String(row.federation_license ?? 'SIN-LICENCIA'),
      handicapIndex: Number(row.handicap_index ?? 36.0),
      role: ((row.role as UserRole) ?? 'player'),
      phone: row.phone ? String(row.phone) : null,
      bio: row.bio ? String(row.bio) : null,
      isDirectoryVisible: Boolean(row.is_directory_visible),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    }))
    .filter((p) => p.isDirectoryVisible && isValidUuid(p.id));

  return {
    players: filterDirectoryPlayers(mapped),
    meta: resolvePersistenceMetadata(true),
  };
}

// ============================================================================
// SUBFASE 4.2: NOTICIAS DEL CLUB (/news) E INFORMACIÓN DE INTERÉS (/info)
// ============================================================================

export interface NewsArticleItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImageUrl?: string | null;
  isPinned: boolean;
  isPublished: boolean;
  authorId?: string | null;
  publishedAt: string;
}

export interface CreateNewsArticleInput {
  title: string;
  summary: string;
  content: string;
  isPinned?: boolean;
  isPublished?: boolean;
  authorId: string;
  actorRole: UserRole;
}

export type ClubInfoCategory =
  | 'normativa'
  | 'servicios'
  | 'correspondencias'
  | 'general';

export interface ClubInfoPageItem {
  id: string;
  slug: string;
  title: string;
  category: ClubInfoCategory;
  contentMarkdown: string;
  displayOrder: number;
  updatedBy?: string | null;
  updatedAt: string;
}

export interface UpdateClubInfoPageInput {
  slug: string;
  title: string;
  category: ClubInfoCategory;
  contentMarkdown: string;
  displayOrder?: number;
  actorUserId: string;
  actorRole: UserRole;
}

export const INITIAL_NEWS_ARTICLES: NewsArticleItem[] = [
  {
    id: '66666666-6666-4666-8666-000000000001',
    title: 'Pinchado hueco de greens y preparación del Torneo de Otoño',
    slug: 'pinchado-greens-torneo-otono',
    summary:
      'Trabajos de mantenimiento programados por el equipo de Greenkeeping para dejar los greens a 10.5 pies en el Stimpmeter.',
    content:
      'El equipo de mantenimiento realizará labores de aireación ligera durante el lunes y martes próximos. El recorrido estará al 100% para el Torneo Social del sábado.',
    isPinned: true,
    isPublished: true,
    authorId: 'aaaa0000-0000-0000-0000-000000000003',
    publishedAt: '2026-10-26T09:30:00Z',
  },
  {
    id: '66666666-6666-4666-8666-000000000002',
    title: 'Abierta la inscripción al Campeonato Social Match Play',
    slug: 'inscripcion-campeonato-social-match-play',
    summary:
      'Inscripciones abiertas desde la app en modalidad Hándicap Individual.',
    content:
      'Ya puedes apuntarte desde la sección de Torneos de la aplicación antes del jueves a las 18:00. Cuadro eliminatorio de 32 jugadores.',
    isPinned: false,
    isPublished: true,
    authorId: 'aaaa0000-0000-0000-0000-000000000003',
    publishedAt: '2026-10-24T14:00:00Z',
  },
  {
    id: '66666666-6666-4666-8666-000000000003',
    title: 'Borrador interno del Comité: Calendario Invierno 2027',
    slug: 'borrador-calendario-invierno-2027',
    summary: 'Documento interno aún no publicado para socios.',
    content: 'Borrador de fechas de torneos invernales.',
    isPinned: false,
    isPublished: false,
    authorId: 'aaaa0000-0000-0000-0000-000000000003',
    publishedAt: '2026-10-20T10:00:00Z',
  },
];

export const INITIAL_CLUB_INFO_PAGES: ClubInfoPageItem[] = [
  {
    id: '77777777-7777-4777-8777-000000000101',
    slug: 'reglas-locales',
    title: 'Reglas Locales y Etiqueta',
    category: 'normativa',
    contentMarkdown:
      '1. **Reparación de piques y chuletas**: Obligatorio en todo el recorrido.\n2. **Ritmo de juego**: Tiempo máximo para 18 hoyos de 4 horas y 15 minutos.\n3. **Caminos y senderos**: Alivio sin penalidad según Regla 16.1.',
    displayOrder: 1,
    updatedAt: '2026-10-25T10:00:00Z',
  },
  {
    id: '77777777-7777-4777-8777-000000000102',
    slug: 'horarios-y-tarifas',
    title: 'Horarios de Casa Club y Green Fees',
    category: 'servicios',
    contentMarkdown:
      '- **Casa Club**: 07:30 a 21:30 (Martes a Domingo).\n- **Campo de Prácticas**: 08:00 a 20:00.\n- **Green Fee Laborables Socios**: Incluido en cuota.\n- **Alquiler de Buggy**: 28 € (18 hoyos).',
    displayOrder: 2,
    updatedAt: '2026-10-25T10:05:00Z',
  },
  {
    id: '77777777-7777-4777-8777-000000000103',
    slug: 'correspondencias',
    title: 'Clubes con Correspondencia',
    category: 'correspondencias',
    contentMarkdown:
      'Los socios activos disfrutan de hasta 10 salidas anuales con tarifa reducida en nuestros 18 clubes asociados nacionales.',
    displayOrder: 3,
    updatedAt: '2026-10-25T10:10:00Z',
  },
];

export function isClubAdminOrSuperadminRole(role: UserRole): boolean {
  return role === 'club_admin' || role === 'superadmin';
}

export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Filtra artículos de noticias:
 * - Si el usuario es `player` (y `includeUnpublished` no está activo para un admin), devuelve únicamente `isPublished = true`.
 * - Ordena primero fijados (`isPinned = true`) y después por fecha de publicación descendente.
 */
export function filterNewsArticles(
  articles: NewsArticleItem[],
  options: {
    searchQuery?: string;
    onlyPinned?: boolean;
    viewerRole?: UserRole;
    includeUnpublished?: boolean;
  } = {}
): NewsArticleItem[] {
  const q = (options.searchQuery ?? '').trim().toLowerCase();
  const canSeeDrafts =
    Boolean(options.includeUnpublished) &&
    isClubAdminOrSuperadminRole(options.viewerRole ?? 'player');

  return articles
    .filter((a) => {
      if (!canSeeDrafts && !a.isPublished) {
        return false;
      }
      if (options.onlyPinned && !a.isPinned) {
        return false;
      }
      if (q) {
        const inTitle = a.title.toLowerCase().includes(q);
        const inSummary = a.summary.toLowerCase().includes(q);
        const inContent = a.content.toLowerCase().includes(q);
        if (!inTitle && !inSummary && !inContent) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return b.publishedAt.localeCompare(a.publishedAt);
    });
}

/**
 * Publica una noticia validando rol administrativo (`club_admin` o `superadmin`).
 * Persiste en `public.news_articles` si Supabase está configurado o en memoria en modo demo.
 */
export async function publishNewsArticle(
  articles: NewsArticleItem[],
  input: CreateNewsArticleInput,
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  updatedArticles: NewsArticleItem[];
  createdArticle: NewsArticleItem;
  meta: ActionPersistenceMetadata;
}> {
  if (!isClubAdminOrSuperadminRole(input.actorRole)) {
    throw new Error(
      'Permiso denegado (RLS): solo club_admin o superadmin pueden publicar o editar noticias del club.'
    );
  }

  const cleanTitle = input.title.trim();
  const cleanSummary = input.summary.trim();
  const cleanContent = input.content.trim();
  if (!cleanTitle || !cleanSummary || !cleanContent) {
    throw new Error(
      'Título, resumen y contenido son obligatorios para publicar una noticia.'
    );
  }

  const baseSlug = slugifyTitle(cleanTitle) || `noticia-${Date.now()}`;
  const slugExists = articles.some((a) => a.slug === baseSlug);
  const slug = slugExists ? `${baseSlug}-${Date.now()}` : baseSlug;
  const nowIso = new Date().toISOString();

  const localCreated: NewsArticleItem = {
    id: `66666666-6666-4666-8666-${String(Date.now()).slice(-12).padStart(12, '0')}`,
    title: cleanTitle,
    slug,
    summary: cleanSummary,
    content: cleanContent,
    isPinned: Boolean(input.isPinned),
    isPublished: input.isPublished ?? true,
    authorId: input.authorId,
    publishedAt: nowIso,
  };

  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    const updatedArticles = filterNewsArticles(
      [localCreated, ...articles],
      { viewerRole: input.actorRole, includeUnpublished: true }
    );
    return {
      updatedArticles,
      createdArticle: localCreated,
      meta: resolvePersistenceMetadata(false),
    };
  }

  if (!isValidUuid(input.authorId)) {
    throw new Error(
      'Identificador inválido para Supabase: author_id debe ser un UUID válido.'
    );
  }

  const { data, error } = await supabase
    .from('news_articles')
    .insert({
      title: localCreated.title,
      slug: localCreated.slug,
      summary: localCreated.summary,
      content: localCreated.content,
      is_pinned: localCreated.isPinned,
      is_published: localCreated.isPublished,
      author_id: input.authorId,
    })
    .select('id, published_at')
    .single();

  if (error) {
    throw new Error(
      `Error del servidor al publicar noticia en Supabase: ${error.message}`
    );
  }

  const persisted: NewsArticleItem = {
    ...localCreated,
    id: data?.id ? String(data.id) : localCreated.id,
    publishedAt: data?.published_at
      ? String(data.published_at)
      : localCreated.publishedAt,
  };

  return {
    updatedArticles: filterNewsArticles([persisted, ...articles], {
      viewerRole: input.actorRole,
      includeUnpublished: true,
    }),
    createdArticle: persisted,
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Carga las noticias del club desde `public.news_articles` en Supabase o el catálogo semilla en modo demo.
 */
export async function loadNewsArticles(
  viewerRole: UserRole = 'player',
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  articles: NewsArticleItem[];
  meta: ActionPersistenceMetadata;
}> {
  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      articles: filterNewsArticles(INITIAL_NEWS_ARTICLES, {
        viewerRole,
        includeUnpublished: isClubAdminOrSuperadminRole(viewerRole),
      }),
      meta: resolvePersistenceMetadata(false),
    };
  }

  const { data, error } = await supabase
    .from('news_articles')
    .select(
      'id, title, slug, summary, content, cover_image_url, is_pinned, is_published, author_id, published_at'
    )
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });

  if (error) {
    throw new Error(
      `Error al cargar noticias desde Supabase: ${error.message}`
    );
  }

  const mapped: NewsArticleItem[] = (data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      title: String(row.title ?? ''),
      slug: String(row.slug ?? ''),
      summary: String(row.summary ?? ''),
      content: String(row.content ?? ''),
      coverImageUrl: row.cover_image_url ? String(row.cover_image_url) : null,
      isPinned: Boolean(row.is_pinned),
      isPublished: Boolean(row.is_published),
      authorId: row.author_id ? String(row.author_id) : null,
      publishedAt: String(row.published_at ?? new Date().toISOString()),
    })
  );

  return {
    articles: filterNewsArticles(mapped, {
      viewerRole,
      includeUnpublished: isClubAdminOrSuperadminRole(viewerRole),
    }),
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Filtra y ordena páginas de información de interés del club (`/info`) por categoría y `displayOrder`.
 */
export function filterClubInfoPages(
  pages: ClubInfoPageItem[],
  category: ClubInfoCategory | 'all' = 'all'
): ClubInfoPageItem[] {
  return pages
    .filter((p) => category === 'all' || p.category === category)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Carga las páginas de información de interés desde `public.club_info_pages` en Supabase o el catálogo semilla.
 */
export async function loadClubInfoPages(
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  pages: ClubInfoPageItem[];
  meta: ActionPersistenceMetadata;
}> {
  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      pages: filterClubInfoPages(INITIAL_CLUB_INFO_PAGES),
      meta: resolvePersistenceMetadata(false),
    };
  }

  const { data, error } = await supabase
    .from('club_info_pages')
    .select(
      'id, slug, title, category, content_markdown, display_order, updated_by, updated_at'
    )
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(
      `Error al cargar páginas de información desde Supabase: ${error.message}`
    );
  }

  const mapped: ClubInfoPageItem[] = (data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      slug: String(row.slug ?? ''),
      title: String(row.title ?? ''),
      category: ((row.category as ClubInfoCategory) ?? 'general'),
      contentMarkdown: String(row.content_markdown ?? ''),
      displayOrder: Number(row.display_order ?? 1),
      updatedBy: row.updated_by ? String(row.updated_by) : null,
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    })
  );

  return {
    pages: filterClubInfoPages(mapped),
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Actualiza o crea una página de Información de Interés del Club (`/info`).
 * Restringido estrictamente a `club_admin` y `superadmin`.
 */
export async function updateClubInfoPage(
  pages: ClubInfoPageItem[],
  input: UpdateClubInfoPageInput,
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  updatedPages: ClubInfoPageItem[];
  savedPage: ClubInfoPageItem;
  meta: ActionPersistenceMetadata;
}> {
  if (!isClubAdminOrSuperadminRole(input.actorRole)) {
    throw new Error(
      'Permiso denegado (RLS): solo club_admin o superadmin pueden modificar la información oficial del club.'
    );
  }

  const cleanSlug = slugifyTitle(input.slug || input.title);
  const cleanTitle = input.title.trim();
  const cleanMarkdown = input.contentMarkdown.trim();

  if (!cleanSlug || !cleanTitle || !cleanMarkdown) {
    throw new Error(
      'Slug, título y contenido son obligatorios para guardar una sección de información.'
    );
  }

  const existing = pages.find((p) => p.slug === cleanSlug);
  const nowIso = new Date().toISOString();

  const localSaved: ClubInfoPageItem = {
    id:
      existing?.id ??
      `77777777-7777-4777-8777-${String(Date.now()).slice(-12).padStart(12, '0')}`,
    slug: cleanSlug,
    title: cleanTitle,
    category: input.category,
    contentMarkdown: cleanMarkdown,
    displayOrder: input.displayOrder ?? existing?.displayOrder ?? pages.length + 1,
    updatedBy: input.actorUserId,
    updatedAt: nowIso,
  };

  const nextLocalList = existing
    ? pages.map((p) => (p.slug === cleanSlug ? localSaved : p))
    : [...pages, localSaved];

  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      updatedPages: filterClubInfoPages(nextLocalList),
      savedPage: localSaved,
      meta: resolvePersistenceMetadata(false),
    };
  }

  if (!isValidUuid(input.actorUserId)) {
    throw new Error(
      'Identificador inválido para Supabase: updated_by debe ser un UUID válido.'
    );
  }

  const { data, error } = await supabase
    .from('club_info_pages')
    .upsert(
      {
        slug: localSaved.slug,
        title: localSaved.title,
        category: localSaved.category,
        content_markdown: localSaved.contentMarkdown,
        display_order: localSaved.displayOrder,
        updated_by: input.actorUserId,
        updated_at: nowIso,
      },
      { onConflict: 'slug' }
    )
    .select('id, updated_at')
    .single();

  if (error) {
    throw new Error(
      `Error del servidor al actualizar información del club: ${error.message}`
    );
  }

  const persisted: ClubInfoPageItem = {
    ...localSaved,
    id: data?.id ? String(data.id) : localSaved.id,
    updatedAt: data?.updated_at ? String(data.updated_at) : localSaved.updatedAt,
  };

  const finalList = existing
    ? pages.map((p) => (p.slug === cleanSlug ? persisted : p))
    : [...pages, persisted];

  return {
    updatedPages: filterClubInfoPages(finalList),
    savedPage: persisted,
    meta: resolvePersistenceMetadata(true),
  };
}

// ============================================================================
// SUBFASE 4.3: FORO DE LA COMUNIDAD EN TIEMPO REAL (/forum)
// ============================================================================

export type ForumCategory =
  | 'general'
  | 'find_partner'
  | 'rules'
  | 'equipment'
  | 'competitions';

export interface ForumPostItem {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorRole?: UserRole;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForumThreadItem {
  id: string;
  authorId: string;
  authorName: string;
  category: ForumCategory;
  title: string;
  body: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  postsCount: number;
  posts?: ForumPostItem[];
}

export interface CreateForumThreadInput {
  authorId: string;
  authorName: string;
  actorRole: UserRole;
  category: ForumCategory;
  title: string;
  body: string;
  isPinned?: boolean;
}

export interface ReplyToForumThreadInput {
  threadId: string;
  authorId: string;
  authorName: string;
  actorRole: UserRole;
  body: string;
}

export interface ToggleForumThreadLockInput {
  threadId: string;
  actorRole: UserRole;
  isLocked: boolean;
}

/**
 * Catálogo semilla de hilos del foro con UUIDs RFC-4122 válidos.
 * Incluye debates fijados y un debate cerrado (isLocked = true) para verificar
 * la política de moderación y bloqueo de respuestas para socios estándar.
 */
export const INITIAL_FORUM_THREADS: ForumThreadItem[] = [
  {
    id: '88888888-8888-4888-8888-000000000001',
    authorId: 'aaaa0000-0000-0000-0000-000000000003', // Laura Gómez (Comité)
    authorName: 'Laura Gómez (Comité de Competición)',
    category: 'rules',
    title: 'Normativa sobre bolas provisionales en los hoyos 4 y 7 con fuera de límites',
    body: 'Recordamos a todos los socios las Reglas Locales 2026 sobre la aplicación de bola provisional en el fuera de límites de la derecha del hoyo 4.',
    isPinned: true,
    isLocked: false,
    createdAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-25T15:30:00Z',
    postsCount: 2,
    posts: [
      {
        id: '99999999-9999-4999-8999-000000000001',
        threadId: '88888888-8888-4888-8888-000000000001',
        authorId: 'aaaa0000-0000-0000-0000-000000000001',
        authorName: 'Carlos Mendoza',
        authorRole: 'player',
        body: 'Muchas gracias por la aclaración. En el torneo del sábado pasado generó dudas en la partida.',
        createdAt: '2026-10-24T12:30:00Z',
        updatedAt: '2026-10-24T12:30:00Z',
      },
      {
        id: '99999999-9999-4999-8999-000000000002',
        threadId: '88888888-8888-4888-8888-000000000001',
        authorId: 'aaaa0000-0000-0000-0000-000000000003',
        authorName: 'Laura Gómez (Comité de Competición)',
        authorRole: 'club_admin',
        body: 'Exacto, en la tarjeta de score oficial estará impreso el texto completo de la Regla Local.',
        createdAt: '2026-10-25T15:30:00Z',
        updatedAt: '2026-10-25T15:30:00Z',
      },
    ],
  },
  {
    id: '88888888-8888-4888-8888-000000000002',
    authorId: 'aaaa0000-0000-0000-0000-000000000201', // Elena Ruiz
    authorName: 'Elena Ruiz',
    category: 'find_partner',
    title: 'Busco compañero para vuelta de 18 hoyos este sábado a las 08:40',
    body: 'Tengo plaza reservada en la partida de las 08:40. Mi hándicap es 6.8 y busco partida de ritmo ágil (menos de 4h 15min).',
    isPinned: false,
    isLocked: false,
    createdAt: '2026-10-26T08:00:00Z',
    updatedAt: '2026-10-26T11:20:00Z',
    postsCount: 1,
    posts: [
      {
        id: '99999999-9999-4999-8999-000000000003',
        threadId: '88888888-8888-4888-8888-000000000002',
        authorId: 'aaaa0000-0000-0000-0000-000000000203',
        authorName: 'Javier Ortega',
        authorRole: 'player',
        body: '¡Me apunto Elena! Me acabo de sumar al tee time desde la sección de Reservas.',
        createdAt: '2026-10-26T11:20:00Z',
        updatedAt: '2026-10-26T11:20:00Z',
      },
    ],
  },
  {
    id: '88888888-8888-4888-8888-000000000003',
    authorId: 'aaaa0000-0000-0000-0000-000000000003', // Laura Gómez (Comité)
    authorName: 'Laura Gómez (Comité de Competición)',
    category: 'competitions',
    title: '[CERRADO] Inscripciones para el Torneo Apertura Primavera',
    body: 'El cuadro de inscripciones está completo. Este debate ha sido cerrado por administración y no admite nuevas respuestas.',
    isPinned: false,
    isLocked: true,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-22T18:00:00Z',
    postsCount: 1,
    posts: [
      {
        id: '99999999-9999-4999-8999-000000000004',
        threadId: '88888888-8888-4888-8888-000000000003',
        authorId: 'aaaa0000-0000-0000-0000-000000000003',
        authorName: 'Laura Gómez (Comité de Competición)',
        authorRole: 'club_admin',
        body: 'Inscripciones cerradas. Los horarios de salida definitivos están publicados en la sección Torneos.',
        createdAt: '2026-10-22T18:00:00Z',
        updatedAt: '2026-10-22T18:00:00Z',
      },
    ],
  },
  {
    id: '88888888-8888-4888-8888-000000000004',
    authorId: 'aaaa0000-0000-0000-0000-000000000001', // Carlos Mendoza
    authorName: 'Carlos Mendoza',
    category: 'equipment',
    title: 'Opiniones sobre fitting de varillas stiff vs regular en maderas de calle',
    body: 'He probado varillas de 65g en madera 3 con velocidad de swing de 95mph. ¿Alguien tiene experiencia en el campo con viento en contra en el hoyo 14?',
    isPinned: false,
    isLocked: false,
    createdAt: '2026-10-25T14:00:00Z',
    updatedAt: '2026-10-25T14:00:00Z',
    postsCount: 0,
    posts: [],
  },
];

/**
 * Filtra hilos del foro por categoría y texto libre (título, cuerpo o nombre de autor).
 * Ordena fijados primero (`isPinned = true`) y luego por `updatedAt` descendente.
 */
export function filterForumThreads(
  threads: ForumThreadItem[],
  options: {
    category?: ForumCategory | 'all';
    searchQuery?: string;
  } = {}
): ForumThreadItem[] {
  const cat = options.category ?? 'all';
  const q = (options.searchQuery ?? '').trim().toLowerCase();

  return threads
    .filter((t) => {
      if (cat !== 'all' && t.category !== cat) {
        return false;
      }
      if (q) {
        const inTitle = t.title.toLowerCase().includes(q);
        const inBody = t.body.toLowerCase().includes(q);
        const inAuthor = t.authorName.toLowerCase().includes(q);
        if (!inTitle && !inBody && !inAuthor) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

/**
 * Crea un nuevo hilo en el foro.
 * Valida campos obligatorios y restringe la capacidad de fijar (`isPinned`) a administradores.
 */
export async function createForumThread(
  threads: ForumThreadItem[],
  input: CreateForumThreadInput,
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  updatedThreads: ForumThreadItem[];
  createdThread: ForumThreadItem;
  meta: ActionPersistenceMetadata;
}> {
  const cleanTitle = input.title.trim();
  const cleanBody = input.body.trim();
  if (!cleanTitle || !cleanBody) {
    throw new Error('El título y el contenido son obligatorios para abrir un debate en el foro.');
  }

  const isAdmin = isClubAdminOrSuperadminRole(input.actorRole);
  const isPinned = isAdmin ? Boolean(input.isPinned) : false;
  const nowIso = new Date().toISOString();

  const localThread: ForumThreadItem = {
    id: `88888888-8888-4888-8888-${String(Date.now()).slice(-12).padStart(12, '0')}`,
    authorId: input.authorId,
    authorName: input.authorName,
    category: input.category,
    title: cleanTitle,
    body: cleanBody,
    isPinned,
    isLocked: false,
    createdAt: nowIso,
    updatedAt: nowIso,
    postsCount: 0,
    posts: [],
  };

  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    const updatedThreads = filterForumThreads([localThread, ...threads]);
    return {
      updatedThreads,
      createdThread: localThread,
      meta: resolvePersistenceMetadata(false),
    };
  }

  if (!isValidUuid(input.authorId)) {
    throw new Error(
      'Identificador inválido para Supabase: author_id debe ser un UUID válido.'
    );
  }

  const { data, error } = await supabase
    .from('forum_threads')
    .insert({
      author_id: input.authorId,
      category: input.category,
      title: localThread.title,
      body: localThread.body,
      is_pinned: isPinned,
      is_locked: false,
    })
    .select('id, created_at, updated_at')
    .single();

  if (error) {
    throw new Error(`Error del servidor al crear hilo en el foro: ${error.message}`);
  }

  const persisted: ForumThreadItem = {
    ...localThread,
    id: data?.id ? String(data.id) : localThread.id,
    createdAt: data?.created_at ? String(data.created_at) : localThread.createdAt,
    updatedAt: data?.updated_at ? String(data.updated_at) : localThread.updatedAt,
  };

  return {
    updatedThreads: filterForumThreads([persisted, ...threads]),
    createdThread: persisted,
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Publica una respuesta a un hilo del foro.
 * Si el hilo está bloqueado (`isLocked = true`), prohíbe la respuesta a usuarios con rol `player`
 * cumpliendo la política RLS de `forum_posts`.
 */
export async function replyToForumThread(
  threads: ForumThreadItem[],
  input: ReplyToForumThreadInput,
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  updatedThreads: ForumThreadItem[];
  createdPost: ForumPostItem;
  meta: ActionPersistenceMetadata;
}> {
  const thread = threads.find((t) => t.id === input.threadId);
  if (!thread) {
    throw new Error('El hilo de debate especificado no existe.');
  }

  if (thread.isLocked && !isClubAdminOrSuperadminRole(input.actorRole)) {
    throw new Error(
      'Debate cerrado (RLS): solo los administradores del club pueden responder en hilos bloqueados.'
    );
  }

  const cleanBody = input.body.trim();
  if (!cleanBody) {
    throw new Error('El cuerpo del mensaje no puede estar vacío.');
  }

  const nowIso = new Date().toISOString();
  const localPost: ForumPostItem = {
    id: `99999999-9999-4999-8999-${String(Date.now()).slice(-12).padStart(12, '0')}`,
    threadId: input.threadId,
    authorId: input.authorId,
    authorName: input.authorName,
    authorRole: input.actorRole,
    body: cleanBody,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const updatedThread: ForumThreadItem = {
    ...thread,
    updatedAt: nowIso,
    postsCount: thread.postsCount + 1,
    posts: [...(thread.posts ?? []), localPost],
  };

  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    const updatedThreads = filterForumThreads(
      threads.map((t) => (t.id === input.threadId ? updatedThread : t))
    );
    return {
      updatedThreads,
      createdPost: localPost,
      meta: resolvePersistenceMetadata(false),
    };
  }

  if (!isValidUuid(input.authorId) || !isValidUuid(input.threadId)) {
    throw new Error('author_id y thread_id deben ser UUIDs válidos para Supabase.');
  }

  const { data, error } = await supabase
    .from('forum_posts')
    .insert({
      thread_id: input.threadId,
      author_id: input.authorId,
      body: localPost.body,
    })
    .select('id, created_at, updated_at')
    .single();

  if (error) {
    throw new Error(`Error del servidor al responder en el foro: ${error.message}`);
  }

  const persistedPost: ForumPostItem = {
    ...localPost,
    id: data?.id ? String(data.id) : localPost.id,
    createdAt: data?.created_at ? String(data.created_at) : localPost.createdAt,
    updatedAt: data?.updated_at ? String(data.updated_at) : localPost.updatedAt,
  };

  const finalThread: ForumThreadItem = {
    ...thread,
    updatedAt: persistedPost.createdAt,
    postsCount: thread.postsCount + 1,
    posts: [...(thread.posts ?? []), persistedPost],
  };

  return {
    updatedThreads: filterForumThreads(
      threads.map((t) => (t.id === input.threadId ? finalThread : t))
    ),
    createdPost: persistedPost,
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Bloquea o desbloquea un hilo del foro (`isLocked`).
 * Restringido estrictamente a `club_admin` y `superadmin`.
 */
export async function toggleForumThreadLock(
  threads: ForumThreadItem[],
  input: ToggleForumThreadLockInput,
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  updatedThreads: ForumThreadItem[];
  updatedThread: ForumThreadItem;
  meta: ActionPersistenceMetadata;
}> {
  if (!isClubAdminOrSuperadminRole(input.actorRole)) {
    throw new Error(
      'Permiso denegado (RLS): solo club_admin o superadmin pueden bloquear o desbloquear hilos del foro.'
    );
  }

  const thread = threads.find((t) => t.id === input.threadId);
  if (!thread) {
    throw new Error('El hilo especificado no existe.');
  }

  const localUpdated: ForumThreadItem = {
    ...thread,
    isLocked: input.isLocked,
    updatedAt: new Date().toISOString(),
  };

  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    const nextList = filterForumThreads(
      threads.map((t) => (t.id === input.threadId ? localUpdated : t))
    );
    return {
      updatedThreads: nextList,
      updatedThread: localUpdated,
      meta: resolvePersistenceMetadata(false),
    };
  }

  const { error } = await supabase
    .from('forum_threads')
    .update({ is_locked: input.isLocked, updated_at: localUpdated.updatedAt })
    .eq('id', input.threadId);

  if (error) {
    throw new Error(`Error al actualizar estado de bloqueo en Supabase: ${error.message}`);
  }

  const nextList = filterForumThreads(
    threads.map((t) => (t.id === input.threadId ? localUpdated : t))
  );

  return {
    updatedThreads: nextList,
    updatedThread: localUpdated,
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Carga los hilos y respuestas del foro desde Supabase o el catálogo semilla en modo demo.
 */
export async function loadForumThreads(
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  threads: ForumThreadItem[];
  meta: ActionPersistenceMetadata;
}> {
  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      threads: filterForumThreads(INITIAL_FORUM_THREADS),
      meta: resolvePersistenceMetadata(false),
    };
  }

  const { data: threadsData, error: threadsError } = await supabase
    .from('forum_threads')
    .select('id, author_id, category, title, body, is_pinned, is_locked, created_at, updated_at')
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (threadsError) {
    throw new Error(`Error al cargar hilos del foro desde Supabase: ${threadsError.message}`);
  }

  const { data: postsData, error: postsError } = await supabase
    .from('forum_posts')
    .select('id, thread_id, author_id, body, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (postsError) {
    throw new Error(`Error al cargar respuestas del foro desde Supabase: ${postsError.message}`);
  }

  const postsByThread = new Map<string, ForumPostItem[]>();
  for (const row of postsData ?? []) {
    const tid = String(row.thread_id);
    const post: ForumPostItem = {
      id: String(row.id),
      threadId: tid,
      authorId: String(row.author_id),
      authorName: 'Socio del Club',
      body: String(row.body),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
    const list = postsByThread.get(tid) ?? [];
    list.push(post);
    postsByThread.set(tid, list);
  }

  const mapped: ForumThreadItem[] = (threadsData ?? []).map(
    (row: Record<string, unknown>) => {
      const tid = String(row.id);
      const posts = postsByThread.get(tid) ?? [];
      return {
        id: tid,
        authorId: String(row.author_id),
        authorName: 'Socio del Club',
        category: (row.category as ForumCategory) ?? 'general',
        title: String(row.title),
        body: String(row.body),
        isPinned: Boolean(row.is_pinned),
        isLocked: Boolean(row.is_locked),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        postsCount: posts.length,
        posts,
      };
    }
  );

  return {
    threads: filterForumThreads(mapped),
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Suscripción en tiempo real (Supabase Realtime) para hilos y respuestas del foro.
 * Devuelve una función para desuscribir el canal al desmontar el componente.
 */
export function subscribeToForumRealtime(
  options: {
    channelName?: string;
    onThreadChange?: (payload: Record<string, unknown>) => void;
    onPostChange?: (payload: Record<string, unknown>) => void;
  },
  customClient?: ReturnType<typeof getSupabaseClient>
): () => void {
  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return () => {};
  }

  const channelName = options.channelName ?? `forum_realtime_${Date.now()}`;
  const channel = supabase.channel(channelName);

  if (options.onThreadChange) {
    channel.on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table: 'forum_threads' } as never,
      (payload: unknown) => {
        options.onThreadChange?.(payload as Record<string, unknown>);
      }
    );
  }

  if (options.onPostChange) {
    channel.on(
      'postgres_changes' as never,
      { event: 'INSERT' as never, schema: 'public', table: 'forum_posts' } as never,
      (payload: unknown) => {
        options.onPostChange?.(payload as Record<string, unknown>);
      }
    );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// SUBFASE 4.4: CHAT PRIVADO EN TIEMPO REAL CON LA ADMINISTRACIÓN (/admin-chat)
// ============================================================================

export type AdminChatRoomStatus = 'open' | 'resolved';

export interface AdminChatMessageItem {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminChatRoomItem {
  id: string;
  playerId: string;
  playerName: string;
  playerLicense?: string;
  subject: string;
  status: AdminChatRoomStatus;
  lastMessageAt: string;
  createdAt: string;
  unreadCount: number;
  messages: AdminChatMessageItem[];
}

export interface SendAdminChatMessageInput {
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  body: string;
}

export interface CreateAdminChatRoomInput {
  playerId: string;
  playerName: string;
  playerLicense?: string;
  subject?: string;
  actorRole: UserRole;
}

/**
 * Catálogo semilla de salas de chat privado con administración con UUIDs RFC-4122 válidos.
 * Cada sala pertenece estrictamente a un único `playerId`.
 */
export const INITIAL_ADMIN_CHAT_ROOMS: AdminChatRoomItem[] = [
  {
    id: '77770000-0000-4000-8000-000000000001',
    playerId: 'aaaa0000-0000-0000-0000-000000000001', // Carlos Mendoza
    playerName: 'Carlos Mendoza',
    playerLicense: 'AM-284910',
    subject: 'Duda sobre correspondencias y tarifas de invitados',
    status: 'open',
    lastMessageAt: '2026-10-27T11:45:00Z',
    createdAt: '2026-10-26T09:30:00Z',
    unreadCount: 0,
    messages: [
      {
        id: '77771111-0000-4000-8000-000000000001',
        roomId: '77770000-0000-4000-8000-000000000001',
        senderId: 'aaaa0000-0000-0000-0000-000000000001',
        senderName: 'Carlos Mendoza',
        senderRole: 'player',
        body: 'Buenos días, querría saber las condiciones de correspondencia con el Club de Golf Las Encinas para jugar el próximo viernes.',
        isRead: true,
        createdAt: '2026-10-26T09:30:00Z',
      },
      {
        id: '77771111-0000-4000-8000-000000000002',
        roomId: '77770000-0000-4000-8000-000000000001',
        senderId: 'aaaa0000-0000-0000-0000-000000000003',
        senderName: 'Laura Gómez (Comité)',
        senderRole: 'club_admin',
        body: 'Hola Carlos, la correspondencia contempla un 50% de descuento sobre el green fee oficial presentando tu carnet de socio en secretaría.',
        isRead: true,
        createdAt: '2026-10-27T11:45:00Z',
      },
    ],
  },
  {
    id: '77770000-0000-4000-8000-000000000002',
    playerId: 'aaaa0000-0000-0000-0000-000000000201', // Elena Ruiz
    playerName: 'Elena Ruiz',
    playerLicense: 'AM-219044',
    subject: 'Solicitud de alquiler anual de taquilla en vestuario femenino',
    status: 'resolved',
    lastMessageAt: '2026-10-25T16:00:00Z',
    createdAt: '2026-10-24T12:00:00Z',
    unreadCount: 0,
    messages: [
      {
        id: '77771111-0000-4000-8000-000000000003',
        roomId: '77770000-0000-4000-8000-000000000002',
        senderId: 'aaaa0000-0000-0000-0000-000000000201',
        senderName: 'Elena Ruiz',
        senderRole: 'player',
        body: 'Hola, me gustaría solicitar la taquilla número 42 que ha quedado libre.',
        isRead: true,
        createdAt: '2026-10-24T12:00:00Z',
      },
      {
        id: '77771111-0000-4000-8000-000000000004',
        roomId: '77770000-0000-4000-8000-000000000002',
        senderId: 'aaaa0000-0000-0000-0000-000000000003',
        senderName: 'Laura Gómez (Comité)',
        senderRole: 'club_admin',
        body: 'Asignada y confirmada la taquilla 42. Puedes recoger la llave en recepción del club.',
        isRead: true,
        createdAt: '2026-10-25T16:00:00Z',
      },
    ],
  },
  {
    id: '77770000-0000-4000-8000-000000000003',
    playerId: 'aaaa0000-0000-0000-0000-000000000203', // Javier Ortega
    playerName: 'Javier Ortega',
    playerLicense: 'AM-104512',
    subject: 'Consulta sobre hándicap de juego en modalidad Scramble',
    status: 'open',
    lastMessageAt: '2026-10-27T08:15:00Z',
    createdAt: '2026-10-27T08:15:00Z',
    unreadCount: 1,
    messages: [
      {
        id: '77771111-0000-4000-8000-000000000005',
        roomId: '77770000-0000-4000-8000-000000000003',
        senderId: 'aaaa0000-0000-0000-0000-000000000203',
        senderName: 'Javier Ortega',
        senderRole: 'player',
        body: 'Para el torneo Scramble por parejas, ¿se aplica el 35% del hándicap más bajo y 15% del más alto?',
        isRead: false,
        createdAt: '2026-10-27T08:15:00Z',
      },
    ],
  },
];

/**
 * Aislamiento estricto de salas de chat según el rol del actor:
 * - Un usuario `player` solo puede ver y acceder a su propia sala (`room.playerId === actor.id`).
 * - Un usuario `club_admin` o `superadmin` accede a todas las salas de socios para gestionarlas.
 */
export function getVisibleAdminChatRooms(
  rooms: AdminChatRoomItem[],
  actor: { id: string; role: UserRole; name?: string }
): AdminChatRoomItem[] {
  if (isClubAdminOrSuperadminRole(actor.role)) {
    return [...rooms].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }

  // Filtrado estricto por jugador propietario
  const userRooms = rooms.filter((r) => r.playerId === actor.id);
  if (userRooms.length > 0) {
    return userRooms;
  }

  // Si no tiene sala previa, creamos una sala privada inicial para el socio
  const nowIso = new Date().toISOString();
  const personalRoom: AdminChatRoomItem = {
    id: `77770000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
    playerId: actor.id,
    playerName: actor.name || 'Socio del Club',
    subject: 'Consulta directa a Administración',
    status: 'open',
    lastMessageAt: nowIso,
    createdAt: nowIso,
    unreadCount: 0,
    messages: [],
  };

  return [personalRoom];
}

/**
 * Carga las salas y mensajes de chat privado con administración desde Supabase
 * o desde el catálogo semilla en modo demo, garantizando aislamiento estricto por socio.
 */
export async function loadAdminChatRooms(
  actor: { id: string; role: UserRole; name?: string },
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  rooms: AdminChatRoomItem[];
  meta: ActionPersistenceMetadata;
}> {
  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      rooms: getVisibleAdminChatRooms(INITIAL_ADMIN_CHAT_ROOMS, actor),
      meta: resolvePersistenceMetadata(false),
    };
  }

  const isAdmin = isClubAdminOrSuperadminRole(actor.role);
  let roomsQuery = supabase
    .from('admin_chat_rooms')
    .select('id, player_id, subject, status, last_message_at, created_at')
    .order('last_message_at', { ascending: false });

  if (!isAdmin) {
    roomsQuery = roomsQuery.eq('player_id', actor.id);
  }

  const { data: roomsData, error: roomsError } = await roomsQuery;
  if (roomsError) {
    throw new Error(`Error al cargar salas de chat desde Supabase: ${roomsError.message}`);
  }

  const { data: messagesData, error: messagesError } = await supabase
    .from('admin_chat_messages')
    .select('id, room_id, sender_id, body, is_read, created_at')
    .order('created_at', { ascending: true });

  if (messagesError) {
    throw new Error(`Error al cargar mensajes de chat desde Supabase: ${messagesError.message}`);
  }

  const messagesByRoom = new Map<string, AdminChatMessageItem[]>();
  for (const row of messagesData ?? []) {
    const rid = String(row.room_id);
    const msg: AdminChatMessageItem = {
      id: String(row.id),
      roomId: rid,
      senderId: String(row.sender_id),
      senderName: 'Usuario',
      senderRole: 'player',
      body: String(row.body),
      isRead: Boolean(row.is_read),
      createdAt: String(row.created_at),
    };
    const list = messagesByRoom.get(rid) ?? [];
    list.push(msg);
    messagesByRoom.set(rid, list);
  }

  const mapped: AdminChatRoomItem[] = (roomsData ?? []).map(
    (row: Record<string, unknown>) => {
      const rid = String(row.id);
      const msgs = messagesByRoom.get(rid) ?? [];
      const unread = msgs.filter((m) => !m.isRead && m.senderId !== actor.id).length;
      return {
        id: rid,
        playerId: String(row.player_id),
        playerName: 'Socio del Club',
        subject: String(row.subject ?? 'Consulta a Administración'),
        status: (row.status as AdminChatRoomStatus) ?? 'open',
        lastMessageAt: String(row.last_message_at ?? new Date().toISOString()),
        createdAt: String(row.created_at ?? new Date().toISOString()),
        unreadCount: unread,
        messages: msgs,
      };
    }
  );

  return {
    rooms: getVisibleAdminChatRooms(mapped, actor),
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Envía un mensaje en una sala de chat con el administrador.
 * Prohíbe a un usuario `player` escribir en la sala de otro socio (RLS enforcement).
 */
export async function sendAdminChatMessage(
  rooms: AdminChatRoomItem[],
  input: SendAdminChatMessageInput,
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  updatedRooms: AdminChatRoomItem[];
  createdMessage: AdminChatMessageItem;
  meta: ActionPersistenceMetadata;
}> {
  const room = rooms.find((r) => r.id === input.roomId);
  if (!room) {
    throw new Error('La sala de chat especificada no existe.');
  }

  // Verificación estricta de privacidad RLS
  const isAdmin = isClubAdminOrSuperadminRole(input.senderRole);
  if (!isAdmin && room.playerId !== input.senderId) {
    throw new Error(
      'Acceso denegado (RLS): no tienes permiso para enviar mensajes en la sala privada de otro socio.'
    );
  }

  const cleanBody = input.body.trim();
  if (!cleanBody) {
    throw new Error('El mensaje no puede estar vacío.');
  }

  const nowIso = new Date().toISOString();
  const localMessage: AdminChatMessageItem = {
    id: `77771111-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
    roomId: input.roomId,
    senderId: input.senderId,
    senderName: input.senderName,
    senderRole: input.senderRole,
    body: cleanBody,
    isRead: false,
    createdAt: nowIso,
  };

  const updatedRoom: AdminChatRoomItem = {
    ...room,
    lastMessageAt: nowIso,
    messages: [...room.messages, localMessage],
  };

  const nextRooms = rooms.map((r) => (r.id === input.roomId ? updatedRoom : r));

  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      updatedRooms: nextRooms,
      createdMessage: localMessage,
      meta: resolvePersistenceMetadata(false),
    };
  }

  if (!isValidUuid(input.senderId) || !isValidUuid(input.roomId)) {
    throw new Error('senderId y roomId deben ser UUIDs válidos para Supabase.');
  }

  const { data, error } = await supabase
    .from('admin_chat_messages')
    .insert({
      room_id: input.roomId,
      sender_id: input.senderId,
      body: localMessage.body,
      is_read: false,
    })
    .select('id, created_at')
    .single();

  if (error) {
    throw new Error(`Error al enviar mensaje en Supabase: ${error.message}`);
  }

  await supabase
    .from('admin_chat_rooms')
    .update({ last_message_at: nowIso })
    .eq('id', input.roomId);

  const persistedMsg: AdminChatMessageItem = {
    ...localMessage,
    id: data?.id ? String(data.id) : localMessage.id,
    createdAt: data?.created_at ? String(data.created_at) : localMessage.createdAt,
  };

  const finalRoom: AdminChatRoomItem = {
    ...room,
    lastMessageAt: persistedMsg.createdAt,
    messages: [...room.messages, persistedMsg],
  };

  return {
    updatedRooms: rooms.map((r) => (r.id === input.roomId ? finalRoom : r)),
    createdMessage: persistedMsg,
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Suscripción en tiempo real a mensajes de chat con el administrador.
 */
export function subscribeToAdminChatRealtime(
  options: {
    channelName?: string;
    onMessageReceived?: (msg: Record<string, unknown>) => void;
  },
  customClient?: ReturnType<typeof getSupabaseClient>
): () => void {
  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return () => {};
  }

  const channelName = options.channelName ?? `admin_chat_${Date.now()}`;
  const channel = supabase.channel(channelName);

  if (options.onMessageReceived) {
    channel.on(
      'postgres_changes' as never,
      { event: 'INSERT' as never, schema: 'public', table: 'admin_chat_messages' } as never,
      (payload: unknown) => {
        options.onMessageReceived?.(payload as Record<string, unknown>);
      }
    );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// SUBFASE 4.5: PANEL DE ADMINISTRACIÓN DEL CLUB (/admin)
// ============================================================================

export interface AdminDashboardStats {
  totalMembers: number;
  publishedNewsCount: number;
  draftNewsCount: number;
  openForumThreadsCount: number;
  lockedForumThreadsCount: number;
  openAdminChatRoomsCount: number;
  unreadAdminChatMessagesCount: number;
  resolvedAdminChatRoomsCount: number;
}

/**
 * Guardia de acceso: comprueba si el rol tiene privilegios de administración del club.
 */
export function canAccessAdminPanel(role: UserRole): boolean {
  return isClubAdminOrSuperadminRole(role);
}

/**
 * Guardia asertivo: lanza error HTTP 403 si el rol no tiene permisos administrativos.
 */
export function assertAdminRole(role: UserRole): void {
  if (!canAccessAdminPanel(role)) {
    throw new Error(
      'Acceso denegado (403): Se requieren permisos de club_admin o superadmin para acceder a este recurso.'
    );
  }
}

/**
 * Calcula las métricas e indicadores de rendimiento (KPIs) para la consola de administración.
 */
export function computeAdminDashboardStats(params: {
  players?: PlayerProfile[];
  articles?: NewsArticleItem[];
  infoPages?: ClubInfoPageItem[];
  forumThreads?: ForumThreadItem[];
  adminChatRooms?: AdminChatRoomItem[];
} = {}): AdminDashboardStats {
  const playersList = params.players ?? INITIAL_DIRECTORY_PLAYERS;
  const articlesList = params.articles ?? INITIAL_NEWS_ARTICLES;
  const forumList = params.forumThreads ?? INITIAL_FORUM_THREADS;
  const chatRoomsList = params.adminChatRooms ?? INITIAL_ADMIN_CHAT_ROOMS;

  const totalMembers = playersList.length;
  const publishedNewsCount = articlesList.filter((a) => a.isPublished).length;
  const draftNewsCount = articlesList.filter((a) => !a.isPublished).length;
  const openForumThreadsCount = forumList.filter((t) => !t.isLocked).length;
  const lockedForumThreadsCount = forumList.filter((t) => t.isLocked).length;
  const openAdminChatRoomsCount = chatRoomsList.filter((r) => r.status === 'open').length;
  const resolvedAdminChatRoomsCount = chatRoomsList.filter((r) => r.status === 'resolved').length;
  const unreadAdminChatMessagesCount = chatRoomsList.reduce(
    (acc, r) => acc + (r.unreadCount ?? 0),
    0
  );

  return {
    totalMembers,
    publishedNewsCount,
    draftNewsCount,
    openForumThreadsCount,
    lockedForumThreadsCount,
    openAdminChatRoomsCount,
    unreadAdminChatMessagesCount,
    resolvedAdminChatRoomsCount,
  };
}

/**
 * Carga o computa los KPIs del panel de control de administración,
 * verificando previamente los permisos con `assertAdminRole`.
 */
export async function loadAdminDashboardStats(
  role: UserRole,
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  stats: AdminDashboardStats;
  meta: ActionPersistenceMetadata;
}> {
  assertAdminRole(role);

  const supabase =
    customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      stats: computeAdminDashboardStats(),
      meta: resolvePersistenceMetadata(false),
    };
  }

  // Carga paralela de conteos reales desde Supabase
  const [
    { count: profilesCount },
    { count: newsPublishedCount },
    { count: newsDraftCount },
    { count: forumOpenCount },
    { count: forumLockedCount },
    { count: chatOpenCount },
    { count: chatResolvedCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true),
    supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', false),
    supabase
      .from('forum_threads')
      .select('*', { count: 'exact', head: true })
      .eq('is_locked', false),
    supabase
      .from('forum_threads')
      .select('*', { count: 'exact', head: true })
      .eq('is_locked', true),
    supabase
      .from('admin_chat_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('admin_chat_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved'),
  ]);

  const stats: AdminDashboardStats = {
    totalMembers: profilesCount ?? INITIAL_DIRECTORY_PLAYERS.length,
    publishedNewsCount: newsPublishedCount ?? INITIAL_NEWS_ARTICLES.filter((a) => a.isPublished).length,
    draftNewsCount: newsDraftCount ?? INITIAL_NEWS_ARTICLES.filter((a) => !a.isPublished).length,
    openForumThreadsCount: forumOpenCount ?? INITIAL_FORUM_THREADS.filter((t) => !t.isLocked).length,
    lockedForumThreadsCount: forumLockedCount ?? INITIAL_FORUM_THREADS.filter((t) => t.isLocked).length,
    openAdminChatRoomsCount: chatOpenCount ?? INITIAL_ADMIN_CHAT_ROOMS.filter((r) => r.status === 'open').length,
    unreadAdminChatMessagesCount: 0,
    resolvedAdminChatRoomsCount: chatResolvedCount ?? INITIAL_ADMIN_CHAT_ROOMS.filter((r) => r.status === 'resolved').length,
  };

  return {
    stats,
    meta: resolvePersistenceMetadata(true),
  };
}




