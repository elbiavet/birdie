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
