-- ============================================================================
-- BIRDIE — SCRIPT SQL CONSOLIDADO (5 Migraciones + Semilla Inicial)
-- Pega este archivo en el SQL Editor de tu proyecto Supabase y pulsa "Run"
-- ============================================================================

-- >>> INICIO MIGRACIÓN: 20261027000001_core_roles_and_profiles.sql
-- ============================================================================
-- MIGRACIÓN 01: Roles (player, club_admin, superadmin), Perfiles, Handicap y Push Tokens
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('player', 'club_admin', 'superadmin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'push_platform') THEN
    CREATE TYPE public.push_platform AS ENUM ('android', 'ios', 'web');
  END IF;
END
$$;

-- ============================================================================
-- TABLA: public.profiles (Perfil del jugador con su handicap y visibilidad en directorio)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  federation_license TEXT UNIQUE,
  handicap_index NUMERIC(4, 1) NOT NULL DEFAULT 36.0 CHECK (handicap_index >= -10.0 AND handicap_index <= 54.0),
  role public.user_role NOT NULL DEFAULT 'player',
  phone TEXT,
  bio TEXT,
  is_directory_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_directory_visible ON public.profiles(is_directory_visible, handicap_index);

-- ============================================================================
-- FUNCIONES HELPER DE ROLES Y AUTORIZACIÓN PARA RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
  db_role public.user_role;
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN 'superadmin'::public.user_role;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  jwt_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF jwt_role IN ('player', 'club_admin', 'superadmin') THEN
    RETURN jwt_role::public.user_role;
  END IF;

  SELECT p.role INTO db_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  RETURN COALESCE(db_role, 'player'::public.user_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin_or_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() IN ('club_admin', 'superadmin'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'superadmin', false);
$$;

-- Trigger para evitar que un jugador escale su propio rol sin ser administrador
CREATE OR REPLACE FUNCTION public.enforce_profile_role_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_club_admin_or_superadmin() THEN
      RAISE EXCEPTION 'Permiso denegado: un jugador no puede modificar su propio rol.';
    END IF;
    IF NEW.role = 'superadmin' AND NOT public.is_superadmin() THEN
      RAISE EXCEPTION 'Permiso denegado: solo un superadmin puede otorgar el rol superadmin.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_role_security ON public.profiles;
CREATE TRIGGER trg_enforce_profile_role_security
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_role_security();

-- Trigger para sincronizar el rol hacia raw_app_meta_data en auth.users
CREATE OR REPLACE FUNCTION public.sync_role_to_auth_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_role_to_auth_metadata ON public.profiles;
CREATE TRIGGER trg_sync_role_to_auth_metadata
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_role_to_auth_metadata();

-- ============================================================================
-- TABLA: public.handicap_history (Evolución histórica del hándicap del jugador)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.handicap_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_handicap NUMERIC(4, 1),
  new_handicap NUMERIC(4, 1) NOT NULL CHECK (new_handicap >= -10.0 AND new_handicap <= 54.0),
  reason TEXT NOT NULL DEFAULT 'Actualización de tarjeta / revisión federativa',
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handicap_history_user_date ON public.handicap_history(user_id, effective_date DESC);

-- ============================================================================
-- TABLA: public.device_push_tokens (Tokens FCM y APNs por dispositivo del socio)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform public.push_platform NOT NULL,
  device_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_active ON public.device_push_tokens(user_id, is_active);

-- ============================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handicap_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para public.profiles
CREATE POLICY "profiles_select_directory_or_self_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR is_directory_visible = true
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "profiles_insert_self_or_admin"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (id = auth.uid() AND role = 'player')
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "profiles_update_self_or_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_club_admin_or_superadmin()
  )
  WITH CHECK (
    id = auth.uid()
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "profiles_delete_superadmin_only"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

-- 2. Políticas para public.handicap_history
CREATE POLICY "handicap_history_select_authenticated"
  ON public.handicap_history
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_club_admin_or_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = handicap_history.user_id AND p.is_directory_visible = true
    )
  );

CREATE POLICY "handicap_history_insert_self_or_admin"
  ON public.handicap_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "handicap_history_update_admin_only"
  ON public.handicap_history
  FOR UPDATE
  TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

CREATE POLICY "handicap_history_delete_admin_only"
  ON public.handicap_history
  FOR DELETE
  TO authenticated
  USING (public.is_club_admin_or_superadmin());

-- 3. Políticas para public.device_push_tokens (Privado por usuario; lectura admin para envíos)
CREATE POLICY "device_push_tokens_select_owner_or_admin"
  ON public.device_push_tokens
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "device_push_tokens_insert_owner_only"
  ON public.device_push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "device_push_tokens_update_owner_only"
  ON public.device_push_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "device_push_tokens_delete_owner_or_admin"
  ON public.device_push_tokens
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_club_admin_or_superadmin()
  );

-- <<< FIN MIGRACIÓN: 20261027000001_core_roles_and_profiles.sql

-- >>> INICIO MIGRACIÓN: 20261027000002_courses_and_gps.sql
-- ============================================================================
-- MIGRACIÓN 02: Directorio de Campos (Golf API Sync), Barras de Salida, Hoyos y GPS POIs
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poi_type') THEN
    CREATE TYPE public.poi_type AS ENUM (
      'green_front',
      'green_center',
      'green_back',
      'bunker',
      'water_hazard',
      'dogleg',
      'tee_box'
    );
  END IF;
END
$$;

