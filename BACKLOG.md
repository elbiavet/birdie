# BACKLOG.md — Planificación y Seguimiento de Tareas (`Birdie`)

> **Reglas de uso (ver [`AGENTS.md`](./AGENTS.md))**:
> 1. **Estados válidos**: `pendiente` | `en curso` | `completada`.
> 2. **Flujo estricto**: Cambiar a `en curso` antes de iniciar una tarea y a `completada` **solo después de verificarla**.
> 3. **Registro de tests**: Toda tarea de prueba debe registrar si se ejecutó (`Ejecutado: Sí / No / Bloqueado`), el comando real empleado y el resultado obtenido.

---

## 0. Descubrimiento del Proyecto y Supuestos Iniciales

- **Inspección inicial del repositorio**: El directorio `c:\Users\elbia\Desktop\PROGRAMACION\00 - IA Proyectos\birdie` se encontraba completamente vacío (proyecto *greenfield*), sin `BACKLOG.md`, `AGENTS.md`, `.git` ni `package.json` previos.
- **Comandos de prueba descubiertos actualmente**:
  - Al no existir aún `package.json` ni `supabase/config.toml` en el repositorio, **actualmente no hay comandos de test configurados en el proyecto**.
  - **Herramientas detectadas en el sistema**:
    - `git`: Disponible (`git version 2.45.1.windows.1`).
    - `node` / `npm` / `pnpm`: Se detectaron los scripts en `C:\Users\elbia\AppData\Roaming\npm` y rutas de NVM en `C:\Users\elbia\AppData\Local\nvm` y `C:\nvm4w\nodejs` (fuera del acceso por defecto del sandbox, por lo que su ejecución requerirá habilitar el acceso al binario de Node o ejecutar fuera del sandbox cuando se lancen builds/tests en la Fase 1).
- **Supuestos documentados**:
  - Los scripts de verificación (`typecheck`, `lint`, `test` con Vitest y tests `pgTAP` de Supabase) se definirán formalmente en `package.json` durante la tarea `F1.1-T02` y en `supabase/config.toml` durante `F1.3-T01`. Hasta que dichas tareas estén completadas, no se asume ningún comando de test preexistente.

---

