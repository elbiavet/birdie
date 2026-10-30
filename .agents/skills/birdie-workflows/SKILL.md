---
name: birdie-workflows
description: >-
  Procedimientos detallados y reutilizables del proyecto Birdie para: (1) dar de alta o cambiar la configuración white-label de un club de golf, (2) añadir migraciones SQL de Supabase con políticas RLS y tests pgTAP, (3) sincronizar campos desde Golf API y cola offline SQLite, (4) ejecutar la revisión de cierre de fase en BACKLOG.md, (5) desplegar proyectos de club white-label en Vercel, y (6) integrar ortofotos satelitales PNOA/IGN con aislamiento SSR y telemetría de hoyos. Úsala siempre que trabajes en alta de clubes, cambios de base de datos, núcleo deportivo, cierres de fase, despliegue o cartografía.
---

# Flujos de Trabajo Reutilizables de Birdie (`birdie-workflows`)

Esta skill contiene las instrucciones operativas paso a paso para los flujos de trabajo recurrentes del proyecto **Birdie**. Las reglas generales y permanentes residen en [`AGENTS.md`](../../../AGENTS.md).

---

## Flujo 1: Alta, Cambio o Sustitución de Club White-Label

Sigue estos pasos cuando añadas un nuevo club al repositorio, cambies el club activo para compilación Web / Android APK o sustituyas un club existente:

1. **Crear archivos del club**:
   - Crea `clubs/<clubId>/config.json` cumpliendo estrictamente el esquema [`clubs/schema.json`](../../../clubs/schema.json).
   - Añade el logotipo vectorial en `clubs/<clubId>/assets/logo.svg` y assets nativos (`icon.png`, `splash.png`, `google-services.json`).
2. **Registrar el club en el catálogo y en CI/CD**:
   - Importa el JSON y añádelo al mapa `CLUB_REGISTRY` en [`src/lib/club-config/index.ts`](../../../src/lib/club-config/index.ts).
   - Añade `<clubId>` a la lista `strategy.matrix.club` en [`.github/workflows/build-club-apk.yml`](../../../.github/workflows/build-club-apk.yml) y actualiza el paso de verificación en [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml).
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
5. **Sustitución o retirada de un club obsoleto**:
   - Si se retira un club anterior, elimina su clave e importación en `src/lib/club-config/index.ts`.
   - Elimina la carpeta `clubs/<clubIdObsoleto>/` y su entrada en `build-club-apk.yml` y `ci.yml`.
   - Adapta las aserciones de pruebas en `src/**/__tests__/` que hacían referencia al club retirado para verificar el nuevo club activo.

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
4. **Soporte Universal de Recorridos de 9 Hoyos y Adaptación de Vistas y WHS**:
   - Para campos homologados de 9 hoyos (como Señorío de Illescas `senorio-illescas`, Par 35 con Stroke Indexes 1..9):
     - El reparto de golpes WHS en `calculateStrokesReceivedOnHole` reconoce si `strokeIndex` ya está en 1..9 (`effectiveSi = strokeIndex <= 9 ? strokeIndex : Math.ceil(strokeIndex / 2)`), garantizando que el resto de golpes se asigne con precisión de 1 en 1 sin duplicar golpes en hoyos contiguos.
     - En hándicaps plus (jugadores que ceden golpes), el índice inverso se calcula como `maxSi + 1 - effectiveSi` (con `maxSi = 9` para campos de 9 hoyos y `18` para campos de 18 hoyos).
     - En el catálogo (`GOLF_API_COURSES_CATALOG`), `holesCount` define la longitud real del recorrido (`9` o `18`), con distancias y valoraciones de campo (Course Rating / Slope) acordes al número de hoyos homologados.
     - En las vistas de usuario (`/clubs`, `/course`, `/scorecard`), las tablas y tarjetas de segunda vuelta (`VUELTA / IN`) solo se renderizan si `inHoles.length > 0` o `course.holesCount === 18`. En recorridos de 9 hoyos, la tabla de Ida incorpora la columna de Total y el marcador restringe la navegación y resumen a los 9 hoyos sin tarjetas vacías ni botones de hoyos inexistentes.

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

---

## Flujo 6: Despliegue en Vercel (Multi-Club White-Label)

Sigue estos pasos para desplegar Birdie en Vercel manteniendo la independencia de cada club:

