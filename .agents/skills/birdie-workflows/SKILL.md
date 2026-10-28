---
name: birdie-workflows
description: >-
  Procedimientos detallados y reutilizables del proyecto Birdie para: (1) dar de alta o cambiar la configuración white-label de un club de golf, (2) añadir migraciones SQL de Supabase con políticas RLS y tests pgTAP, (3) sincronizar campos desde Golf API y cola offline SQLite, y (4) ejecutar la revisión de cierre de fase en BACKLOG.md. Úsala siempre que trabajes en alta de clubes, cambios de base de datos, núcleo deportivo o cierres de fase.
---

# Flujos de Trabajo Reutilizables de Birdie (`birdie-workflows`)

Esta skill contiene las instrucciones operativas paso a paso para los flujos de trabajo recurrentes del proyecto **Birdie**. Las reglas generales y permanentes residen en [`AGENTS.md`](../../../AGENTS.md).

---

## Flujo 1: Alta o Cambio de Club White-Label

Sigue estos pasos cuando añadas un nuevo club al repositorio o cambies el club activo para compilación Web / Android APK:

1. **Crear archivos del club**:
   - Crea `clubs/<clubId>/config.json` cumpliendo estrictamente el esquema [`clubs/schema.json`](../../../clubs/schema.json).
   - Añade el logotipo vectorial en `clubs/<clubId>/assets/logo.svg`.
2. **Registrar el club en el catálogo y en CI/CD**:
   - Importa el JSON y añádelo al mapa `CLUB_REGISTRY` en [`src/lib/club-config/index.ts`](../../../src/lib/club-config/index.ts).
   - Añade `<clubId>` a la lista `strategy.matrix.club` en [`.github/workflows/build-club-apk.yml`](../../../.github/workflows/build-club-apk.yml).
3. **Aplicar y verificar la configuración del club**:
   - Ejecuta el configurador indicando club y entorno (`staging` o `production`):
     ```powershell
     npm run configure:club club=<clubId> env=staging
     ```
   - Verifica que se hayan actualizado `src/lib/club-config/active-club.generated.json`, `public/club-logo.svg` y el bloque `:root` en `src/app/globals.css`.
4. **Ejecutar tests del motor White-Label**:
   ```powershell
   npm run test
   ```
   *(El test `club-config.test.ts` comprobará automáticamente que todos los clubes de `listRegisteredClubIds()` estén presentes en `build-club-apk.yml` y cumplan el esquema).*

---

## Flujo 2: Nueva Tabla o Migración en Supabase con RLS y `pgTAP`

Cada vez que una fase requiera añadir o modificar tablas en PostgreSQL:

1. **Crear o actualizar la migración en `supabase/migrations/`**:
   - Activa siempre RLS:
     ```sql
     ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;
     ```
   - Define políticas explícitas usando las funciones helper `public.current_user_role()`, `public.is_club_admin_or_superadmin()` y `public.is_superadmin()` para diferenciar `player`, `club_admin` y `superadmin`.
2. **Actualizar la lista de auditoría RLS**:
   - Si creaste una tabla nueva, añade su nombre a `EXPECTED_PUBLIC_TABLES` en [`src/lib/supabase/__tests__/migrations-rls-audit.test.ts`](../../../src/lib/supabase/__tests__/migrations-rls-audit.test.ts).
3. **Añadir o actualizar aserciones `pgTAP` en `supabase/tests/database/*.test.sql`**:
   - Mantén la estructura transaccional:
     ```sql
     BEGIN;
     CREATE EXTENSION IF NOT EXISTS pgtap;
     SELECT plan(<N>);
     -- Aserciones: SELECT is(...), is_empty(...), lives_ok(...), throws_ok(...)
     SELECT * FROM finish();
     ROLLBACK;
     ```
   - Asegúrate de que el número `<N>` en `SELECT plan(<N>);` coincida exactamente con el total de aserciones del archivo.
4. **Verificar localmente**:
   ```powershell
   npm run test
   ```

---

## Flujo 3: Procedimiento de Revisión de Cierre de Fase (`BACKLOG.md`)

Antes de dar por cerrada cualquier fase en [`BACKLOG.md`](../../../BACKLOG.md):