-- ============================================================================
-- TABLA: public.courses (Campos de golf propios del club y directorio Golf API)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_golf_api_id TEXT UNIQUE,
  name TEXT NOT NULL,
  club_name TEXT NOT NULL,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'España',
  holes_count INT NOT NULL DEFAULT 18 CHECK (holes_count IN (9, 18)),
  par_total INT NOT NULL DEFAULT 72 CHECK (par_total BETWEEN 27 AND 76),
  latitude NUMERIC(9, 6) CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9, 6) CHECK (longitude BETWEEN -180 AND 180),
  address TEXT,
  phone TEXT,
  website TEXT,
  is_home_course BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- TABLA: public.course_tees (Barras de salida: Amarillas, Blancas, Azules, Rojas...)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.course_tees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#FACC15',
  gender TEXT NOT NULL DEFAULT 'mixed' CHECK (gender IN ('men', 'women', 'mixed')),
  course_rating NUMERIC(4, 1) NOT NULL DEFAULT 71.5,
  slope_rating INT NOT NULL DEFAULT 128 CHECK (slope_rating BETWEEN 55 AND 155),
  total_distance_meters INT NOT NULL DEFAULT 6050,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, name, gender)
);

-- ============================================================================
-- TABLA: public.course_holes (Pares, hándicap de hoyo y coordenadas GPS del green)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.course_holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  hole_number INT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INT NOT NULL CHECK (par BETWEEN 3 AND 6),
  stroke_index INT NOT NULL CHECK (stroke_index BETWEEN 1 AND 18),
  distance_white_meters INT,
  distance_yellow_meters INT NOT NULL,
  distance_blue_meters INT,
  distance_red_meters INT,
  green_front_lat NUMERIC(9, 6) NOT NULL,
  green_front_lng NUMERIC(9, 6) NOT NULL,
  green_center_lat NUMERIC(9, 6) NOT NULL,
  green_center_lng NUMERIC(9, 6) NOT NULL,
  green_back_lat NUMERIC(9, 6) NOT NULL,
  green_back_lng NUMERIC(9, 6) NOT NULL,
  tee_lat NUMERIC(9, 6),
  tee_lng NUMERIC(9, 6),
  UNIQUE (course_id, hole_number)
);

CREATE INDEX IF NOT EXISTS idx_course_holes_course_num ON public.course_holes(course_id, hole_number);