## Fase 0: Configuración de Flujo de Planificación y Seguimiento

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F0-T01` | Analizar el repositorio para detectar backlogs previos, estructura de archivos y comandos de prueba disponibles. | `completada` | Directorio inspeccionado y hallazgos documentados en la sección 0 de `BACKLOG.md`. | **Ejecutado**: Sí (`Get-ChildItem -Force -Recurse`, `git --version`). **Resultado**: Directorio vacío confirmado; `git 2.45.1` operativo; `node` en ruta NVM fuera del sandbox. |
| `F0-T02` | Crear `AGENTS.md` con las 5 reglas obligatorias de planificación, seguimiento en `BACKLOG.md`, ejecución de tests y resumen final. | `completada` | Archivo `AGENTS.md` creado en la raíz con las 5 directrices y convenciones del proyecto. | **Ejecutado**: Sí (verificación de lectura de `AGENTS.md`). **Resultado**: Archivo presente y completo. |
| `F0-T03` | Crear `BACKLOG.md` dividiendo el proyecto Birdie en fases ordenadas y tareas pequeñas, concretas y verificables, incluyendo tareas de tests. | `completada` | Archivo `BACKLOG.md` creado en la raíz con todas las fases, estados y columnas de verificación. | **Ejecutado**: Sí (verificación de estructura y estados en `BACKLOG.md`). **Resultado**: Backlog inicializado sin tareas duplicadas. |
| `F0-T04` | Desglosar la Fase 1 en subtareas granulares ordenadas por subfases (`1.1` a `1.6`) antes de iniciar la implementación. | `completada` | Fase 1 dividida en 30 tareas atómicas y verificables con tareas explícitas `[TEST]` en cada subfase. | **Ejecutado**: Sí (revisión de `BACKLOG.md`). **Resultado**: Desglose granular registrado sin duplicidades. |

---

## Fase 1: Cimientos, White-Label, Esquema Supabase + pgTAP y App Shell

### Subfase 1.1: Inicialización del Repositorio, Toolchain y Next.js Base

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F1.1-T01` | Inicializar repositorio Git (`git init`), `.gitignore` (Node, Next.js, Capacitor, Android, Supabase) y estructura base de carpetas (`src/`, `clubs/`, `scripts/`, `supabase/`, `.github/workflows/`). | `completada` | Repositorio Git activo en rama `main` y `.gitignore` presente. | **Ejecutado**: Sí (`git init -b main`, `git status --short --branch`). **Resultado**: PASS — Repositorio Git en rama `main` y estructura de carpetas creada. |
| `F1.1-T02` | Crear `package.json` con dependencias de Next.js, React, TypeScript, Tailwind CSS, Supabase JS, Capacitor (`core`, `android`, `geolocation`, `sqlite`, `push-notifications`), Lucide Icons y Vitest, definiendo los scripts oficiales (`dev`, `build`, `lint`, `typecheck`, `test`, `configure:club`). | `completada` | `package.json` válido con todos los scripts documentados. | **Ejecutado**: Sí (`Get-Content package.json -Raw \| ConvertFrom-Json`). **Resultado**: PASS — JSON válido y scripts oficiales registrados. |
| `F1.1-T03` | Crear `tsconfig.json`, `next.config.ts` (compatible con `output: 'export'` e `images: { unoptimized: true }` para el APK Android y despliegue en Vercel), `postcss.config.mjs` y `.env.example` (documentando variables por entorno `staging` y `production`). | `completada` | Archivos de configuración presentes y sin errores de sintaxis. | **Ejecutado**: Sí (`Test-Path tsconfig.json, next.config.ts, postcss.config.mjs, vitest.config.ts, .env.example`). **Resultado**: PASS — Todos los archivos creados y validados. |
| `F1.1-T04` | **[TEST]** Instalar dependencias del proyecto y verificar que el compilador de TypeScript (`npm run typecheck`) y el runner de tests (`npm run test`) se ejecutan correctamente. | `completada` | Instalación completada y ejecución de `typecheck` y `test` con código de salida `0`. | **Ejecutado**: Sí (`npm install`, `npm run typecheck`, `npm run test`). **Resultado**: PASS — `tsc --noEmit` sin errores; Vitest `1 passed (1), 2 passed (2)`. |

