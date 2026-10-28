-- ============================================================================
-- TEST pgTAP 02: Marcador (Rondas, Golpes por Hoyo), Reservas, Eventos y Torneos
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(14);

-- 1. Preparar usuarios y datos de prueba
INSERT INTO auth.users (id, email, raw_app_meta_data)
VALUES
  ('bbbb0000-0000-0000-0000-000000000001', 'jugador_partida@club.es',   '{"role": "player"}'::jsonb),
  ('bbbb0000-0000-0000-0000-000000000002', 'jugador_externo@club.es',   '{"role": "player"}'::jsonb),
  ('bbbb0000-0000-0000-0000-000000000003', 'comite@club.es',            '{"role": "club_admin"}'::jsonb),
  ('bbbb0000-0000-0000-0000-000000000004', 'jugador_companero@club.es', '{"role": "player"}'::jsonb);

INSERT INTO public.profiles (id, email, full_name, handicap_index, role)
VALUES
  ('bbbb0000-0000-0000-0000-000000000001', 'jugador_partida@club.es',   'Jugador Partida',   12.0, 'player'),
  ('bbbb0000-0000-0000-0000-000000000002', 'jugador_externo@club.es',   'Jugador Externo',   18.0, 'player'),
  ('bbbb0000-0000-0000-0000-000000000003', 'comite@club.es',            'Comité Competición', 5.0, 'club_admin'),
  ('bbbb0000-0000-0000-0000-000000000004', 'jugador_companero@club.es', 'Jugador Compañero', 14.0, 'player');

INSERT INTO public.courses (id, name, club_name, holes_count, par_total)
VALUES ('cccc0000-0000-0000-0000-000000000001', 'Campo Test RLS', 'Club Test', 18, 72);