1. **Contrastar tareas y criterios de aceptación**:
   - Lee todas las filas de la fase en `BACKLOG.md` y verifica que cada archivo, función o ruta nombrada en la columna `Criterio de Verificación` exista con ese nombre exacto.
2. **Auditar cobertura de tests por cambio de comportamiento**:
   - Comprueba que cada función exportada, rama de error, Edge Function y pantalla nueva (`renderToStaticMarkup` envuelto en `<ClubProvider>` y `<AppShell>`) tenga su test en `__tests__/`.
   - **Regla de no-duplicación de `AppShell`**: [`src/app/layout.tsx`](../../../src/app/layout.tsx) ya envuelve `{children}` en `<AppShell>{children}</AppShell>`. Ninguna página de `src/app/` debe envolver su JSX en `<AppShell>`. Verifica siempre en los tests SSR de pantallas que `(<header/g).length === 1` y `(<aside/g).length === 1`.
   - Si se añadieron nuevas páginas en `src/app/`, limpia la caché incremental `.next` antes de compilar la exportación estática para evitar manifiestos obsoletos de Route Groups en Next.js 15 (`if (Test-Path .next) { Remove-Item -Recurse -Force .next }`).
   - Ejecuta la batería completa de validación:
     ```powershell
     npm run typecheck
     npm run test
     npm run build
     ```
3. **Documentar verificaciones no automatizables localmente**:
   - Si una prueba depende de un servicio externo o binario no instalado localmente (ej. contenedor de `supabase test db` o compilación Gradle Android en runner Linux), deja constancia explícita en la columna `Registro de Tests / Resultado` de `BACKLOG.md` indicando qué se verificó estáticamente en local y qué workflow de CI lo ejecuta.
4. **Actualizar `AGENTS.md`, esta skill y `BACKLOG.md`**:
   - Registra la tarea de `[REVISIÓN DE CIERRE FASE X]` en `BACKLOG.md` y márcala como `completada` solo tras obtener salida `0` en todos los comandos.

---

## Flujo 4: Sincronización de Campos Golf API y Cola Offline-First (SQLite ↔ Supabase)

Sigue estos pasos cuando añadas un nuevo recorrido al catálogo, ajustes la lógica WHS/Stableford o modifiques la sincronización offline del marcador:

1. **Normalización compartida y sincronización transaccional (`src/lib/golf-api/normalizer.ts`)**:
   - Todo payload externo de `golfapi.io` / `GolfCourseAPI` debe validarse y normalizarse con `normalizeExternalCoursePayload` y `buildSupabaseCourseSyncBundle` en [`src/lib/golf-api/normalizer.ts`](../../../src/lib/golf-api/normalizer.ts), que es la **fuente única de verdad** compartida entre el cliente Next.js (`src/lib/golf-api/index.ts`) y la Edge Function Deno (`supabase/functions/sync-golf-course/index.ts`).
   - El normalizador exige 9 o 18 hoyos con `strokeIndex` únicos, coordenadas GPS en rango (`-90..90` / `-180..180`), `slopeRating` (`55..155`) y deduplicación de barras por `(name, gender)`.
   - La Edge Function persiste el campo invocando la función RPC transaccional `public.sync_golf_course_atomic(p_course, p_tees, p_holes)` en PostgreSQL, la cual ejecuta `DELETE FROM public.course_tees` y `DELETE FROM public.course_holes` para eliminar barras y hoyos obsoletos que ya no vengan en el payload antes de hacer `INSERT ... ON CONFLICT (course_id, name, gender) DO UPDATE` y `ON CONFLICT (course_id, hole_number) DO UPDATE`.
2. **Caché offline y conexión nativa SQLite (`src/lib/capacitor/sqlite.ts`)**:
   - `initOfflineDatabase()` abre y almacena la instancia singleton `SQLiteDBConnection` en Android nativo (`@capacitor-community/sqlite`), reutilizada por todas las operaciones CRUD (`saveOfflineHoleScore`, `getOfflineRoundScores`, `getPendingSyncScores`, `markScoreAsSynced`, `cacheCourseData`, `getCachedCourseData`, `clearOfflineStore`), manteniendo el fallback en memoria para Web/SSR.
   - Invoca `syncCourseToOfflineCache(courseId)` para persistir los hoyos antes de iniciar una ronda sin cobertura.
