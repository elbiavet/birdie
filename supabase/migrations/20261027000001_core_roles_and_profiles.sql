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