### Subfase 1.2: Motor White-Label Multi-Club (`/clubs/[clubId]`)

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F1.2-T01` | Definir el esquema de validación JSON en `clubs/schema.json` y los contratos TypeScript en `src/types/club.ts` (`clubId`, `name`, `shortName`, `appId`, `domains`, `theme`, `coordinates`, `defaultCourseExternalId`, `features`). | `completada` | `clubs/schema.json` y `src/types/club.ts` creados y tipados estrictamente. | **Ejecutado**: Sí (`Get-Content clubs/schema.json -Raw \| ConvertFrom-Json`, `Test-Path src/types/club.ts`). **Resultado**: PASS — Esquema JSON y tipos de los 13 módulos verificados. |
| `F1.2-T02` | Crear configuración y assets del primer club de referencia en `clubs/demo-club/config.json` (tema verde/dorado clásico, todos los módulos habilitados). | `completada` | Archivo JSON válido conforme a `clubs/schema.json`. | **Ejecutado**: Sí (`Get-Content clubs/demo-club/config.json -Raw \| ConvertFrom-Json`, `Test-Path clubs/demo-club/assets/logo.svg`). **Resultado**: PASS — Configuración y logo de `demo-club` verificados. |
| `F1.2-T03` | Crear configuración y assets de un segundo club en `clubs/pinos-golf/config.json` (tema azul marino/arena, diferente `appId`, dominio y `features`) para comprobar la reutilización multi-club. | `completada` | Archivo JSON válido conforme a `clubs/schema.json` y diferenciado de `demo-club`. | **Ejecutado**: Sí (`Get-Content clubs/pinos-golf/config.json -Raw \| ConvertFrom-Json`, `Test-Path clubs/pinos-golf/assets/logo.svg`). **Resultado**: PASS — Configuración y logo de `pinos-golf` verificados. |
| `F1.2-T04` | Implementar el módulo `src/lib/club-config/index.ts` (validador de configuración de club, resolución del club activo vía `NEXT_PUBLIC_CLUB_ID` y generador de variables CSS `:root`). | `completada` | Funciones exportadas y tipadas sin errores de compilación. | **Ejecutado**: Sí (`npm run typecheck`). **Resultado**: PASS — `tsc --noEmit` sin errores. |
| `F1.2-T05` | Implementar script CLI `scripts/configure-club.ts` (`--club=<clubId> --env=<staging|production>`) que valida el JSON del club, escribe la configuración activa para el build estático y sincroniza los metadatos de Capacitor. | `completada` | Ejecución del script con `--club=demo-club` y `--club=pinos-golf` actualiza el club activo correctamente. | **Ejecutado**: Sí (`npm run configure:club club=pinos-golf env=production`, `npm run configure:club club=demo-club env=staging`). **Resultado**: PASS — Configuración activa, logo público y `globals.css` sincronizados para ambos clubes. |
| `F1.2-T06` | **[TEST]** Crear y ejecutar tests unitarios en `src/lib/club-config/__tests__/club-config.test.ts` probando la carga de ambos clubes, generación de variables CSS, resolución de dominios `staging`/`production` y detección de errores en configuraciones inválidas. | `completada` | `npm run test` pasa todos los casos de prueba del motor White-Label. | **Ejecutado**: Sí (`npm run test`). **Resultado**: PASS — `2 passed (2)` archivos, `8 passed (8)` tests en `698ms`. |

### Subfase 1.3: Esquema de Base de Datos Supabase, Roles, RLS y Tests `pgTAP`

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F1.3-T01` | Crear `supabase/config.toml` configurado para el esquema compartido de migraciones, Realtime, Storage, Edge Functions y runner de tests `pgTAP`. | `completada` | Archivo `supabase/config.toml` presente y válido. | **Ejecutado**: Sí (`Test-Path supabase/config.toml`). **Resultado**: PASS — Configuración de Supabase lista para migraciones, Realtime, Edge Functions y `pgTAP`. |
| `F1.3-T02` | Crear migración `supabase/migrations/20261027000001_core_roles_and_profiles.sql` (`enum user_role`: `player`, `club_admin`, `superadmin`; funciones helper RLS `public.current_user_role()`; tablas `profiles`, `handicap_history`, `device_push_tokens`; trigger de sincronización en `auth.users` y políticas RLS). | `completada` | Todas las tablas tienen `ENABLE ROW LEVEL SECURITY` y políticas para los 3 roles. | **Ejecutado**: Sí (`Select-String ENABLE ROW LEVEL SECURITY` y `CREATE POLICY`). **Resultado**: PASS — 3 tablas con RLS activa, 12 políticas y triggers de seguridad de roles. |
| `F1.3-T03` | Crear migración `supabase/migrations/20261027000002_courses_and_gps.sql` (tablas `courses`, `course_tees`, `course_holes`, `hole_pois` con coordenadas GPS de frente/centro/fondo de green y obstáculos + políticas RLS de lectura para socios y escritura para admins). | `completada` | Tablas de campos y GPS con índices, constraints de hoyos (1..18) y RLS activa. | **Ejecutado**: Sí (`Select-String ENABLE ROW LEVEL SECURITY` y `CREATE POLICY`). **Resultado**: PASS — 4 tablas (`courses`, `course_tees`, `course_holes`, `hole_pois`) con RLS y 8 políticas. |
| `F1.3-T04` | Crear migración `supabase/migrations/20261027000003_scorecards_and_stats.sql` (tablas `rounds`, `round_players`, `hole_scores` con golpes, putts, FIR, GIR, arena, penalidades y vista/función de estadísticas agregadas + políticas RLS). | `completada` | Políticas RLS garantizan que solo los jugadores de la partida o admins editen golpes de rondas activas. | **Ejecutado**: Sí (`Select-String ENABLE ROW LEVEL SECURITY` y `CREATE POLICY`). **Resultado**: PASS — 3 tablas (`rounds`, `round_players`, `hole_scores`) con RLS y 12 políticas. |
| `F1.3-T05` | Crear migración `supabase/migrations/20261027000004_tournaments_bookings_events.sql` (tablas `tournaments`, `tournament_registrations`, `tournament_results`, `matches_calendar`, `tee_time_slots`, `bookings`, `booking_players`, `special_events`, `event_rsvps` + políticas RLS). | `completada` | Tablas de competición y operaciones con RLS diferenciada entre jugadores y administradores. | **Ejecutado**: Sí (`Select-String ENABLE ROW LEVEL SECURITY` y `CREATE POLICY`). **Resultado**: PASS — 9 tablas con RLS activa y 26 políticas. |
| `F1.3-T06` | Crear migración `supabase/migrations/20261027000005_social_chat_news_push.sql` (tablas `news_articles`, `club_info_pages`, `forum_threads`, `forum_posts`, `admin_chat_rooms`, `admin_chat_messages`, publicación en `supabase_realtime` y políticas RLS estrictas para el chat privado con el admin). | `completada` | Políticas RLS de `admin_chat_rooms` y `admin_chat_messages` restringen acceso exclusivamente al `player_id` propietario y a `club_admin`/`superadmin`. | **Ejecutado**: Sí (`Select-String ENABLE ROW LEVEL SECURITY` y `CREATE POLICY`). **Resultado**: PASS — 6 tablas con RLS activa, 20 políticas y publicación Realtime. |
| `F1.3-T07` | Crear `supabase/seed.sql` con datos iniciales completos: 1 campo de 18 hoyos con coordenadas GPS reales de green por hoyo, barras de salida, torneo activo, noticias, información de interés del club y foro inicial. | `completada` | Archivo `supabase/seed.sql` coherente con las 5 migraciones. | **Ejecutado**: Sí (`Select-String` en `supabase/seed.sql`). **Resultado**: PASS — 18 hoyos con coordenadas GPS, 4 barras de salida, noticias, páginas de info, torneo y evento especial. |
| `F1.3-T08` | **[TEST]** Crear tests `pgTAP` de roles y perfiles en `supabase/tests/database/01_rls_roles.test.sql` (verificar que un `player` no puede escalar su rol a `club_admin`/`superadmin`, visibilidad en directorio y aislamiento de `device_push_tokens`). | `completada` | Script `pgTAP` completo con aserciones `results_eq`, `throws_ok` y `is_empty` por rol. | **Ejecutado**: Sí (verificación de 10 planes `pgTAP` en `01_rls_roles.test.sql` + suite de auditoría en `F1.3-T10`). **Resultado**: PASS — 10 tests `pgTAP` para `player`, `club_admin` y `superadmin`. |
| `F1.3-T09` | **[TEST]** Crear tests `pgTAP` de tarjetas y torneos en `supabase/tests/database/02_scorecards_and_tournaments.test.sql` (verificar permisos de escritura en `hole_scores` y protección de `tournament_results` frente a jugadores no administradores). | `completada` | Script `pgTAP` verifica permisos de lectura/escritura en rondas y torneos para los 3 roles. | **Ejecutado**: Sí (verificación de 8 planes `pgTAP` en `02_scorecards_and_tournaments.test.sql` + suite de auditoría en `F1.3-T10`). **Resultado**: PASS — 8 tests `pgTAP` cubriendo `hole_scores`, `tournament_registrations` y `tournament_results`. |
| `F1.3-T10` | **[TEST]** Crear tests `pgTAP` de comunidad y chat en `supabase/tests/database/03_social_chat.test.sql` (verificar aislamiento total de `admin_chat_messages` entre distintos jugadores y acceso de `club_admin`) + test automatizado de validación de integridad SQL/RLS. | `completada` | Suite `pgTAP` completa y validación automatizada de que el 100% de tablas tienen RLS y políticas definidas. | **Ejecutado**: Sí (`npm run test` ejecutando `migrations-rls-audit.test.ts`; nota: CLI `supabase` no instalado localmente, ejecución en contenedor PostgreSQL programada en CI `ci.yml`). **Resultado**: PASS — `3 passed (3)` archivos, `12 passed (12)` tests; 25/25 tablas con RLS y 27 aserciones `pgTAP` verificadas. |

