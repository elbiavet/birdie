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
   - Comprueba que cada función exportada, rama de error, Edge Function y pantalla nueva (`renderToStaticMarkup` envuelto en `<ClubProvider>`) tenga su test en `__tests__/`.
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

1. **Normalización y alta de recorridos (`src/lib/golf-api/`)**:
   - Todo payload externo de `golfapi.io` / `GolfCourseAPI` debe pasar por `normalizeExternalCoursePayload` en [`src/lib/golf-api/index.ts`](../../../src/lib/golf-api/index.ts) o por la Edge Function [`supabase/functions/sync-golf-course/index.ts`](../../../supabase/functions/sync-golf-course/index.ts) (restringida a `club_admin` y `superadmin`).
   - Verifica que los 18 hoyos tengan `strokeIndex` únicos del `1` al `18` y coordenadas GPS (`greenFrontLat/Lng`, `greenCenterLat/Lng`, `greenBackLat/Lng`).
2. **Caché offline de hoyos en SQLite**:
   - Invoca `syncCourseToOfflineCache(courseId)` para persistir los 18 hoyos en `cacheCourseData` (`src/lib/capacitor/sqlite.ts`) antes de iniciar una ronda sin cobertura.
3. **Anotación Offline-First y vaciado de cola (`src/lib/offline-sync/index.ts`)**:
   - Usa siempre `recordHoleScoreOfflineFirst(params)` para calcular puntos Stableford (`src/lib/scoring/engine.ts`) y guardar en SQLite local con `syncStatus = 'pending'`.
   - Cuando recupere conectividad (`isOnline`), ejecuta `flushPendingScoresToSupabase()` para enviar los registros pendientes y marcarlos como `synced`.
   - En los tests unitarios de Vitest, limpia siempre el almacén en `beforeEach` mediante `await clearOfflineStore()`.

---

## Flujo 5: Competición, Reservas de Salidas y Clasificación WHS (`src/lib/competition/`)

Sigue estos pasos cuando modifiques o extiendas los módulos de Reservas (`/bookings`), Calendario (`/calendar`), Torneos (`/tournaments`) o Eventos (`/events`):

1. **Reservas de Tee Times (`createTeeTimeBooking` / `cancelTeeTimeBooking`)**:
   - Verifica siempre `playersCount` entre `1` y `4`, que `slot.isBlocked` sea `false` y que `playersCount <= getAvailableSeatsInSlot(slot)`.
   - Respeta la paridad con la política RLS de `public.tee_time_bookings`: un `player` solo puede cancelar reservas donde `booking.userId === actorUserId`, mientras que `club_admin` y `superadmin` pueden cancelar cualquier reserva.
2. **Clasificación de Torneos (`rankTournamentLeaderboard`)**:
   - Soporta las 3 modalidades (`stableford`, `stroke_play_net`, `stroke_play_gross`) aplicando desempate automático por segunda vuelta (`backNineStablefordPoints`) y menor `playingHandicap`.
3. **Eventos Especiales y Lista de Espera (`upsertEventRsvp`)**:
   - Valida acompañantes (`0..3`) y asigna automáticamente `status = 'waitlist'` cuando `getConfirmedEventAttendeesCount(event) + 1 + guestsCount > event.maxCapacity`.
