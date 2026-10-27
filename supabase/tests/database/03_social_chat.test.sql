-- ============================================================================
-- TEST pgTAP 03: Privacidad del Chat con el Administrador, Foro, Noticias e Info
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(9);

-- 1. Crear usuarios de prueba
INSERT INTO auth.users (id, email, raw_app_meta_data)
VALUES
  ('ffff0000-0000-0000-0000-000000000001', 'socio_a@club.es', '{"role": "player"}'::jsonb),
  ('ffff0000-0000-0000-0000-000000000002', 'socio_b@club.es', '{"role": "player"}'::jsonb),
  ('ffff0000-0000-0000-0000-000000000003', 'admin@club.es',   '{"role": "club_admin"}'::jsonb);

INSERT INTO public.profiles (id, email, full_name, handicap_index, role)
VALUES
  ('ffff0000-0000-0000-0000-000000000001', 'socio_a@club.es', 'Socio A', 15.4, 'player'),
  ('ffff0000-0000-0000-0000-000000000002', 'socio_b@club.es', 'Socio B', 21.0, 'player'),
  ('ffff0000-0000-0000-0000-000000000003', 'admin@club.es',   'Gerente del Club', 6.0, 'club_admin');

-- Crear un hilo bloqueado en el foro
INSERT INTO public.forum_threads (id, author_id, category, title, body, is_locked)
VALUES (
  '99990000-0000-0000-0000-000000000001',
  'ffff0000-0000-0000-0000-000000000003',
  'rules',
  'Comunicado Oficial Comité',
  'Este hilo es informativo y está cerrado a respuestas.',
  true
);

-- ============================================================================
-- ESCENARIO A: Socio A abre sala de chat con el administrador y envía un mensaje
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'ffff0000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "ffff0000-0000-0000-0000-000000000001", "role": "authenticated", "app_metadata": {"role": "player"}}';

-- Test 1: Socio A puede crear su propia sala de chat con el administrador
SELECT lives_ok(
  $$INSERT INTO public.admin_chat_rooms (id, player_id, subject)
    VALUES ('88880000-0000-0000-0000-000000000001', 'ffff0000-0000-0000-0000-000000000001', 'Duda sobre recibo trimestral')$$,
  'Socio A puede abrir su propia sala en admin_chat_rooms'
);

-- Test 2: Socio A puede enviar un mensaje dentro de su sala
SELECT lives_ok(
  $$INSERT INTO public.admin_chat_messages (room_id, sender_id, body)
    VALUES ('88880000-0000-0000-0000-000000000001', 'ffff0000-0000-0000-0000-000000000001', 'Hola administración, tengo una consulta.')$$,
  'Socio A puede enviar mensajes en su propia sala de chat'
);

-- ============================================================================
-- ESCENARIO B: Socio B intenta espiar o escribir en el chat privado de Socio A
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'ffff0000-0000-0000-0000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub": "ffff0000-0000-0000-0000-000000000002", "role": "authenticated", "app_metadata": {"role": "player"}}';

-- Test 3: Socio B NO puede ver la sala de chat de Socio A
SELECT is_empty(
  $$SELECT * FROM public.admin_chat_rooms WHERE id = '88880000-0000-0000-0000-000000000001'$$,
  'Socio B NO puede ver la sala de admin_chat_rooms de Socio A'
);

-- Test 4: Socio B NO puede leer los mensajes privados entre Socio A y el administrador
SELECT is_empty(
  $$SELECT * FROM public.admin_chat_messages WHERE room_id = '88880000-0000-0000-0000-000000000001'$$,
  'Socio B NO puede leer los mensajes de admin_chat_messages de Socio A'
);

-- Test 5: Socio B NO puede inyectar mensajes en la sala de Socio A
SELECT throws_ok(
  $$INSERT INTO public.admin_chat_messages (room_id, sender_id, body)
    VALUES ('88880000-0000-0000-0000-000000000001', 'ffff0000-0000-0000-0000-000000000002', 'Mensaje intruso')$$,
  '42501',
  NULL,
  'Socio B recibe denegación RLS al intentar escribir en la sala de Socio A'
);

-- Test 6: Socio B NO puede publicar noticias oficiales del club
SELECT throws_ok(
  $$INSERT INTO public.news_articles (title, slug, summary, content)
    VALUES ('Noticia Falsa', 'noticia-falsa', 'Resumen', 'Contenido')$$,
  '42501',
  NULL,
  'Un player NO puede insertar artículos en news_articles'
);

-- Test 7: Socio B NO puede responder en un hilo del foro bloqueado (is_locked = true)
SELECT throws_ok(
  $$INSERT INTO public.forum_posts (thread_id, author_id, body)
    VALUES ('99990000-0000-0000-0000-000000000001', 'ffff0000-0000-0000-0000-000000000002', 'Respuesta en hilo cerrado')$$,
  '42501',
  NULL,
  'Un player NO puede publicar respuestas en un hilo del foro bloqueado'
);

-- ============================================================================
-- ESCENARIO C: El Administrador del Club ('club_admin') lee y responde a Socio A
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'ffff0000-0000-0000-0000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub": "ffff0000-0000-0000-0000-000000000003", "role": "authenticated", "app_metadata": {"role": "club_admin"}}';

-- Test 8: El club_admin puede leer los mensajes de la sala de Socio A
SELECT is(
  (SELECT count(*)::int FROM public.admin_chat_messages WHERE room_id = '88880000-0000-0000-0000-000000000001'),
  1,
  'El club_admin puede leer los mensajes del chat con Socio A'
);

-- Test 9: El club_admin puede responder en la sala de Socio A
SELECT lives_ok(
  $$INSERT INTO public.admin_chat_messages (room_id, sender_id, body)
    VALUES ('88880000-0000-0000-0000-000000000001', 'ffff0000-0000-0000-0000-000000000003', 'Hola Socio A, te ayudamos enseguida.')$$,
  'El club_admin puede responder en la sala de chat de Socio A'
);

SELECT * FROM finish();
ROLLBACK;