-- ============================================================================
-- TABLA: public.hole_pois (Puntos de interés GPS adicionales por hoyo: bunkers, agua, dogleg)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hole_pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hole_id UUID NOT NULL REFERENCES public.course_holes(id) ON DELETE CASCADE,
  poi_type public.poi_type NOT NULL,
  label TEXT NOT NULL,
  latitude NUMERIC(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hole_pois_hole ON public.hole_pois(hole_id);

-- ============================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================================
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_tees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hole_pois ENABLE ROW LEVEL SECURITY;

-- Lectura permitida a usuarios autenticados; escritura exclusiva para club_admin y superadmin
CREATE POLICY "courses_select_authenticated"
  ON public.courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "courses_write_admin_only"
  ON public.courses FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

CREATE POLICY "course_tees_select_authenticated"
  ON public.course_tees FOR SELECT TO authenticated USING (true);

CREATE POLICY "course_tees_write_admin_only"
  ON public.course_tees FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

CREATE POLICY "course_holes_select_authenticated"
  ON public.course_holes FOR SELECT TO authenticated USING (true);

CREATE POLICY "course_holes_write_admin_only"
  ON public.course_holes FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

CREATE POLICY "hole_pois_select_authenticated"
  ON public.hole_pois FOR SELECT TO authenticated USING (true);

CREATE POLICY "hole_pois_write_admin_only"
  ON public.hole_pois FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

-- ============================================================================
-- FUNCIÓN RPC TRANSACCIONAL: public.sync_golf_course_atomic
-- Garantiza que la sincronización de un campo desde Golf API actualice
-- public.courses, public.course_tees y public.course_holes en una única
-- transacción atómica, haciendo upsert de barras por (course_id, name, gender)
-- sin duplicarlas y revirtiendo todo si falla cualquier fila.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_golf_course_atomic(
  p_course JSONB,
  p_tees JSONB,
  p_holes JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  IF NOT public.is_club_admin_or_superadmin() THEN
    RAISE EXCEPTION 'Permiso denegado: solo club_admin o superadmin pueden sincronizar campos.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.courses (
    external_golf_api_id,
    name,
    club_name,
    city,
    country,
    holes_count,
    par_total,
    latitude,
    longitude,
    address,
    phone,
    website,
    is_home_course,
    last_synced_at,
    updated_at
  )
  VALUES (
    p_course->>'external_golf_api_id',
    p_course->>'name',
    COALESCE(p_course->>'club_name', p_course->>'name'),
    p_course->>'city',
    COALESCE(p_course->>'country', 'España'),
    COALESCE((p_course->>'holes_count')::INT, 18),
    COALESCE((p_course->>'par_total')::INT, 72),
    (p_course->>'latitude')::NUMERIC,
    (p_course->>'longitude')::NUMERIC,
    p_course->>'address',
    p_course->>'phone',
    p_course->>'website',
    COALESCE((p_course->>'is_home_course')::BOOLEAN, false),
    now(),
    now()
  )
  ON CONFLICT (external_golf_api_id) DO UPDATE SET
    name = EXCLUDED.name,
    club_name = EXCLUDED.club_name,
    city = EXCLUDED.city,
    country = EXCLUDED.country,
    holes_count = EXCLUDED.holes_count,
    par_total = EXCLUDED.par_total,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    website = EXCLUDED.website,
    is_home_course = EXCLUDED.is_home_course,
    last_synced_at = now(),
    updated_at = now()
  RETURNING id INTO v_course_id;

  -- Upsert idempotente de barras de salida sin duplicar (UNIQUE (course_id, name, gender))
  IF jsonb_typeof(p_tees) = 'array' AND jsonb_array_length(p_tees) > 0 THEN
    -- Eliminar barras de salida obsoletas que ya no vengan en la respuesta actual del proveedor
    DELETE FROM public.course_tees ct
    WHERE ct.course_id = v_course_id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_tees) AS t
        WHERE ct.name = (t->>'name')
          AND ct.gender = COALESCE(t->>'gender', 'mixed')
      );

    INSERT INTO public.course_tees (
      course_id,
      name,
      color_hex,
      gender,
      course_rating,
      slope_rating,
      total_distance_meters
    )
    SELECT
      v_course_id,
      t->>'name',
      COALESCE(t->>'color_hex', '#FACC15'),
      COALESCE(t->>'gender', 'mixed'),
      (t->>'course_rating')::NUMERIC,
      (t->>'slope_rating')::INT,
      (t->>'total_distance_meters')::INT
    FROM jsonb_array_elements(p_tees) AS t
    ON CONFLICT (course_id, name, gender) DO UPDATE SET
      color_hex = EXCLUDED.color_hex,
      course_rating = EXCLUDED.course_rating,
      slope_rating = EXCLUDED.slope_rating,
      total_distance_meters = EXCLUDED.total_distance_meters;
  END IF;

  -- Upsert idempotente de hoyos (UNIQUE (course_id, hole_number)) y limpieza de hoyos obsoletos
  IF jsonb_typeof(p_holes) = 'array' AND jsonb_array_length(p_holes) > 0 THEN
    -- Eliminar hoyos obsoletos que existieran previamente para este campo y no aparezcan en el nuevo lote
    DELETE FROM public.course_holes ch
    WHERE ch.course_id = v_course_id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_holes) AS h
        WHERE ch.hole_number = (h->>'hole_number')::INT
      );

    INSERT INTO public.course_holes (
      course_id,
      hole_number,
      par,
      stroke_index,
      distance_white_meters,
      distance_yellow_meters,
      distance_blue_meters,
      distance_red_meters,
      tee_lat,
      tee_lng,
      green_front_lat,
      green_front_lng,
      green_center_lat,
      green_center_lng,
      green_back_lat,
      green_back_lng
    )
    SELECT
      v_course_id,
      (h->>'hole_number')::INT,
      (h->>'par')::INT,
      (h->>'stroke_index')::INT,
      (h->>'distance_white_meters')::INT,
      (h->>'distance_yellow_meters')::INT,
      (h->>'distance_blue_meters')::INT,
      (h->>'distance_red_meters')::INT,
      (h->>'tee_lat')::NUMERIC,
      (h->>'tee_lng')::NUMERIC,
      (h->>'green_front_lat')::NUMERIC,
      (h->>'green_front_lng')::NUMERIC,
      (h->>'green_center_lat')::NUMERIC,
      (h->>'green_center_lng')::NUMERIC,
      (h->>'green_back_lat')::NUMERIC,
      (h->>'green_back_lng')::NUMERIC
    FROM jsonb_array_elements(p_holes) AS h
    ON CONFLICT (course_id, hole_number) DO UPDATE SET
      par = EXCLUDED.par,
      stroke_index = EXCLUDED.stroke_index,
      distance_white_meters = EXCLUDED.distance_white_meters,
      distance_yellow_meters = EXCLUDED.distance_yellow_meters,
      distance_blue_meters = EXCLUDED.distance_blue_meters,
      distance_red_meters = EXCLUDED.distance_red_meters,
      tee_lat = EXCLUDED.tee_lat,
      tee_lng = EXCLUDED.tee_lng,
      green_front_lat = EXCLUDED.green_front_lat,
      green_front_lng = EXCLUDED.green_front_lng,
      green_center_lat = EXCLUDED.green_center_lat,
      green_center_lng = EXCLUDED.green_center_lng,
      green_back_lat = EXCLUDED.green_back_lat,
      green_back_lng = EXCLUDED.green_back_lng;
  END IF;

  RETURN v_course_id;
END;
$$;

-- <<< FIN MIGRACIÓN: 20261027000002_courses_and_gps.sql

-- >>> INICIO MIGRACIÓN: 20261027000003_scorecards_and_stats.sql
-- ============================================================================
-- MIGRACIÓN 03: Marcador (Rondas, Jugadores por Partida, Golpes por Hoyo) y Estadísticas
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'round_status') THEN
    CREATE TYPE public.round_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scoring_format') THEN
    CREATE TYPE public.scoring_format AS ENUM ('stableford', 'stroke_play', 'match_play');
  END IF;
END
$$;

-- ============================================================================
-- TABLA: public.rounds (Partidas / Vueltas de Golf)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  tee_id UUID REFERENCES public.course_tees(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  played_on DATE NOT NULL DEFAULT CURRENT_DATE,
  scoring_format public.scoring_format NOT NULL DEFAULT 'stableford',
  status public.round_status NOT NULL DEFAULT 'in_progress',
  is_public BOOLEAN NOT NULL DEFAULT true,
  weather_notes TEXT,
  offline_client_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rounds_created_by_date ON public.rounds(created_by, played_on DESC);

-- ============================================================================
-- TABLA: public.round_players (Jugadores participantes en una partida)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.round_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  playing_handicap INT NOT NULL DEFAULT 18,
  exact_handicap_at_round NUMERIC(4, 1) NOT NULL DEFAULT 18.0,
  gross_total INT,
  net_total INT,
  stableford_points_total INT,
  is_marker BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_round_players_player ON public.round_players(player_id);

-- ============================================================================
-- TABLA: public.hole_scores (Golpes y estadísticas hoyo a hoyo: Putts, FIR, GIR, Bunker, Penalidad)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hole_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hole_number INT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes INT NOT NULL CHECK (strokes BETWEEN 1 AND 20),
  putts INT NOT NULL DEFAULT 2 CHECK (putts BETWEEN 0 AND 10),
  fairway_hit BOOLEAN,
  green_in_regulation BOOLEAN NOT NULL DEFAULT false,
  sand_save BOOLEAN,
  penalty_strokes INT NOT NULL DEFAULT 0 CHECK (penalty_strokes BETWEEN 0 AND 10),
  stableford_points INT NOT NULL DEFAULT 0 CHECK (stableford_points BETWEEN 0 AND 10),
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, player_id, hole_number)
);

