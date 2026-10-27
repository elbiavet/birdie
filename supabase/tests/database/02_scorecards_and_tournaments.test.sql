-- ============================================================================
-- TEST pgTAP 02: Marcador (Rondas, Golpes por Hoyo) y Torneos (Resultados Oficiales)
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(8);

-- 1. Preparar usuarios y datos de prueba
INSERT INTO auth.users (id, email, raw_app_meta_data)
VALUES
  ('bbbb0000-0000-0000-0000-000000000001', 'jugador_partida@club.es', '{"role": "player"}'::jsonb),
  ('bbbb0000-0000-0000-0000-000000000002', 'jugador_externo@club.es', '{"role": "player"}'::jsonb),
  ('bbbb0000-0000-0000-0000-000000000003', 'comite@club.es',          '{"role": "club_admin"}'::jsonb);

INSERT INTO public.profiles (id, email, full_name, handicap_index, role)
VALUES
  ('bbbb0000-0000-0000-0000-000000000001', 'jugador_partida@club.es', 'Jugador Partida', 12.0, 'player'),
  ('bbbb0000-0000-0000-0000-000000000002', 'jugador_externo@club.es', 'Jugador Externo', 18.0, 'player'),
  ('bbbb0000-0000-0000-0000-000000000003', 'comite@club.es',          'Comité Competición', 5.0, 'club_admin');

INSERT INTO public.courses (id, name, club_name, holes_count, par_total)
VALUES ('cccc0000-0000-0000-0000-000000000001', 'Campo Test RLS', 'Club Test', 18, 72);

INSERT INTO public.rounds (id, course_id, created_by, status, is_public)
VALUES ('dddd0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 'in_progress', true);

INSERT INTO public.round_players (round_id, player_id, playing_handicap)
VALUES ('dddd0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 12);

INSERT INTO public.tournaments (id, course_id, title, tournament_date, status)
VALUES ('eeee0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 'Torneo Oficial RLS', CURRENT_DATE, 'in_progress');

-- ============================================================================
-- ESCENARIO A: Jugador participante en la partida ('jugador_partida')
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bbbb0000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "bbbb0000-0000-0000-0000-000000000001", "role": "authenticated", "app_metadata": {"role": "player"}}';

-- Test 1: El jugador de la partida puede anotar su golpe en el hoyo 1 mientras la ronda está 'in_progress'
SELECT lives_ok(
  $$INSERT INTO public.hole_scores (round_id, player_id, hole_number, strokes, putts, fairway_hit, green_in_regulation, stableford_points)
    VALUES ('dddd0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 1, 4, 2, true, true, 2)$$,
  'El jugador participante puede insertar sus golpes en una ronda activa'
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

-- ============================================================================
-- ESCENARIO B: Jugador ajeno a la partida ('jugador_externo')
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'bbbb0000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "bbbb0000-0000-0000-0000-000000000002", "role": "authenticated", "app_metadata": {"role": "player"}}';

-- Test 4: El jugador externo puede VER los golpes porque la ronda es pública (Livescoring)
SELECT is(
  (SELECT count(*)::int FROM public.hole_scores WHERE round_id = 'dddd0000-0000-0000-0000-000000000001'),
  1,
  'Un socio puede ver los golpes de una ronda pública (livescoring)'
);

-- Test 5: El jugador externo NO puede insertar golpes en una partida en la que no participa
SELECT throws_ok(
  $$INSERT INTO public.hole_scores (round_id, player_id, hole_number, strokes, putts, green_in_regulation, stableford_points)
    VALUES ('dddd0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 2, 5, 2, false, 1)$$,
  '42501',
  NULL,
  'Un jugador ajeno a la partida NO puede insertar golpes en ella'
);

-- Test 6: El jugador externo NO puede modificar golpes existentes de otra partida
UPDATE public.hole_scores SET strokes = 9 WHERE round_id = 'dddd0000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT strokes FROM public.hole_scores WHERE round_id = 'dddd0000-0000-0000-0000-000000000001' AND hole_number = 1),
  4,
  'Un jugador ajeno a la partida NO puede alterar los golpes registrados'
);

-- ============================================================================
-- ESCENARIO C: Comité / Administrador del Club ('club_admin')
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'bbbb0000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub": "bbbb0000-0000-0000-0000-000000000003", "role": "authenticated", "app_metadata": {"role": "club_admin"}}';

-- Test 7: El club_admin SÍ puede publicar resultados oficiales del torneo
SELECT lives_ok(
  $$INSERT INTO public.tournament_results (tournament_id, player_id, round_id, position, gross_strokes, net_strokes, stableford_points)
    VALUES ('eeee0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-000000000001', 1, 82, 70, 38)$$,
  'El club_admin puede publicar resultados oficiales en tournament_results'
);

-- Test 8: El club_admin puede cerrar el torneo
SELECT lives_ok(
  $$UPDATE public.tournaments SET status = 'completed' WHERE id = 'eeee0000-0000-0000-0000-000000000001'$$,
  'El club_admin puede actualizar el estado de un torneo a completed'
);

SELECT * FROM finish();
ROLLBACK;