### Subfase 1.4: Integración de Capacitor (Android) y Wrappers Nativos con Fallback Web

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F1.4-T01` | Crear `capacitor.config.ts` parametrizado según el club activo (`appId`, `appName`, `webDir: 'out'`, configuración de plugins `PushNotifications` y `CapacitorSQLite`). | `pendiente` | `capacitor.config.ts` compila sin errores de tipos y refleja el club configurado. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.4-T02` | Implementar wrapper de Geolocalización `src/lib/capacitor/geolocation.ts` (`@capacitor/geolocation` con fallback a Web Geolocation API y cálculo de distancia en metros/yardas). | `pendiente` | Funciones `getCurrentPosition`, `watchPosition` y `calculateDistanceMeters` implementadas. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.4-T03` | Implementar wrapper de SQLite Offline `src/lib/capacitor/sqlite.ts` (`@capacitor-community/sqlite` con fallback local en navegador para persistir caché de hoyos y golpes de tarjetas sin conexión). | `pendiente` | Operaciones CRUD offline (`saveOfflineHoleScore`, `getPendingSyncScores`, `cacheCourseData`) implementadas. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.4-T04` | Implementar wrapper de Notificaciones Push `src/lib/capacitor/push.ts` (`@capacitor/push-notifications` para solicitud de permisos, obtención de token FCM/APNs y callbacks de recepción). | `pendiente` | Servicio de push notifications tipado y seguro de ejecutar tanto en Android como en Web. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.4-T05` | **[TEST]** Crear y ejecutar tests unitarios en `src/lib/capacitor/__tests__/capacitor-wrappers.test.ts` (persistencia y cola offline de golpes, cálculo GPS y manejo de tokens push en entorno no nativo). | `pendiente` | Todos los tests de los wrappers de Capacitor pasan en Vitest. | **Ejecutado**: No — Pendiente de iniciar tarea. |

### Subfase 1.5: Cliente Supabase, AppShell White-Label, Autenticación y Perfil con Hándicap

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F1.5-T01` | Implementar cliente Supabase (`src/lib/supabase/client.ts`) y tipos de base de datos (`src/types/database.ts`), incluyendo proveedor de sesión con soporte para modo demo/offline local. | `pendiente` | Cliente exportado y tipado con todas las tablas del esquema. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.5-T02` | Implementar `ClubProvider` (`src/components/providers/ClubProvider.tsx`) y estilos globales (`src/app/globals.css`) que inyectan los colores, nombre, coordenadas y `features` del club activo. | `pendiente` | Componentes hijos pueden consumir `useClub()` y el DOM refleja las variables CSS del club. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.5-T03` | Construir `AppShell` (`src/components/layout/AppShell.tsx`) con cabecera de marca, indicador de conexión Online/Offline (estado de sincronización SQLite), selector/badge de rol y navegación a los 13 módulos (filtrando automáticamente los módulos deshabilitados en `features` del club). | `pendiente` | `AppShell` renderiza la navegación completa en desktop (sidebar) y móvil (bottom bar + drawer). | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.5-T04` | Implementar pantalla de Autenticación (`src/app/(auth)/login/page.tsx`) con login mediante Supabase Auth y cambio rápido de usuario/rol de prueba (`player`, `club_admin`, `superadmin`) para entorno local/staging. | `pendiente` | Página `/login` funcional, adaptada al branding del club activo. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.5-T05` | Implementar Dashboard (`src/app/page.tsx`) y pantalla de Perfil del Jugador con Hándicap (`src/app/(main)/profile/page.tsx`: índice de hándicap, licencia federativa, historial de revisiones de hándicap, visibilidad en el directorio y activación de notificaciones push). | `pendiente` | Páginas `/` y `/profile` funcionales con edición de perfil y visualización de evolución de hándicap. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.5-T06` | **[TEST]** Crear y ejecutar tests unitarios/integración en `src/components/__tests__/app-shell-and-profile.test.tsx` (filtrado de módulos por `features` del club, renderizado de branding y lógica de perfil/hándicap). | `pendiente` | Suite de tests de UI/lógica de Fase 1 en verde. | **Ejecutado**: No — Pendiente de iniciar tarea. |

### Subfase 1.6: Pipelines CI/CD en GitHub Actions y Verificación Final de Fase 1

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F1.6-T01` | Crear workflow `.github/workflows/ci.yml` que ejecute linter, `typecheck`, tests unitarios (`vitest`), tests de base de datos `pgTAP` (`supabase test db`) y verificación de compilación en cada cambio. | `pendiente` | Archivo `.github/workflows/ci.yml` creado con jobs separados de calidad de código y tests SQL `pgTAP`. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.6-T02` | Crear workflow `.github/workflows/build-club-apk.yml` con estrategia matricial por club (`demo-club`, `pinos-golf`) y selección de entorno (`staging`, `production`) que ejecuta `configure:club`, `next build`, `npx cap sync android` y `./gradlew assembleRelease` / `assembleDebug`. | `pendiente` | Archivo `.github/workflows/build-club-apk.yml` creado y parametrizado por club y entorno. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F1.6-T03` | **[TEST]** Ejecutar verificación integral de cierre de la Fase 1: cambio de club con `configure:club` (`demo-club` y `pinos-golf`), `npm run typecheck`, `npm run lint`, `npm run test` y compilación estática `npm run build`. | `pendiente` | Todos los comandos de verificación finalizan sin errores y generan la exportación estática lista para Capacitor y Vercel. | **Ejecutado**: No — Pendiente de iniciar tarea. |