CREATE INDEX IF NOT EXISTS idx_hole_scores_round_player ON public.hole_scores(round_id, player_id);

-- Función helper para comprobar si el usuario autenticado participa o creó la partida
CREATE OR REPLACE FUNCTION public.is_participant_in_round(target_round_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = target_round_id AND r.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = target_round_id AND rp.player_id = auth.uid()
  );
$$;

-- ============================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================================
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hole_scores ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para public.rounds
CREATE POLICY "rounds_select_public_or_participant_or_admin"
  ON public.rounds
  FOR SELECT
  TO authenticated
  USING (
    is_public = true
    OR created_by = auth.uid()
    OR public.is_participant_in_round(id)
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "rounds_insert_authenticated_creator"
  ON public.rounds
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "rounds_update_participant_or_admin"
  ON public.rounds
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_participant_in_round(id)
    OR public.is_club_admin_or_superadmin()
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_participant_in_round(id)
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "rounds_delete_creator_or_admin"
  ON public.rounds
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_club_admin_or_superadmin()
  );

-- 2. Políticas para public.round_players
CREATE POLICY "round_players_select_visible"
  ON public.round_players
  FOR SELECT
  TO authenticated
  USING (
    player_id = auth.uid()
    OR public.is_participant_in_round(round_id)
    OR public.is_club_admin_or_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.rounds r WHERE r.id = round_players.round_id AND r.is_public = true
    )
  );

CREATE POLICY "round_players_insert_participant_or_admin"
  ON public.round_players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    player_id = auth.uid()
    OR public.is_participant_in_round(round_id)
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "round_players_update_participant_or_admin"
  ON public.round_players
  FOR UPDATE
  TO authenticated
  USING (
    player_id = auth.uid()
    OR public.is_club_admin_or_superadmin()
  )
  WITH CHECK (
    player_id = auth.uid()
    OR public.is_club_admin_or_superadmin()
  );

CREATE POLICY "round_players_delete_creator_or_admin"
  ON public.round_players
  FOR DELETE
  TO authenticated
  USING (
    player_id = auth.uid()
    OR public.is_club_admin_or_superadmin()
  );

-- 3. Políticas para public.hole_scores (escritura restringida estrictamente al propio player_id = auth.uid() o rol administrativo)
CREATE POLICY "hole_scores_select_visible"
  ON public.hole_scores
  FOR SELECT
  TO authenticated
  USING (
    player_id = auth.uid()
    OR public.is_participant_in_round(round_id)
    OR public.is_club_admin_or_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.rounds r WHERE r.id = hole_scores.round_id AND r.is_public = true
    )
  );

CREATE POLICY "hole_scores_insert_active_round_owner_or_admin"
  ON public.hole_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_club_admin_or_superadmin()
    OR (
      player_id = auth.uid()
      AND public.is_participant_in_round(round_id)
      AND EXISTS (
        SELECT 1 FROM public.rounds r
        WHERE r.id = hole_scores.round_id AND r.status = 'in_progress'
      )
    )
  );

CREATE POLICY "hole_scores_update_active_round_owner_or_admin"
  ON public.hole_scores
  FOR UPDATE
  TO authenticated
  USING (
    public.is_club_admin_or_superadmin()
    OR (
      player_id = auth.uid()
      AND public.is_participant_in_round(round_id)
      AND EXISTS (
        SELECT 1 FROM public.rounds r
        WHERE r.id = hole_scores.round_id AND r.status = 'in_progress'
      )
    )
  )
  WITH CHECK (
    public.is_club_admin_or_superadmin()
    OR (
      player_id = auth.uid()
      AND public.is_participant_in_round(round_id)
      AND EXISTS (
        SELECT 1 FROM public.rounds r
        WHERE r.id = hole_scores.round_id AND r.status = 'in_progress'
      )
    )
  );

CREATE POLICY "hole_scores_delete_admin_or_owner_in_progress"
  ON public.hole_scores
  FOR DELETE
  TO authenticated
  USING (
    public.is_club_admin_or_superadmin()
    OR (
      player_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.rounds r
        WHERE r.id = hole_scores.round_id AND r.status = 'in_progress'
      )
    )
  );

-- Trigger de integridad en public.hole_scores para impedir cambiar player_id, round_id o hole_number en un UPDATE
CREATE OR REPLACE FUNCTION public.prevent_hole_score_identity_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.player_id <> NEW.player_id OR OLD.round_id <> NEW.round_id OR OLD.hole_number <> NEW.hole_number THEN
    RAISE EXCEPTION 'No se permite modificar player_id, round_id ni hole_number de un golpe existente.'
      USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hole_scores_immutable_identity ON public.hole_scores;
CREATE TRIGGER trg_hole_scores_immutable_identity
  BEFORE UPDATE ON public.hole_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_hole_score_identity_mutation();

