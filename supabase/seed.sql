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