1. **Estrategia de Proyectos Multi-Club**:
   - Cada club cuenta con un proyecto independiente en Vercel conectado al mismo repositorio GitHub (ej. `birdie-valleverde` y `birdie-senorioillescas`).
   - El hook `npm run prebuild` se ejecuta automáticamente antes de `next build` en Vercel, leyendo `NEXT_PUBLIC_CLUB_ID` y `NEXT_PUBLIC_APP_ENV` para inyectar el branding, assets y variables del club activo.
2. **Variables de Entorno Obligatorias en Vercel**:
   - `NEXT_PUBLIC_CLUB_ID`: ID del club (`demo-club`, `senorio-illescas`, etc.).
   - `NEXT_PUBLIC_APP_ENV`: `staging` o `production`.
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Credenciales del proyecto Supabase del club.
3. **Despliegue con Vercel CLI o Git**:
   - Vía Git: Vercel recompila automáticamente ante cada `git push origin main`.
   - Vía CLI: `npx vercel` (preview) o `npx vercel --prod` (producción).
4. **Verificación**: Consulta la guía detallada en [`docs/deployment/vercel.md`](../../../docs/deployment/vercel.md).

---

## Flujo 7: Integración Cartográfica Satelital PNOA/IGN y Capa de Datos Reales del Hoyo (`src/components/modules/course/`)

Sigue estos pasos para mantener, ampliar o depurar el visor cartográfico de hoyos con ortofotos oficiales del PNOA/IGN y telemetría de Golf API:

1. **Servicio Oficial WMTS y Proyecciones Cartográficas**:
   - Utiliza siempre la plantilla KVP estándar del servicio oficial WMTS del Instituto Geográfico Nacional:
     `https://www.ign.es/wmts/pnoa-ma?Service=WMTS&Request=GetTile&Version=1.0.0&Layer=OI.OrthoimageCoverage&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileCol={x}&TileRow={y}`
   - **Diferenciación estricta de sistemas de coordenadas**:
     - `EPSG:4326` (WGS 84): Coordenadas geográficas angulares en grados (`lat`, `lng`) entregadas por Golf API y el hardware GPS móvil.
     - `EPSG:3857` (Web Mercator / `GoogleMapsCompatible`): Coordenadas planas proyectadas en metros utilizadas por la malla de teselas WMTS. Leaflet se encarga de la reproyección interna matemática entre ambos sistemas.
2. **Atribución Oficial Obligatoria**:
   - Por mandato de la autodescripción del servicio (`<ows:AccessConstraints>CC BY 4.0 scne.es</ows:AccessConstraints>`) y la Orden FOM/2807/2015, es **estrictamente obligatorio** mostrar de forma visible la atribución:
     `PNOA CC BY 4.0 scne.es` (con enlace a `https://www.scne.es`).
3. **Aislamiento SSR y Exportación Estática en Next.js**:
   - Dado que Leaflet interactúa con el DOM (`window`, `document`, Canvas), cualquier visor cartográfico debe encapsularse en un componente cliente (`'use client'`) e importarse en las vistas mediante:
     ```tsx
     const HoleCartographyMap = dynamic(
       () => import('./HoleCartographyMap').then((m) => m.HoleCartographyMap),
       { ssr: false, loading: () => <HoleCartographySkeleton /> }
     );
     ```
   - Esto evita errores de `ReferenceError: window is not defined` durante `next build` con `output: 'export'`.
4. **Política Offline y Estrategia de Fallback**:
   - **Decisión técnica explícita**: No se pre-descargan ni almacenan teselas ráster pesadas en SQLite ni en el disco local de Capacitor Android para evitar colapsar el almacenamiento móvil (cientos de megabytes por campo).
   - Ante desconexión de red (`navigator.onLine === false` o evento `offline`) o error en la descarga de teselas (`tileerror`), el visor muestra un aviso estructurado con botón de reintento y permite la conmutación inmediata al **esquema técnico vectorial SVG interactivo**, garantizando la continuidad de juego sin red.
5. **Fidelidad de Geometrías y Restricción de Datos**:
   - Golf API provee coordenadas discretas oficiales (Tee, Green Centro/Frente/Fondo y POIs).
   - La línea discontinua entre Salida, Doglegs y Centro de Green es un **eje de tiro teórico / línea de juego estimada**, nunca el contorno real de la calle (*fairway*).
   - **Prohibido dibujar polígonos inventados** de calles, antegreens o bunkers si la fuente no los proporciona. La ortofoto satelital PNOA es la que aporta el contexto y textura visual fidedigna del terreno.