-- <<< FIN MIGRACIÓN: 20261027000003_scorecards_and_stats.sql

-- >>> INICIO MIGRACIÓN: 20261027000004_tournaments_bookings_events.sql
-- ============================================================================
-- MIGRACIÓN 04: Torneos, Resultados, Calendario de Partidos, Reservas (Tee Times) y Eventos Especiales
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_status') THEN
    CREATE TYPE public.tournament_status AS ENUM ('upcoming', 'registration_open', 'in_progress', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE public.booking_status AS ENUM ('confirmed', 'cancelled', 'completed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rsvp_status') THEN
    CREATE TYPE public.rsvp_status AS ENUM ('attending', 'waitlist', 'cancelled');
  END IF;
END
$$;

-- ============================================================================
-- 1. TORNEOS Y RESULTADOS OFICIALES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  tournament_date DATE NOT NULL,
  scoring_format public.scoring_format NOT NULL DEFAULT 'stableford',
  status public.tournament_status NOT NULL DEFAULT 'registration_open',
  max_players INT NOT NULL DEFAULT 80 CHECK (max_players > 0),
  entry_fee_eur NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  handicap_at_registration NUMERIC(4, 1) NOT NULL,
  tee_time TIME,
  starting_hole INT DEFAULT 1 CHECK (starting_hole BETWEEN 1 AND 18),
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'waitlist', 'withdrawn')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  round_id UUID REFERENCES public.rounds(id) ON DELETE SET NULL,
  position INT NOT NULL CHECK (position >= 1),
  gross_strokes INT,
  net_strokes INT,
  stableford_points INT,
  category TEXT NOT NULL DEFAULT 'General',
  is_official BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, player_id, category)
);

-- ============================================================================
-- 2. CALENDARIO DE PARTIDOS / SALIDAS ABIERTAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.matches_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  match_date DATE NOT NULL,
  tee_time TIME NOT NULL,
  format public.scoring_format NOT NULL DEFAULT 'stableford',
  min_handicap NUMERIC(4, 1) DEFAULT -10.0,
  max_handicap NUMERIC(4, 1) DEFAULT 36.0,
  max_players INT NOT NULL DEFAULT 4 CHECK (max_players BETWEEN 2 AND 4),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. RESERVAS DE TEE TIMES (SALIDAS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tee_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  max_players INT NOT NULL DEFAULT 4 CHECK (max_players BETWEEN 1 AND 4),
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  block_reason TEXT,
  price_eur NUMERIC(6, 2) NOT NULL DEFAULT 45.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, slot_date, slot_time)
);

ALTER TABLE public.tee_time_slots
  ADD COLUMN IF NOT EXISTS price_eur NUMERIC(6, 2) NOT NULL DEFAULT 45.00;

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.tee_time_slots(id) ON DELETE CASCADE,
  booked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  players_count INT NOT NULL DEFAULT 1 CHECK (players_count BETWEEN 1 AND 4),
  buggy_requested BOOLEAN NOT NULL DEFAULT false,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. EVENTOS ESPECIALES DEL CLUB
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.special_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 100 CHECK (capacity > 0),
  price_eur NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.special_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guests_count INT NOT NULL DEFAULT 0 CHECK (guests_count BETWEEN 0 AND 3),
  status public.rsvp_status NOT NULL DEFAULT 'attending',
  dietary_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- ============================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================================
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tee_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Torneos: lectura todos los autenticados; creación/edición solo club_admin/superadmin
CREATE POLICY "tournaments_select_authenticated"
  ON public.tournaments FOR SELECT TO authenticated USING (true);

CREATE POLICY "tournaments_write_admin_only"
  ON public.tournaments FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

-- Inscripciones a torneos: lectura todos; cada jugador gestiona su inscripción o admin
CREATE POLICY "tournament_registrations_select_authenticated"
  ON public.tournament_registrations FOR SELECT TO authenticated USING (true);

