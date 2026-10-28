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

  -- Upsert idempotente de hoyos (UNIQUE (course_id, hole_number))
  IF jsonb_typeof(p_holes) = 'array' AND jsonb_array_length(p_holes) > 0 THEN
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
