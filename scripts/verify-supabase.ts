import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  isValidUuid,
  loadSpecialEvents,
  loadTeeTimeSlots,
  submitCancelTeeTimeBooking,
  submitEventRsvp,
  submitTeeTimeBooking,
} from '../src/lib/competition';

function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const vars: Record<string, string> = {};
  if (!fs.existsSync(envPath)) {
    return vars;
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    vars[key] = val;
  }
  return vars;
}

function buildConsolidatedSql(): string {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const parts: string[] = [
    '-- ============================================================================',
    '-- BIRDIE — SCRIPT SQL CONSOLIDADO (5 Migraciones + Semilla Inicial)',
    '-- Pega este archivo en el SQL Editor de tu proyecto Supabase y pulsa "Run"',
    '-- ============================================================================\n',
  ];

  for (const file of files) {
    parts.push(`-- >>> INICIO MIGRACIÓN: ${file}`);
    parts.push(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
    parts.push(`-- <<< FIN MIGRACIÓN: ${file}\n`);
  }

  const seedPath = path.resolve(process.cwd(), 'supabase/seed.sql');
  if (fs.existsSync(seedPath)) {
    parts.push('-- >>> INICIO DATOS SEMILLA: seed.sql');
    parts.push(fs.readFileSync(seedPath, 'utf-8'));
    parts.push('-- <<< FIN DATOS SEMILLA: seed.sql\n');
  }

  const outPath = path.resolve(process.cwd(), 'supabase/full-setup.sql');
  fs.writeFileSync(outPath, parts.join('\n'), 'utf-8');
  return outPath;
}

async function main() {
  const outSqlPath = buildConsolidatedSql();
  console.log(`[SQL] Script consolidado generado en: ${outSqlPath}`);

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !anonKey || !serviceKey) {
    console.error(
      '[ERROR] Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.local'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[CONEXIÓN] Probando proyecto Supabase en vivo: ${url}`);
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Verificar cursos y datos semilla
  const { data: courses, error: coursesError } = await adminClient
    .from('courses')
    .select('id, external_golf_api_id, name, holes_count')
    .limit(5);

  if (coursesError) {
    console.error(`[ERROR] No se pudo consultar public.courses: ${coursesError.message}`);
    process.exitCode = 2;
    return;
  }

  // 2. Verificar loadTeeTimeSlots y loadSpecialEvents reales contra Supabase
  const loadedSlots = await loadTeeTimeSlots(adminClient);
  const loadedEvents = await loadSpecialEvents(adminClient);

  if (
    !loadedSlots.meta.persistedToBackend ||
    loadedSlots.slots.length === 0 ||
    !loadedSlots.slots.every((s) => isValidUuid(s.id))
  ) {
    throw new Error('Fallo al verificar UUIDs reales en loadTeeTimeSlots contra Supabase.');
  }

  if (
    !loadedEvents.meta.persistedToBackend ||
    loadedEvents.events.length === 0 ||
    !loadedEvents.events.every((e) => isValidUuid(e.id))
  ) {
    throw new Error('Fallo al verificar UUIDs reales en loadSpecialEvents contra Supabase.');
  }

  console.log(`[OK] 1/5 Esquema y semillas con UUIDs reales verificados en Supabase:`);
  console.log(`  - Campos (courses): ${courses?.length ?? 0}`);
  console.log(
    `  - Franjas reales (loadTeeTimeSlots): ${loadedSlots.slots.length} (UUID ej.: ${loadedSlots.slots[0].id})`
  );
  console.log(
    `  - Eventos reales (loadSpecialEvents): ${loadedEvents.events.length} (UUID ej.: ${loadedEvents.events[0].id})`
  );

  // Crear usuarios temporales reales en Supabase Auth para verificar RLS, triggers y RPC con JWT real
  const runSuffix = Date.now();
  const createdUserIds: string[] = [];
  let tempCourseId: string | null = null;
  let tempRoundId: string | null = null;
  let tempEventId: string | null = null;

  try {
    const password = `BirdieVerify#${runSuffix}!`;
    const adminEmail = `admin.${runSuffix}@birdie-verify.local`;
    const player1Email = `p1.${runSuffix}@birdie-verify.local`;
    const player2Email = `p2.${runSuffix}@birdie-verify.local`;

    const { data: uAdmin, error: eAdmin } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      app_metadata: { role: 'club_admin' },
      user_metadata: { full_name: 'Admin Verificación' },
    });
    if (eAdmin || !uAdmin.user) throw new Error(`Error creando admin test: ${eAdmin?.message}`);
    createdUserIds.push(uAdmin.user.id);

    const { data: uP1, error: eP1 } = await adminClient.auth.admin.createUser({
      email: player1Email,
      password,
      email_confirm: true,
      app_metadata: { role: 'player' },
      user_metadata: { full_name: 'Jugador Uno Test' },
    });
    if (eP1 || !uP1.user) throw new Error(`Error creando player1 test: ${eP1?.message}`);
    createdUserIds.push(uP1.user.id);

    const { data: uP2, error: eP2 } = await adminClient.auth.admin.createUser({
      email: player2Email,
      password,
      email_confirm: true,
      app_metadata: { role: 'player' },
      user_metadata: { full_name: 'Jugador Dos Test' },
    });
    if (eP2 || !uP2.user) throw new Error(`Error creando player2 test: ${eP2?.message}`);
    createdUserIds.push(uP2.user.id);

    // Asegurar perfiles en public.profiles
    await adminClient.from('profiles').upsert([
      {
        id: uAdmin.user.id,
        email: adminEmail,
        full_name: 'Admin Verificación',
        role: 'club_admin',
        handicap_index: 5.0,
      },
      {
        id: uP1.user.id,
        email: player1Email,
        full_name: 'Jugador Uno Test',
        role: 'player',
        handicap_index: 12.0,
      },
      {
        id: uP2.user.id,
        email: player2Email,
        full_name: 'Jugador Dos Test',
        role: 'player',
        handicap_index: 16.0,
      },
    ]);

    const clubAdminClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await clubAdminClient.auth.signInWithPassword({ email: adminEmail, password });

    const player1Client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await player1Client.auth.signInWithPassword({ email: player1Email, password });

    const player2Client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await player2Client.auth.signInWithPassword({ email: player2Email, password });

    // 3. Verificar RPC public.sync_golf_course_atomic (Hallazgos 7, 8 y Pendiente 2: limpieza de barras y hoyos obsoletos)
    const testExternalId = `golfapi_verify_${runSuffix}`;
    const { data: syncedId1, error: rpcErr1 } = await clubAdminClient.rpc(
      'sync_golf_course_atomic',
      {
        p_course: {
          external_golf_api_id: testExternalId,
          name: 'Campo Verificación RPC',
          club_name: 'Club Test',
          holes_count: 9,
          par_total: 36,
        },
        p_tees: [
          {
            name: 'Blancas',
            gender: 'men',
            course_rating: 72.0,
            slope_rating: 130,
            total_distance_meters: 3000,
          },
          {
            name: 'Amarillas',
            gender: 'mixed',
            course_rating: 70.0,
            slope_rating: 122,
            total_distance_meters: 2800,
          },
        ],
        p_holes: [
          {
            hole_number: 1,
            par: 4,
            stroke_index: 1,
            distance_white_meters: 365,
            distance_yellow_meters: 350,
            distance_blue_meters: 325,
            distance_red_meters: 305,
            tee_lat: 40.4682,
            tee_lng: -3.7815,
            green_front_lat: 40.4691,
            green_front_lng: -3.7802,
            green_center_lat: 40.4692,
            green_center_lng: -3.7801,
            green_back_lat: 40.4693,
            green_back_lng: -3.78,
          },
          {
            hole_number: 10,
            par: 4,
            stroke_index: 2,
            distance_white_meters: 375,
            distance_yellow_meters: 360,
            distance_blue_meters: 335,
            distance_red_meters: 315,
            tee_lat: 40.4681,
            tee_lng: -3.7817,
            green_front_lat: 40.4673,
            green_front_lng: -3.7824,
            green_center_lat: 40.4672,
            green_center_lng: -3.7825,
            green_back_lat: 40.4671,
            green_back_lng: -3.7826,
          },
        ],
      }
    );
    if (rpcErr1 || !syncedId1) {
      throw new Error(`Fallo en primera llamada a sync_golf_course_atomic: ${rpcErr1?.message}`);
    }
    tempCourseId = String(syncedId1);

    // Segunda sincronización eliminando la barra "Blancas" y el hoyo 10
    const { data: syncedId2, error: rpcErr2 } = await clubAdminClient.rpc(
      'sync_golf_course_atomic',
      {
        p_course: {
          external_golf_api_id: testExternalId,
          name: 'Campo Verificación RPC',
          club_name: 'Club Test',
          holes_count: 9,
          par_total: 36,
        },
        p_tees: [
          {
            name: 'Amarillas',
            gender: 'mixed',
            course_rating: 70.5,
            slope_rating: 124,
            total_distance_meters: 2820,
          },
        ],
        p_holes: [
          {
            hole_number: 1,
            par: 4,
            stroke_index: 1,
            distance_white_meters: 370,
            distance_yellow_meters: 355,
            distance_blue_meters: 330,
            distance_red_meters: 310,
            tee_lat: 40.4682,
            tee_lng: -3.7815,
            green_front_lat: 40.4691,
            green_front_lng: -3.7802,
            green_center_lat: 40.4692,
            green_center_lng: -3.7801,
            green_back_lat: 40.4693,
            green_back_lng: -3.78,
          },
        ],
      }
    );
    if (rpcErr2 || String(syncedId2) !== tempCourseId) {
      throw new Error(`Fallo en segunda llamada a sync_golf_course_atomic: ${rpcErr2?.message}`);
    }

    const { count: teesCount } = await adminClient
      .from('course_tees')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', tempCourseId);
    const { count: holesCount } = await adminClient
      .from('course_holes')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', tempCourseId);

    if (teesCount !== 1 || holesCount !== 1) {
      throw new Error(
        `sync_golf_course_atomic no eliminó obsoletos: tees=${teesCount}, holes=${holesCount}`
      );
    }
    console.log(
      `[OK] 2/5 RPC public.sync_golf_course_atomic verificada en vivo: upsert atómico y eliminación de barras/hoyos obsoletos (2->1 tees, 2->1 hoyos).`
    );

    // 4. Verificar reservas de Tee Time con UUID real y trigger de aforo atómico en servidor (Hallazgo 4 y Pendiente 1)
    const targetSlot = loadedSlots.slots.find((s) => !s.isBlocked && s.slotTime === '08:40')!;
    const booking1 = await submitTeeTimeBooking(
      loadedSlots.slots,
      {
        slotId: targetSlot.id,
        userId: uP1.user.id,
        userName: 'Jugador Uno Test',
        playersCount: 3,
      },
      player1Client
    );
    if (!isValidUuid(booking1.createdBooking.id)) {
      throw new Error('La reserva creada en Supabase no devolvió un UUID real.');
    }

    // Player 2 intenta reservar 2 plazas directamente contra el servidor (3 + 2 = 5 > 4) -> el trigger FOR UPDATE debe rechazarlo
    const { error: overbookError } = await player2Client.from('bookings').insert({
      slot_id: targetSlot.id,
      booked_by: uP2.user.id,
      players_count: 2,
      status: 'confirmed',
    });
    if (!overbookError || !overbookError.message.includes('Cupo insuficiente')) {
      throw new Error(
        `El trigger trg_bookings_enforce_slot_capacity no bloqueó el exceso de cupo: ${overbookError?.message ?? 'sin error'}`
      );
    }

    // Cancelar la reserva de prueba
    await submitCancelTeeTimeBooking(
      booking1.updatedSlots,
      booking1.createdBooking.id,
      uP1.user.id,
      'player',
      player1Client
    );
    await adminClient.from('bookings').delete().eq('id', booking1.createdBooking.id);
    console.log(
      `[OK] 3/5 Reservas con UUID real (${booking1.createdBooking.id}) y trigger atómico FOR UPDATE (trg_bookings_enforce_slot_capacity) verificados en vivo.`
    );

    // 5. Verificar límite guests_count (0..3) y degradación automática a waitlist en servidor (Hallazgos 4 y 9)
    const { data: createdEv, error: evCreateErr } = await clubAdminClient
      .from('special_events')
      .insert({
        title: 'Evento Aforo Atómico Test',
        description: 'Prueba en vivo de trigger waitlist',
        event_date: new Date(Date.now() + 86400000).toISOString(),
        location: 'Casa Club',
        capacity: 2,
        price_eur: 10,
        is_published: true,
      })
      .select('id')
      .single();
    if (evCreateErr || !createdEv) {
      throw new Error(`Error creando evento temporal: ${evCreateErr?.message}`);
    }
    tempEventId = String(createdEv.id);

    // 5a. Rechazo en servidor de guests_count = 4 (> 3)
    const { error: invalidGuestsErr } = await player1Client.from('event_rsvps').insert({
      event_id: tempEventId,
      user_id: uP1.user.id,
      guests_count: 4,
      status: 'attending',
    });
    if (!invalidGuestsErr) {
      throw new Error('La BD permitió guests_count = 4 (debía fallar CHECK 0..3).');
    }

    // 5b. Player 1 ocupa las 2 plazas (1 socio + 1 acompañante = 2/2 -> attending)
    const eventsAfterLoad = (await loadSpecialEvents(player1Client)).events;
    const rsvp1 = await submitEventRsvp(
      eventsAfterLoad,
      {
        eventId: tempEventId,
        userId: uP1.user.id,
        userName: 'Jugador Uno Test',
        guestsCount: 1,
        desiredStatus: 'attending',
      },
      player1Client
    );
    if (rsvp1.assignedStatus !== 'attending') {
      throw new Error(`Se esperaba 'attending' para Player 1 y se obtuvo ${rsvp1.assignedStatus}`);
    }

    // 5c. Player 2 solicita 'attending' cuando ya están ocupadas 2/2 -> el trigger en servidor lo pasa a 'waitlist'
    const { data: rsvp2Row, error: rsvp2Err } = await player2Client
      .from('event_rsvps')
      .upsert(
        {
          event_id: tempEventId,
          user_id: uP2.user.id,
          guests_count: 0,
          status: 'attending',
        },
        { onConflict: 'event_id,user_id' }
      )
      .select('status')
      .single();

    if (rsvp2Err || rsvp2Row?.status !== 'waitlist') {
      throw new Error(
        `El trigger trg_event_rsvps_enforce_capacity no asignó waitlist: ${rsvp2Err?.message ?? rsvp2Row?.status}`
      );
    }
    console.log(
      `[OK] 4/5 Eventos RSVP con UUID real (${tempEventId}), CHECK guests_count (0..3) y degradación automática a 'waitlist' en servidor verificados en vivo.`
    );

    // 6. Verificar RLS estricto de hole_scores e inmutabilidad de player_id (Hallazgo 5)
    const { data: roundRow, error: roundErr } = await player1Client
      .from('rounds')
      .insert({
        course_id: '11111111-1111-1111-1111-111111111101',
        created_by: uP1.user.id,
        status: 'in_progress',
        is_public: true,
      })
      .select('id')
      .single();
    if (roundErr || !roundRow) {
      throw new Error(`Error creando ronda temporal: ${roundErr?.message}`);
    }
    tempRoundId = String(roundRow.id);

    await player1Client.from('round_players').insert([
      { round_id: tempRoundId, player_id: uP1.user.id, playing_handicap: 12 },
      { round_id: tempRoundId, player_id: uP2.user.id, playing_handicap: 16 },
    ]);

    // Player 1 inserta su propio golpe en hoyo 1 -> permitido
    const { error: ownScoreErr } = await player1Client.from('hole_scores').insert({
      round_id: tempRoundId,
      player_id: uP1.user.id,
      hole_number: 1,
      strokes: 4,
      putts: 2,
      green_in_regulation: true,
      stableford_points: 2,
    });
    if (ownScoreErr) {
      throw new Error(`Player 1 no pudo insertar su propio golpe: ${ownScoreErr.message}`);
    }

    // Player 2 (compañero de partida) intenta insertar un golpe a nombre de Player 1 -> bloqueado por RLS
    const { error: spoofInsertErr } = await player2Client.from('hole_scores').insert({
      round_id: tempRoundId,
      player_id: uP1.user.id,
      hole_number: 2,
      strokes: 5,
      putts: 2,
      green_in_regulation: false,
      stableford_points: 1,
    });
    if (!spoofInsertErr) {
      throw new Error('RLS permitió a un compañero insertar golpes con player_id ajeno.');
    }

    // Player 1 intenta cambiar el player_id de su golpe existente a Player 2 -> bloqueado por trigger/RLS
    const { error: mutatePlayerIdErr } = await player1Client
      .from('hole_scores')
      .update({ player_id: uP2.user.id })
      .eq('round_id', tempRoundId)
      .eq('hole_number', 1);
    if (!mutatePlayerIdErr) {
      throw new Error('Se permitió mutar player_id en un UPDATE de hole_scores.');
    }

    console.log(
      `[OK] 5/5 RLS estricto de public.hole_scores y trigger trg_hole_scores_immutable_identity verificados en vivo.`
    );
    console.log(`\n✅ VERIFICACIÓN INTEGRAL EN VIVO CONTRA SUPABASE COMPLETADA CON ÉXITO (5/5 BLOQUES).`);
  } finally {
    if (tempRoundId) {
      await adminClient.from('rounds').delete().eq('id', tempRoundId);
    }
    if (tempEventId) {
      await adminClient.from('special_events').delete().eq('id', tempEventId);
    }
    if (tempCourseId) {
      await adminClient.from('courses').delete().eq('id', tempCourseId);
    }
    for (const uid of createdUserIds) {
      await adminClient.auth.admin.deleteUser(uid);
    }
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exitCode = 1;
});