CREATE POLICY "tournament_registrations_insert_self_or_admin"
  ON public.tournament_registrations FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "tournament_registrations_update_self_or_admin"
  ON public.tournament_registrations FOR UPDATE TO authenticated
  USING (player_id = auth.uid() OR public.is_club_admin_or_superadmin())
  WITH CHECK (player_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "tournament_registrations_delete_self_or_admin"
  ON public.tournament_registrations FOR DELETE TO authenticated
  USING (player_id = auth.uid() OR public.is_club_admin_or_superadmin());

-- Resultados de torneos: lectura todos; publicación/edición exclusiva de club_admin/superadmin
CREATE POLICY "tournament_results_select_authenticated"
  ON public.tournament_results FOR SELECT TO authenticated USING (true);

CREATE POLICY "tournament_results_write_admin_only"
  ON public.tournament_results FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

-- Calendario de partidos: lectura todos; organizador o admin modifica
CREATE POLICY "matches_calendar_select_authenticated"
  ON public.matches_calendar FOR SELECT TO authenticated USING (true);

CREATE POLICY "matches_calendar_insert_organizer_or_admin"
  ON public.matches_calendar FOR INSERT TO authenticated
  WITH CHECK (organizer_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "matches_calendar_update_organizer_or_admin"
  ON public.matches_calendar FOR UPDATE TO authenticated
  USING (organizer_id = auth.uid() OR public.is_club_admin_or_superadmin())
  WITH CHECK (organizer_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "matches_calendar_delete_organizer_or_admin"
  ON public.matches_calendar FOR DELETE TO authenticated
  USING (organizer_id = auth.uid() OR public.is_club_admin_or_superadmin());

-- Tee Time Slots: lectura todos; gestión exclusiva de club_admin/superadmin
CREATE POLICY "tee_time_slots_select_authenticated"
  ON public.tee_time_slots FOR SELECT TO authenticated USING (true);

CREATE POLICY "tee_time_slots_write_admin_only"
  ON public.tee_time_slots FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

-- Bookings: lectura autenticados; creación/modificación por titular de la reserva o admin
CREATE POLICY "bookings_select_authenticated"
  ON public.bookings FOR SELECT TO authenticated USING (true);

CREATE POLICY "bookings_insert_owner_or_admin"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (booked_by = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "bookings_update_owner_or_admin"
  ON public.bookings FOR UPDATE TO authenticated
  USING (booked_by = auth.uid() OR public.is_club_admin_or_superadmin())
  WITH CHECK (booked_by = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "bookings_delete_owner_or_admin"
  ON public.bookings FOR DELETE TO authenticated
  USING (booked_by = auth.uid() OR public.is_club_admin_or_superadmin());

-- Booking Players: lectura autenticados; escritura por titular de la reserva o admin
CREATE POLICY "booking_players_select_authenticated"
  ON public.booking_players FOR SELECT TO authenticated USING (true);

CREATE POLICY "booking_players_write_owner_or_admin"
  ON public.booking_players FOR ALL TO authenticated
  USING (
    public.is_club_admin_or_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_players.booking_id AND b.booked_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_club_admin_or_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_players.booking_id AND b.booked_by = auth.uid()
    )
  );

-- Eventos Especiales: lectura eventos publicados (o todos para admin); escritura admin
CREATE POLICY "special_events_select_published_or_admin"
  ON public.special_events FOR SELECT TO authenticated
  USING (is_published = true OR public.is_club_admin_or_superadmin());

CREATE POLICY "special_events_write_admin_only"
  ON public.special_events FOR ALL TO authenticated
  USING (public.is_club_admin_or_superadmin())
  WITH CHECK (public.is_club_admin_or_superadmin());

-- Confirmaciones de asistencia (event_rsvps): cada socio gestiona su RSVP
CREATE POLICY "event_rsvps_select_authenticated"
  ON public.event_rsvps FOR SELECT TO authenticated USING (true);

CREATE POLICY "event_rsvps_insert_self_or_admin"
  ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "event_rsvps_update_self_or_admin"
  ON public.event_rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_club_admin_or_superadmin())
  WITH CHECK (user_id = auth.uid() OR public.is_club_admin_or_superadmin());

CREATE POLICY "event_rsvps_delete_self_or_admin"
  ON public.event_rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_club_admin_or_superadmin());

-- ============================================================================
-- 5. VALIDACIÓN ATÓMICA DE CUPO Y AFORO EN SERVIDOR (TRIGGERS CON FOR UPDATE)
-- Evita condiciones de carrera cuando solicitudes concurrentes intentan reservar
-- la misma salida (tee_time_slots) o confirmar asistencia a un evento (special_events).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_tee_time_slot_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_players INT;
  v_is_blocked BOOLEAN;
  v_current_booked INT;
  v_duplicate_exists BOOLEAN;
BEGIN
  IF NEW.players_count < 1 OR NEW.players_count > 4 THEN
    RAISE EXCEPTION 'El número de jugadores por reserva debe estar entre 1 y 4.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'confirmed' THEN
    -- Bloqueo pesimista sobre la franja para serializar inserciones concurrentes
    SELECT max_players, is_blocked
      INTO v_max_players, v_is_blocked
      FROM public.tee_time_slots
      WHERE id = NEW.slot_id
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La franja de salida seleccionada no existe.'
        USING ERRCODE = '23503';
    END IF;

    IF v_is_blocked THEN
      RAISE EXCEPTION 'Esta franja horaria está bloqueada.'
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.bookings
      WHERE slot_id = NEW.slot_id
        AND booked_by = NEW.booked_by
        AND status = 'confirmed'
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) INTO v_duplicate_exists;

    IF v_duplicate_exists THEN
      RAISE EXCEPTION 'El socio ya tiene una reserva confirmada en esta franja.'
        USING ERRCODE = '23505';
    END IF;

    SELECT COALESCE(SUM(players_count), 0)
      INTO v_current_booked
      FROM public.bookings
      WHERE slot_id = NEW.slot_id
        AND status = 'confirmed'
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF v_current_booked + NEW.players_count > v_max_players THEN
      RAISE EXCEPTION 'Cupo insuficiente en la salida seleccionada: plazas ocupadas %, solicitadas %, máximo %.',
        v_current_booked, NEW.players_count, v_max_players
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_enforce_slot_capacity ON public.bookings;
CREATE TRIGGER trg_bookings_enforce_slot_capacity
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tee_time_slot_capacity();

CREATE OR REPLACE FUNCTION public.enforce_event_rsvp_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INT;
  v_current_attending INT;
BEGIN
  IF NEW.guests_count < 0 OR NEW.guests_count > 3 THEN
    RAISE EXCEPTION 'El número de acompañantes debe estar entre 0 y 3.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'attending' THEN
    -- Bloqueo pesimista sobre el evento para serializar confirmaciones concurrentes
    SELECT capacity
      INTO v_capacity
      FROM public.special_events
      WHERE id = NEW.event_id
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El evento seleccionado no existe.'
        USING ERRCODE = '23503';
    END IF;

    SELECT COALESCE(SUM(1 + guests_count), 0)
      INTO v_current_attending
      FROM public.event_rsvps
      WHERE event_id = NEW.event_id
        AND status = 'attending'
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF v_current_attending + 1 + NEW.guests_count > v_capacity THEN
      -- Si supera el aforo disponible en servidor, pasa atómicamente a lista de espera
      NEW.status := 'waitlist';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_rsvps_enforce_capacity ON public.event_rsvps;
CREATE TRIGGER trg_event_rsvps_enforce_capacity
  BEFORE INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_rsvp_capacity();

-- <<< FIN MIGRACIÓN: 20261027000004_tournaments_bookings_events.sql

-- >>> INICIO MIGRACIÓN: 20261027000005_social_chat_news_push.sql
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

-- <<< FIN MIGRACIÓN: 20261027000005_social_chat_news_push.sql

-- >>> INICIO DATOS SEMILLA: seed.sql
-- ============================================================================
-- BIRDIE — Datos Semilla (seed.sql) para Desarrollo Local y Staging
-- ============================================================================

-- 1. Campo principal del club (18 hoyos, Par 72)
INSERT INTO public.courses (
  id, external_golf_api_id, name, club_name, city, country, holes_count, par_total,
  latitude, longitude, address, phone, website, is_home_course, last_synced_at
) VALUES (
  '11111111-1111-1111-1111-111111111101',
  'golfapi_course_1024',
  'Recorrido Championship 18 Hoyos',
  'Real Club de Golf Valle Verde',
  'Madrid',
  'España',
  18,
  72,
  40.468200,
  -3.781500,
  'Carretera del Monte km 4.5, Madrid',
  '+34 910 000 100',
  'https://rcgvalleverde.es',
  true,
  now()
) ON CONFLICT (id) DO NOTHING;

-- 2. Barras de salida (Tees)
INSERT INTO public.course_tees (
  id, course_id, name, color_hex, gender, course_rating, slope_rating, total_distance_meters
) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'Blancas', '#FFFFFF', 'men', 73.2, 134, 6340),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'Amarillas', '#FACC15', 'men', 71.5, 128, 6020),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'Azules', '#3B82F6', 'women', 73.8, 131, 5480),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', 'Rojas', '#EF4444', 'women', 71.1, 124, 5140)
ON CONFLICT (course_id, name, gender) DO NOTHING;

