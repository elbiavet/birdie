-- ============================================================================
-- TEST pgTAP 01: Seguridad RLS de Roles (player, club_admin, superadmin), Perfiles y Push Tokens
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(10);

-- 1. Crear usuarios de prueba en auth.users y public.profiles
INSERT INTO auth.users (id, email, raw_app_meta_data)
VALUES
  ('aaaa0000-0000-0000-0000-000000000001', 'player1@club.es', '{"role": "player"}'::jsonb),
  ('aaaa0000-0000-0000-0000-000000000002', 'player2@club.es', '{"role": "player"}'::jsonb),
  ('aaaa0000-0000-0000-0000-000000000003', 'admin@club.es',   '{"role": "club_admin"}'::jsonb),
  ('aaaa0000-0000-0000-0000-000000000004', 'super@birdie.es', '{"role": "superadmin"}'::jsonb);

INSERT INTO public.profiles (id, email, full_name, handicap_index, role, is_directory_visible)
VALUES
  ('aaaa0000-0000-0000-0000-000000000001', 'player1@club.es', 'Jugador Uno', 14.2, 'player', true),
  ('aaaa0000-0000-0000-0000-000000000002', 'player2@club.es', 'Jugador Oculto', 8.5, 'player', false),
  ('aaaa0000-0000-0000-0000-000000000003', 'admin@club.es',   'Admin del Club', 10.0, 'club_admin', true),
  ('aaaa0000-0000-0000-0000-000000000004', 'super@birdie.es', 'Super Admin', 4.0, 'superadmin', false);

INSERT INTO public.device_push_tokens (user_id, token, platform, device_name)
VALUES
  ('aaaa0000-0000-0000-0000-000000000001', 'fcm_token_player_1', 'android', 'Pixel 9'),
  ('aaaa0000-0000-0000-0000-000000000002', 'apns_token_player_2', 'ios', 'iPhone 16');

-- ============================================================================
-- ESCENARIO A: Autenticado como Jugador Uno (rol = 'player')
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaa0000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "aaaa0000-0000-0000-0000-000000000001", "role": "authenticated", "app_metadata": {"role": "player"}}';

-- Test 1: current_user_role() devuelve 'player'
SELECT is(
  public.current_user_role(),
  'player'::public.user_role,
  'current_user_role() debe identificar al usuario como player'
);

-- Test 2: El jugador solo ve perfiles visibles en el directorio (Jugador Uno y Admin, pero no Jugador Oculto)
SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE id = 'aaaa0000-0000-0000-0000-000000000002'),
  0,
  'Un player no puede ver en el directorio a otro socio con is_directory_visible = false'
);

-- Test 3: El jugador puede ver su propio perfil
SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE id = 'aaaa0000-0000-0000-0000-000000000001'),
  1,
  'Un player siempre puede leer su propio perfil'
);

-- Test 4: Un player NO puede escalar su propio rol a club_admin
SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'club_admin' WHERE id = 'aaaa0000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Permiso denegado: un jugador no puede modificar su propio rol.',
  'Un player debe recibir error si intenta auto-escalar su rol a club_admin'
);

-- Test 5: Un player NO puede leer los tokens push de otro jugador
SELECT is_empty(
  $$SELECT * FROM public.device_push_tokens WHERE user_id = 'aaaa0000-0000-0000-0000-000000000002'$$,
  'Un player no puede leer device_push_tokens de otro socio'
);

-- Test 6: Un player SÍ puede leer sus propios tokens push
SELECT is(
  (SELECT count(*)::int FROM public.device_push_tokens WHERE user_id = 'aaaa0000-0000-0000-0000-000000000001'),
  1,
  'Un player puede leer sus propios device_push_tokens'
);

-- ============================================================================
-- ESCENARIO B: Autenticado como Admin del Club (rol = 'club_admin')
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'aaaa0000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub": "aaaa0000-0000-0000-0000-000000000003", "role": "authenticated", "app_metadata": {"role": "club_admin"}}';

-- Test 7: El club_admin puede ver todos los perfiles aunque tengan is_directory_visible = false
SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE id = 'aaaa0000-0000-0000-0000-000000000002'),
  1,
  'Un club_admin puede consultar perfiles con is_directory_visible = false'
);

-- Test 8: Un club_admin NO puede otorgar el rol superadmin
SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'superadmin' WHERE id = 'aaaa0000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Permiso denegado: solo un superadmin puede otorgar el rol superadmin.',
  'Un club_admin no puede escalar a un usuario a superadmin'
);

-- ============================================================================
-- ESCENARIO C: Autenticado como Superadmin (rol = 'superadmin')
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'aaaa0000-0000-0000-0000-000000000004';
SET LOCAL "request.jwt.claims" = '{"sub": "aaaa0000-0000-0000-0000-000000000004", "role": "authenticated", "app_metadata": {"role": "superadmin"}}';

-- Test 9: is_superadmin() devuelve true
SELECT is(
  public.is_superadmin(),
  true,
  'is_superadmin() debe devolver true para superadmin'
);

-- Test 10: El superadmin puede promover a un usuario a club_admin
SELECT lives_ok(
  $$UPDATE public.profiles SET role = 'club_admin' WHERE id = 'aaaa0000-0000-0000-0000-000000000002'$$,
  'Un superadmin puede actualizar el rol de un usuario a club_admin'
);

SELECT * FROM finish();
ROLLBACK;
