// ============================================================================
// SUPABASE EDGE FUNCTION: sync-golf-course
// Sincroniza un campo desde el proveedor Golf API externo hacia las tablas
// public.courses, public.course_tees y public.course_holes del club.
// Restringido a usuarios con rol 'club_admin' o 'superadmin'.
// Comparte la misma fuente de verdad de validación/normalización que el cliente
// (`src/lib/golf-api/normalizer.ts`) y ejecuta la operación de forma atómica.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  buildSupabaseCourseSyncBundle,
  normalizeExternalCoursePayload,
} from '../../../src/lib/golf-api/normalizer.ts';

interface SyncCourseRequestBody {
  externalCourseId: string;
  isHomeCourse?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Falta cabecera Authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const golfApiBaseUrl = Deno.env.get('GOLF_API_BASE_URL') ?? 'https://api.golfapi.io/v1';
    const golfApiKey = Deno.env.get('GOLF_API_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Verificar que el usuario autenticado tenga rol club_admin o superadmin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Usuario no autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userRole = user.app_metadata?.role;
    if (userRole !== 'club_admin' && userRole !== 'superadmin') {
      return new Response(
        JSON.stringify({
          error: 'Permiso denegado: solo club_admin o superadmin pueden sincronizar campos.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as SyncCourseRequestBody;
    if (!body.externalCourseId) {
      return new Response(
        JSON.stringify({ error: 'El parámetro externalCourseId es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Consultar proveedor Golf API externo
    const apiResponse = await fetch(
      `${golfApiBaseUrl}/courses/${encodeURIComponent(body.externalCourseId)}`,
      {
        headers: {
          Authorization: `Bearer ${golfApiKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (!apiResponse.ok) {
      return new Response(
        JSON.stringify({
          error: `Golf API devolvió estado ${apiResponse.status}`,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rawExternalPayload = await apiResponse.json();

    // 3. Validar y normalizar usando la fuente única de verdad compartida con el cliente
    let normalizedCourse;
    try {
      normalizedCourse = normalizeExternalCoursePayload(rawExternalPayload);
    } catch (validationErr) {
      const msg =
        validationErr instanceof Error
          ? validationErr.message
          : 'Payload externo de Golf API inválido';
      return new Response(JSON.stringify({ error: msg }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bundle = buildSupabaseCourseSyncBundle(
      normalizedCourse,
      Boolean(body.isHomeCourse)
    );

    // 4. Ejecutar sincronización transaccional atómica en PostgreSQL (`sync_golf_course_atomic`)
    // para evitar tees duplicados (ON CONFLICT (course_id, name, gender)) o campos parcialmente sincronizados
    const { data: syncedCourseId, error: rpcError } = await supabase.rpc(
      'sync_golf_course_atomic',
      {
        p_course: bundle.course,
        p_tees: bundle.tees,
        p_holes: bundle.holes,
      }
    );

    if (rpcError || !syncedCourseId) {
      throw new Error(
        rpcError?.message ??
          'Error en la transacción sync_golf_course_atomic al sincronizar campo, barras y hoyos.'
      );
    }

    return new Response(
      JSON.stringify({
        status: 'synced',
        courseId: syncedCourseId,
        externalCourseId: normalizedCourse.externalGolfApiId,
        holesSynced: normalizedCourse.holes.length,
        teesSynced: normalizedCourse.tees.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno en sync-golf-course';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