-- 3. Los 18 Hoyos con Pares, Handicap Index (Stroke Index) y Coordenadas GPS de Green (Frente / Centro / Fondo)
INSERT INTO public.course_holes (
  course_id, hole_number, par, stroke_index,
  distance_white_meters, distance_yellow_meters, distance_blue_meters, distance_red_meters,
  green_front_lat, green_front_lng, green_center_lat, green_center_lng, green_back_lat, green_back_lng,
  tee_lat, tee_lng
) VALUES
  ('11111111-1111-1111-1111-111111111101', 1,  4, 11, 368, 352, 320, 305, 40.469110, -3.780210, 40.469220, -3.780150, 40.469330, -3.780090, 40.468200, -3.781500),
  ('11111111-1111-1111-1111-111111111101', 2,  5,  3, 510, 492, 455, 430, 40.470410, -3.778810, 40.470520, -3.778720, 40.470630, -3.778630, 40.469450, -3.779950),
  ('11111111-1111-1111-1111-111111111101', 3,  3, 17, 175, 162, 145, 130, 40.471100, -3.777900, 40.471200, -3.777820, 40.471300, -3.777740, 40.470700, -3.778500),
  ('11111111-1111-1111-1111-111111111101', 4,  4,  1, 415, 398, 360, 340, 40.472300, -3.779100, 40.472410, -3.779200, 40.472520, -3.779300, 40.471400, -3.777700),
  ('11111111-1111-1111-1111-111111111101', 5,  4,  9, 372, 358, 325, 302, 40.473100, -3.780500, 40.473210, -3.780610, 40.473320, -3.780720, 40.472600, -3.779400),
  ('11111111-1111-1111-1111-111111111101', 6,  3, 15, 188, 174, 152, 138, 40.472500, -3.781800, 40.472420, -3.781910, 40.472340, -3.782020, 40.473300, -3.780800),
  ('11111111-1111-1111-1111-111111111101', 7,  5,  5, 525, 504, 468, 442, 40.470900, -3.783100, 40.470780, -3.783210, 40.470660, -3.783320, 40.472200, -3.782100),
  ('11111111-1111-1111-1111-111111111101', 8,  4, 13, 348, 332, 300, 282, 40.469600, -3.782600, 40.469490, -3.782510, 40.469380, -3.782420, 40.470500, -3.783300),
  ('11111111-1111-1111-1111-111111111101', 9,  4,  7, 392, 376, 342, 318, 40.468500, -3.781900, 40.468400, -3.781800, 40.468300, -3.781700, 40.469300, -3.782300),
  ('11111111-1111-1111-1111-111111111101', 10, 4, 10, 365, 349, 316, 296, 40.467300, -3.782400, 40.467190, -3.782510, 40.467080, -3.782620, 40.468100, -3.781700),
  ('11111111-1111-1111-1111-111111111101', 11, 3, 18, 162, 148, 132, 118, 40.466400, -3.783200, 40.466310, -3.783300, 40.466220, -3.783400, 40.467000, -3.782700),
  ('11111111-1111-1111-1111-111111111101', 12, 5,  4, 518, 498, 458, 434, 40.465100, -3.781900, 40.464990, -3.781790, 40.464880, -3.781680, 40.466100, -3.783400),
  ('11111111-1111-1111-1111-111111111101', 13, 4,  2, 412, 395, 358, 336, 40.465800, -3.780400, 40.465910, -3.780290, 40.466020, -3.780180, 40.464900, -3.781600),
  ('11111111-1111-1111-1111-111111111101', 14, 4, 14, 344, 329, 298, 278, 40.466800, -3.779400, 40.466910, -3.779300, 40.467020, -3.779200, 40.466100, -3.780100),
  ('11111111-1111-1111-1111-111111111101', 15, 3, 16, 179, 166, 146, 131, 40.467600, -3.778600, 40.467700, -3.778510, 40.467800, -3.778420, 40.467100, -3.779100),
  ('11111111-1111-1111-1111-111111111101', 16, 5,  6, 498, 480, 444, 420, 40.468900, -3.777500, 40.469010, -3.777610, 40.469120, -3.777720, 40.467900, -3.778400),
  ('11111111-1111-1111-1111-111111111101', 17, 4, 12, 358, 342, 310, 290, 40.468400, -3.779200, 40.468310, -3.779310, 40.468220, -3.779420, 40.469100, -3.777800),
  ('11111111-1111-1111-1111-111111111101', 18, 4,  8, 396, 378, 344, 322, 40.468150, -3.781100, 40.468180, -3.781220, 40.468210, -3.781340, 40.468200, -3.779500)