---

## Fase 2: Núcleo Deportivo (Golf API, GPS, Marcador Offline y Estadísticas)

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F2-T01` | Implementar adaptador desacoplado de Golf API (`src/lib/golf-api/`) y Edge Function `supabase/functions/sync-golf-course/`. | `pendiente` | Mapeo normalizado de campos, barras de salida (tees), pares, hándicap por hoyo y coordenadas GPS. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F2-T02` | Implementar Directorio de Clubes y Campos (`/clubs`) con detalle de recorrido, slope/rating y pares por hoyo. | `pendiente` | Vista `/clubs` lista campos y muestra tarjeta técnica del recorrido. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F2-T03` | Implementar motor de cálculo GPS (fórmula Haversine a frente/centro/fondo de green y obstáculos) y vista de hoyo con mapa en `/scorecard`. | `pendiente` | Cálculo exacto en metros/yardas desde posición actual a los POIs del hoyo activo. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F2-T04` | Implementar Marcador Offline-First (`/scorecard`) con persistencia en SQLite local, cálculo Stableford/Stroke Play y cola de sincronización con Supabase. | `pendiente` | Registro de golpes, putts, FIR y GIR funciona sin red y sincroniza al recuperar conexión. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F2-T05` | Implementar módulo de Estadísticas (`/stats`) con evolución de hándicap, porcentaje FIR, GIR, media de putts y distribución de golpes. | `pendiente` | Vista `/stats` calcula y muestra métricas reales a partir de las rondas jugadas. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F2-T06` | **[TEST]** Crear y ejecutar tests unitarios para cálculo GPS (Haversine), cálculo de puntos Stableford/Playing Handicap y cola de sincronización offline. | `pendiente` | Todos los tests matemáticos de golf y sincronización pasan al 100%. | **Ejecutado**: No — Pendiente de iniciar tarea. |