3. **Anotación Offline-First (9/18 hoyos), Mutex de concurrencia y control de versiones (`src/lib/offline-sync/index.ts`)**:
   - Usa `recordHoleScoreOfflineFirst(params)` pasando `holesCount: 9 | 18` para calcular golpes recibidos WHS y puntos Stableford (`src/lib/scoring/engine.ts`). Cada edición guarda el registro con `syncStatus = 'pending'` e incrementa monotónicamente `revision`.
   - `flushPendingScoresToSupabase()` utiliza un mutex en vuelo (`activeFlushPromise`) para evitar que dos vaciados concurrentes dupliquen envíos, y pasa `expectedRevision = scoreSnapshot.revision` a `markScoreAsSynced` para que una respuesta tardía de una versión antigua nunca marque como `'synced'` una edición más reciente.
   - Si no hay conexión (`skipped_offline`) o Supabase no está configurado (`skipped_unconfigured`), **nunca** marca golpes como sincronizados de forma ficticia: devuelve `syncedCount: 0` y conserva los registros en `'pending'`.
   - En los tests unitarios de Vitest, limpia siempre el almacén en `beforeEach` mediante `await clearOfflineStore()`.

---

## Flujo 5: Competición, Reservas Atómicas y Separación Demo vs. Producción (`src/lib/competition/`)

Sigue estos pasos cuando modifiques o extiendas los módulos de Reservas (`/bookings`), Calendario (`/calendar`), Torneos (`/tournaments`) o Eventos (`/events`):

1. **Reservas de Tee Times (`loadTeeTimeSlots` / `createTeeTimeBooking` / `submitTeeTimeBooking` / `submitCancelTeeTimeBooking`)**:
   - En montaje de `/bookings`, invoca siempre `loadTeeTimeSlots()` para sustituir el catálogo semilla por las filas reales de `public.tee_time_slots` y `public.bookings` con sus UUIDs reales cuando Supabase está configurado. Todas las semillas deben usar UUIDs RFC-4122 válidos (`isValidUuid`).
   - Verifica en cliente `playersCount` entre `1` y `4`, que `slot.isBlocked` sea `false` y que `playersCount <= getAvailableSeatsInSlot(slot)`.
   - En PostgreSQL (`20261027000004_tournaments_bookings_events.sql`), el trigger `trg_bookings_enforce_slot_capacity` (`public.enforce_tee_time_slot_capacity`) bloquea la fila de `tee_time_slots` con `FOR UPDATE` para garantizar que dos solicitudes simultáneas nunca superen `max_players`.
   - En `public.hole_scores` (`20261027000003_scorecards_and_stats.sql`), las políticas RLS de `INSERT`/`UPDATE` exigen `player_id = auth.uid()` (o rol admin) y el trigger `trg_hole_scores_immutable_identity` impide mutar `player_id`, `round_id` o `hole_number`.
2. **Clasificación de Torneos (`rankTournamentLeaderboard`)**:
   - Soporta las 3 modalidades (`stableford`, `stroke_play_net`, `stroke_play_gross`) aplicando desempate automático por segunda vuelta (`backNineStablefordPoints`) y menor `playingHandicap`.
3. **Eventos Especiales y Lista de Espera Atómica (`loadSpecialEvents` / `upsertEventRsvp` / `submitEventRsvp`)**:
   - En montaje de `/events`, invoca `loadSpecialEvents()` para cargar los eventos y RSVPs reales con sus UUIDs desde `public.special_events` y `public.event_rsvps` cuando Supabase está configurado.
   - Tanto la interfaz como la restricción `CHECK (guests_count BETWEEN 0 AND 3)` en `public.event_rsvps` limitan los acompañantes a `0..3`.
   - El trigger `trg_event_rsvps_enforce_capacity` (`public.enforce_event_rsvp_capacity`) bloquea `public.special_events` con `FOR UPDATE` en servidor y degrada automáticamente `status` a `'waitlist'` si `asistentes_confirmados + 1 + guests_count > capacity`.
4. **Transparencia Demo vs. Producción (`resolvePersistenceMetadata`)**:
   - Cuando `isSupabaseConfigured()` es `false`, toda acción interactiva devuelve `persistence: 'demo_memory_only'` y `persistedToBackend: false`, mostrando en la UI un aviso explícito de que el cambio vive únicamente en la memoria de sesión y no se ha persistido en Supabase.