ON CONFLICT (course_id, hole_number) DO NOTHING;

-- 4. Páginas de Información de Interés del Club
INSERT INTO public.club_info_pages (slug, title, category, content_markdown, display_order) VALUES
  ('reglas-locales', 'Reglas Locales y Etiqueta', 'normativa', '1. **Reparación de piques y chuletas**: Obligatorio en todo el recorrido.\n2. **Ritmo de juego**: Tiempo máximo para 18 hoyos de 4 horas y 15 minutos.\n3. **Caminos y senderos**: Alivio sin penalidad según Regla 16.1.', 1),
  ('horarios-y-tarifas', 'Horarios de Casa Club y Green Fees', 'servicios', '- **Casa Club**: 07:30 a 21:30 (Martes a Domingo).\n- **Campo de Prácticas**: 08:00 a 20:00.\n- **Green Fee Laborables Socios**: Incluido en cuota.\n- **Alquiler de Buggy**: 28 € (18 hoyos).', 2),
  ('correspondencias', 'Clubes con Correspondencia', 'correspondencias', 'Los socios activos disfrutan de hasta 10 salidas anuales con tarifa reducida en nuestros 18 clubes asociados nacionales.', 3)
ON CONFLICT (slug) DO NOTHING;

-- 5. Noticias iniciales del Club
INSERT INTO public.news_articles (title, slug, summary, content, is_pinned, is_published) VALUES
  ('Pinchado hueco de greens y preparación del Torneo de Otoño', 'pinchado-greens-torneo-otono', 'Trabajos de mantenimiento programados por el equipo de Greenkeeping para dejar los greens a 10.5 pies en el Stimpmeter.', 'El equipo de mantenimiento realizará labores de aireación ligera durante el lunes y martes próximos. El recorrido estará al 100% para el Torneo Social del sábado.', true, true),
  ('Abierta la inscripción al Campeonato Social Match Play', 'inscripcion-campeonato-social-match-play', 'Inscripciones abiertas desde la app en modalidad Hándicap Individual.', 'Ya puedes apuntarte desde la sección de Torneos de la aplicación antes del jueves a las 18:00.', false, true)
ON CONFLICT (slug) DO NOTHING;

-- 6. Torneo inicial y Evento Especial
INSERT INTO public.tournaments (
  id, course_id, title, description, tournament_date, scoring_format, status, max_players, entry_fee_eur
) VALUES (
  '33333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111101',
  'Gran Premio de Otoño — Copa Presidente',
  'Torneo oficial 18 hoyos Individual Stableford con entrega de premios y cóctel en la Casa Club.',
  CURRENT_DATE + INTERVAL '7 days',
  'stableford',
  'registration_open',
  88,
  25.00
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.special_events (
  id, title, description, event_date, location, capacity, price_eur, is_published
) VALUES
  (
    '55555555-5555-4555-8555-000000000001',
    'Cena Anual de Gala y Entrega de Trofeos',
    'Velada social de cierre de temporada con entrega de premios de la Orden de Mérito del club.',
    now() + INTERVAL '14 days',
    'Salón Principal — Casa Club',
    80,
    65.00,
    true
  ),
  (
    '55555555-5555-4555-8555-000000000002',
    'Masterclass de Juego Corto y Salidas de Bunker',
    'Clínic intensivo de 2 horas con el Head Pro del club enfocado en control de spin en wedges de 30-70 metros y recuperación desde arena compacta.',
    now() + INTERVAL '7 days',
    'Zona de Approach y Putting Green Sur',
    8,
    25.00,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- 7. Franjas de salida iniciales (Tee Time Slots) con UUIDs RFC-4122 reales
INSERT INTO public.tee_time_slots (
  id, course_id, slot_date, slot_time, max_players, is_blocked, price_eur
) VALUES
  ('33333333-3333-4333-8333-000000000830', '11111111-1111-1111-1111-111111111101', '2026-11-01', '08:30', 4, false, 45.00),
  ('33333333-3333-4333-8333-000000000840', '11111111-1111-1111-1111-111111111101', '2026-11-01', '08:40', 4, false, 45.00),
  ('33333333-3333-4333-8333-000000000850', '11111111-1111-1111-1111-111111111101', '2026-11-01', '08:50', 4, false, 55.00),
  ('33333333-3333-4333-8333-000000000900', '11111111-1111-1111-1111-111111111101', '2026-11-01', '09:00', 4, true,  55.00),
  ('33333333-3333-4333-8333-000000000930', '11111111-1111-1111-1111-111111111101', '2026-11-02', '09:30', 4, false, 60.00)
ON CONFLICT (course_id, slot_date, slot_time) DO NOTHING;

-- <<< FIN DATOS SEMILLA: seed.sql
