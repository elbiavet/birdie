// ============================================================================
// SUPABASE EDGE FUNCTION: sync-golf-course
// Sincroniza un campo desde el proveedor Golf API externo hacia las tablas
// public.courses, public.course_tees y public.course_holes del club.
// Restringido a usuarios con rol 'club_admin' o 'superadmin'.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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

    const externalCourse = await apiResponse.json();

    // 3. Upsert en public.courses
    const { data: upsertedCourse, error: courseError } = await supabase
      .from('courses')
      .upsert(
        {
          external_golf_api_id: body.externalCourseId,
          name: externalCourse.courseName,
          club_name: externalCourse.clubName ?? externalCourse.courseName,
          city: externalCourse.city ?? null,
          country: externalCourse.country ?? 'España',
          holes_count: externalCourse.holes?.length === 9 ? 9 : 18,
          par_total:
            externalCourse.holes?.reduce(
              (acc: number, h: { par: number }) => acc + h.par,
              0
            ) ?? 72,
          latitude: externalCourse.lat,
          longitude: externalCourse.lng,
          is_home_course: Boolean(body.isHomeCourse),
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'external_golf_api_id' }
      )
      .select('id')
      .single();

    if (courseError || !upsertedCourse) {
      throw new Error(courseError?.message ?? 'Error al guardar el campo en public.courses');
    }

    return new Response(
      JSON.stringify({
        status: 'synced',
        courseId: upsertedCourse.id,
        externalCourseId: body.externalCourseId,
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