INSERT INTO public.rounds (id, course_id, created_by, status, is_public)
VALUES ('dddd0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 'in_progress', true);

INSERT INTO public.round_players (round_id, player_id, playing_handicap)
VALUES
  ('dddd0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 12),
  ('dddd0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000004', 14);

INSERT INTO public.tournaments (id, course_id, title, tournament_date, status)
VALUES ('eeee0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 'Torneo Oficial RLS', CURRENT_DATE, 'in_progress');

INSERT INTO public.tee_time_slots (id, course_id, slot_date, slot_time, max_players, is_blocked)
VALUES ('ffff0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', CURRENT_DATE, '09:00', 4, false);

INSERT INTO public.bookings (id, slot_id, booked_by, players_count, status)
VALUES ('ffff0000-0000-0000-0000-000000000002', 'ffff0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 3, 'confirmed');

INSERT INTO public.special_events (id, title, description, event_date, location, capacity)
VALUES ('99990000-0000-0000-0000-000000000001', 'Clínic Aforo Test', 'Prueba aforo atómico', now() + interval '7 days', 'Putting Green', 2);

INSERT INTO public.event_rsvps (event_id, user_id, guests_count, status)
VALUES ('99990000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 1, 'attending');

-- ============================================================================
-- ESCENARIO A: Jugador participante en la partida ('jugador_partida')
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bbbb0000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "bbbb0000-0000-0000-0000-000000000001", "role": "authenticated", "app_metadata": {"role": "player"}}';

-- Test 1: El jugador de la partida puede anotar su propio golpe en el hoyo 1 mientras la ronda está 'in_progress'
SELECT lives_ok(
  $$INSERT INTO public.hole_scores (round_id, player_id, hole_number, strokes, putts, fairway_hit, green_in_regulation, stableford_points)
    VALUES ('dddd0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 1, 4, 2, true, true, 2)$$,
  'El jugador participante puede insertar sus propios golpes en una ronda activa'
);

-- Test 2: El jugador puede inscribirse a sí mismo en un torneo abierto
SELECT lives_ok(
  $$INSERT INTO public.tournament_registrations (tournament_id, player_id, handicap_at_registration)
    VALUES ('eeee0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 12.0)$$,
  'Un player puede inscribirse en un torneo'
);

-- Test 3: Un jugador normal NO puede publicar resultados oficiales de un torneo
SELECT throws_ok(
  $$INSERT INTO public.tournament_results (tournament_id, player_id, position, stableford_points)
    VALUES ('eeee0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 1, 42)$$,
  '42501',
  NULL,
  'Un player NO puede insertar en tournament_results (restringido a club_admin/superadmin)'
);

-- Test 4: El propietario tampoco puede mutar el player_id de su golpe existente para eludir RLS
SELECT throws_ok(
  $$UPDATE public.hole_scores
    SET player_id = 'bbbb0000-0000-0000-0000-000000000004'
    WHERE round_id = 'dddd0000-0000-0000-0000-000000000001' AND hole_number = 1$$,
  '42501',
  NULL,
  'No se permite cambiar player_id en un UPDATE de hole_scores'
);

-- ============================================================================
-- ESCENARIO B: Compañero de la misma partida ('jugador_companero')
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'bbbb0000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claims" = '{"sub": "bbbb0000-0000-0000-0000-000000000004", "role": "authenticated", "app_metadata": {"role": "player"}}';

-- Test 5: Aunque participa en la misma partida, NO puede insertar golpes a nombre de otro jugador
SELECT throws_ok(
  $$INSERT INTO public.hole_scores (round_id, player_id, hole_number, strokes, putts, green_in_regulation, stableford_points)
    VALUES ('dddd0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 2, 5, 2, false, 1)$$,
  '42501',
  NULL,
  'Un compañero de partida NO puede insertar golpes con el player_id de otro jugador'
);

-- Test 6: Trigger atómico en servidor rechaza reserva de Tee Time que supera el cupo restante (3 ocupadas + 2 = 5 > 4)
SELECT throws_ok(
  $$INSERT INTO public.bookings (slot_id, booked_by, players_count, status)
    VALUES ('ffff0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000004', 2, 'confirmed')$$,
  '23514',
  NULL,
  'El trigger trg_bookings_enforce_slot_capacity impide superar el cupo máximo de 4 jugadores en servidor'
);

-- Test 7: Límite de acompañantes en RSVP alineado en BD (0..3): rechaza guests_count = 4
SELECT throws_ok(
  $$INSERT INTO public.event_rsvps (event_id, user_id, guests_count, status)
    VALUES ('99990000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000004', 4, 'attending')$$,
  '23514',
  NULL,
  'event_rsvps rechaza guests_count > 3 conforme al límite unificado 0..3'
);

-- Test 8: El trigger trg_event_rsvps_enforce_capacity asigna automáticamente waitlist cuando el aforo (2) ya está completo
INSERT INTO public.event_rsvps (event_id, user_id, guests_count, status)
VALUES ('99990000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000004', 0, 'attending');

SELECT is(
  (SELECT status::text FROM public.event_rsvps WHERE event_id = '99990000-0000-0000-0000-000000000001' AND user_id = 'bbbb0000-0000-0000-0000-000000000004'),
  'waitlist',
  'El trigger en servidor pasa automáticamente el RSVP a waitlist cuando se alcanza el aforo máximo'
);

-- ============================================================================
-- ESCENARIO C: Jugador ajeno a la partida ('jugador_externo')
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'bbbb0000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "bbbb0000-0000-0000-0000-000000000002", "role": "authenticated", "app_metadata": {"role": "player"}}';

-- Test 9: El jugador externo puede VER los golpes porque la ronda es pública (Livescoring)
SELECT is(
  (SELECT count(*)::int FROM public.hole_scores WHERE round_id = 'dddd0000-0000-0000-0000-000000000001'),
  1,
  'Un socio puede ver los golpes de una ronda pública (livescoring)'
);

-- Test 10: El jugador externo NO puede insertar golpes en una partida en la que no participa
SELECT throws_ok(
  $$INSERT INTO public.hole_scores (round_id, player_id, hole_number, strokes, putts, green_in_regulation, stableford_points)
    VALUES ('dddd0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000002', 2, 5, 2, false, 1)$$,
  '42501',
  NULL,
  'Un jugador ajeno a la partida NO puede insertar golpes en ella'
);

-- Test 11: El jugador externo NO puede modificar golpes existentes de otra partida
UPDATE public.hole_scores SET strokes = 9 WHERE round_id = 'dddd0000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT strokes FROM public.hole_scores WHERE round_id = 'dddd0000-0000-0000-0000-000000000001' AND hole_number = 1),
  4,
  'Un jugador ajeno a la partida NO puede alterar los golpes registrados'
);

-- ============================================================================
-- ESCENARIO D: Comité / Administrador del Club ('club_admin')
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'bbbb0000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub": "bbbb0000-0000-0000-0000-000000000003", "role": "authenticated", "app_metadata": {"role": "club_admin"}}';

-- Test 12: El club_admin SÍ puede publicar resultados oficiales del torneo
SELECT lives_ok(
  $$INSERT INTO public.tournament_results (tournament_id, player_id, round_id, position, gross_strokes, net_strokes, stableford_points)
    VALUES ('eeee0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-000000000001', 1, 82, 70, 38)$$,
  'El club_admin puede publicar resultados oficiales en tournament_results'
);

-- Test 13: El club_admin puede cerrar el torneo
SELECT lives_ok(
  $$UPDATE public.tournaments SET status = 'completed' WHERE id = 'eeee0000-0000-0000-0000-000000000001'$$,
  'El club_admin puede actualizar el estado de un torneo a completed'
);

-- Test 14: sync_golf_course_atomic reemplaza y elimina barras y hoyos obsoletos cuando se vuelve a sincronizar el campo
SELECT public.sync_golf_course_atomic(
  '{"external_golf_api_id": "golfapi_atomic_test", "name": "Campo Atómico", "club_name": "Club Atómico", "holes_count": 9, "par_total": 36}'::jsonb,
  '[{"name": "Blancas", "gender": "men", "course_rating": 72.0, "slope_rating": 130, "total_distance_meters": 3000}, {"name": "Amarillas", "gender": "mixed", "course_rating": 70.0, "slope_rating": 122, "total_distance_meters": 2800}]'::jsonb,
  '[{"hole_number": 1, "par": 4, "stroke_index": 1, "distance_yellow_meters": 350}, {"hole_number": 10, "par": 4, "stroke_index": 2, "distance_yellow_meters": 360}]'::jsonb
);

SELECT public.sync_golf_course_atomic(
  '{"external_golf_api_id": "golfapi_atomic_test", "name": "Campo Atómico", "club_name": "Club Atómico", "holes_count": 9, "par_total": 36}'::jsonb,
  '[{"name": "Amarillas", "gender": "mixed", "course_rating": 70.5, "slope_rating": 124, "total_distance_meters": 2820}]'::jsonb,
  '[{"hole_number": 1, "par": 4, "stroke_index": 1, "distance_yellow_meters": 355}]'::jsonb
);

SELECT is(
  (
    SELECT (
      (SELECT count(*)::int FROM public.course_tees ct JOIN public.courses c ON c.id = ct.course_id WHERE c.external_golf_api_id = 'golfapi_atomic_test') = 1
      AND
      (SELECT count(*)::int FROM public.course_holes ch JOIN public.courses c ON c.id = ch.course_id WHERE c.external_golf_api_id = 'golfapi_atomic_test') = 1
    )
  ),
  true,
  'sync_golf_course_atomic elimina barras (course_tees) y hoyos (course_holes) obsoletos que ya no vienen en el nuevo lote'
);

SELECT * FROM finish();
ROLLBACK;