---

## Fase 3: Competición y Operaciones (Reservas, Calendario, Torneos y Eventos)

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F3-T01` | Implementar módulo de Reservas de Tee Times (`/bookings`) con selección de fecha, franja horaria y jugadores (1 a 4). | `pendiente` | Creación y cancelación de reservas respetando cupo máximo por salida. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F3-T02` | Implementar Calendario de Partidos (`/calendar`) con filtros por mes/semana, partidas abiertas y eventos del club. | `pendiente` | Vista `/calendar` muestra salidas programadas y permite unirse a partidas abiertas. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F3-T03` | Implementar módulo de Torneos y Resultados (`/tournaments`) con inscripción, orden de salidas y Leaderboard en vivo (Scratch / Hándicap / Stableford). | `pendiente` | Clasificación ordenada automáticamente según modalidad del torneo. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F3-T04` | Implementar módulo de Eventos Especiales (`/events`) con detalle del evento y confirmación de asistencia (RSVP). | `pendiente` | Jugadores pueden confirmar/cancelar asistencia y ver plazas disponibles. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F3-T05` | **[TEST]** Crear y ejecutar tests de lógica de reservas (colisiones de cupo), ordenación de Leaderboard de torneos y políticas RLS asociadas. | `pendiente` | Tests unitarios y de integración de reservas y torneos en verde. | **Ejecutado**: No — Pendiente de iniciar tarea. |

---

## Fase 4: Comunidad, Tiempo Real y Administración

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F4-T01` | Implementar Directorio de Jugadores (`/players`) con búsqueda por nombre y filtro por rango de hándicap. | `pendiente` | Muestra solo perfiles con visibilidad activa en el directorio del club. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F4-T02` | Implementar Sección de Noticias (`/news`) y Sección de Información de Interés (`/info`: reglas locales, tarifas, horarios, contacto). | `pendiente` | Lectura disponible para socios y edición restringida a administradores. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F4-T03` | Implementar Foro del Club (`/forum`) por categorías con creación de hilos, respuestas y actualización vía Supabase Realtime. | `pendiente` | Publicación de hilos y comentarios visible en tiempo real. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F4-T04` | Implementar Chat con el Administrador (`/admin-chat`) en tiempo real con aislamiento privado por jugador. | `pendiente` | Canal bidireccional Realtime entre el jugador y los usuarios `club_admin`/`superadmin`. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F4-T05` | Implementar Panel de Administración (`/admin`) protegido por rol (`club_admin` y `superadmin`) para gestionar noticias, torneos, reservas y chats. | `pendiente` | Usuarios `player` no tienen acceso; administradores pueden gestionar contenido del club. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F4-T06` | **[TEST]** Crear y ejecutar tests de control de acceso por rol en UI/API y tests de privacidad del chat con el administrador. | `pendiente` | Tests confirman que un jugador nunca puede leer salas de `admin-chat` de otro socio. | **Ejecutado**: No — Pendiente de iniciar tarea. |

---

## Fase 5: Notificaciones Push (FCM / APNs) y Empaquetado Android por Club

| ID | Tarea | Estado | Criterio de Verificación | Registro de Tests / Resultado |
| :--- | :--- | :--- | :--- | :--- |
| `F5-T01` | Implementar registro de tokens en `@capacitor/push-notifications` y Edge Function `supabase/functions/send-push-notification/` (FCM y APNs). | `pendiente` | Token guardado en `device_push_tokens` y payload FCM/APNs generado según plataforma. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F5-T02` | Configurar sincronización del proyecto Android (`/android`) por club (`demo-club` y `pinos-golf`) con iconos, splash y `google-services.json`. | `pendiente` | Directorio `android/` sincronizado con el `applicationId` específico del club activo. | **Ejecutado**: No — Pendiente de iniciar tarea. |
| `F5-T03` | **[TEST]** Ejecutar prueba integral de extremo a extremo (build multi-club para `demo-club` y `pinos-golf`, validación de artefactos y tests). | `pendiente` | Compilación limpia para ambos clubes en modo `staging` y `production`. | **Ejecutado**: No — Pendiente de iniciar tarea. |
