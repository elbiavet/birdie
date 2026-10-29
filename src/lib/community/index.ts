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

