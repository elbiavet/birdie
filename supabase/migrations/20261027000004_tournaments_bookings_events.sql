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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, slot_date, slot_time)
);

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
