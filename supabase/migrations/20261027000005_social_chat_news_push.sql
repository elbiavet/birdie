-- ============================================================================
-- MIGRACIÓN 05: Noticias, Información de Interés, Foro y Chat en Tiempo Real con el Administrador
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'forum_category') THEN
    CREATE TYPE public.forum_category AS ENUM ('general', 'find_partner', 'rules', 'equipment', 'competitions');
  END IF;
END
$$;

-- ============================================================================
-- 1. SECCIÓN DE NOTICIAS DEL CLUB
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. SECCIÓN DE INFORMACIÓN DE INTERÉS (Reglas locales, tarifas, horarios, correspondencias)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.club_info_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  content_markdown TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. FORO DE LA COMUNIDAD
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category public.forum_category NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON public.forum_posts(thread_id, created_at ASC);

-- ============================================================================
-- 4. CHAT DIRECTO CON EL ADMINISTRADOR (Privado 1-a-1 Socio <-> Administración)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT 'Consulta a Administración',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.admin_chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_messages_room ON public.admin_chat_messages(room_id, created_at ASC);

-- Función helper para verificar acceso exclusivo a una sala de chat con el administrador
CREATE OR REPLACE FUNCTION public.can_access_admin_chat_room(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_club_admin_or_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.admin_chat_rooms r
    WHERE r.id = target_room_id AND r.player_id = auth.uid()
  );
$$;

-- ============================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================================
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_info_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;

-- 1. Noticias: lectura artículos publicados (o todos para admin); escritura exclusiva admin
CREATE POLICY "news_articles_select_published_or_admin"
  ON public.news_articles FOR SELECT TO authenticated
  USING (is_published = true OR public.is_club_admin_or_superadmin());

CREATE POLICY "news_articles_write_admin_only"
  ON public.news_articles FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

-- 2. Información de interés: lectura socios autenticados; escritura exclusiva admin
CREATE POLICY "club_info_pages_select_authenticated"
  ON public.club_info_pages FOR SELECT TO authenticated USING (true);

CREATE POLICY "club_info_pages_write_admin_only"
  ON public.club_info_pages FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

-- 3. Foro (Hilos): lectura todos los autenticados; creación por el propio autor; edición/borrado autor o admin
CREATE POLICY "forum_threads_select_authenticated"
  ON public.forum_threads FOR SELECT TO authenticated USING (true);

CREATE POLICY "forum_threads_insert_author"
  ON public.forum_threads FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "forum_threads_update_author_or_admin"
  ON public.forum_threads FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_club_admin_or_superadmin())
  WITH CHECK (author_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "forum_threads_delete_author_or_admin"
  ON public.forum_threads FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_club_admin_or_superadmin());

-- 4. Foro (Respuestas): lectura todos; inserción si el hilo no está cerrado (o si es admin)
CREATE POLICY "forum_posts_select_authenticated"
  ON public.forum_posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "forum_posts_insert_unlocked_or_admin"
  ON public.forum_posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_club_admin_or_superadmin()
      OR EXISTS (
        SELECT 1 FROM public.forum_threads t
        WHERE t.id = forum_posts.thread_id AND t.is_locked = false
      )
    )
  );

CREATE POLICY "forum_posts_update_author_or_admin"
  ON public.forum_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_club_admin_or_superadmin())
  WITH CHECK (author_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "forum_posts_delete_author_or_admin"
  ON public.forum_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_club_admin_or_superadmin());

-- 5. Salas de Chat con el Administrador: ESTRICTAMENTE privadas entre player_id y club_admin/superadmin
CREATE POLICY "admin_chat_rooms_select_owner_or_admin"
  ON public.admin_chat_rooms FOR SELECT TO authenticated
  USING (player_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "admin_chat_rooms_insert_owner_or_admin"
  ON public.admin_chat_rooms FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "admin_chat_rooms_update_owner_or_admin"
  ON public.admin_chat_rooms FOR UPDATE TO authenticated
  USING (player_id = auth.uid() OR public.is_club_admin_or_superadmin())
  WITH CHECK (player_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "admin_chat_rooms_delete_admin_only"
  ON public.admin_chat_rooms FOR DELETE TO authenticated
  USING (public.is_club_admin_or_superadmin());

-- 6. Mensajes del Chat con el Administrador: ESTRICTAMENTE privados para el titular de la sala y admins
CREATE POLICY "admin_chat_messages_select_room_owner_or_admin"
  ON public.admin_chat_messages FOR SELECT TO authenticated
  USING (public.can_access_admin_chat_room(room_id));

CREATE POLICY "admin_chat_messages_insert_room_owner_or_admin"
  ON public.admin_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_access_admin_chat_room(room_id)
  );

CREATE POLICY "admin_chat_messages_update_room_owner_or_admin"
  ON public.admin_chat_messages FOR UPDATE TO authenticated
  USING (public.can_access_admin_chat_room(room_id))
  WITH CHECK (public.can_access_admin_chat_room(room_id));

CREATE POLICY "admin_chat_messages_delete_admin_only"
  ON public.admin_chat_messages FOR DELETE TO authenticated
  USING (public.is_club_admin_or_superadmin());

-- ============================================================================
-- CONFIGURACIÓN DE SUPABASE REALTIME
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hole_scores;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_threads;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_posts;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_chat_messages;
  END IF;
END
$$;
