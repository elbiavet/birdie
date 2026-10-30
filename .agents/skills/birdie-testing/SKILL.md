---
name: birdie-testing
description: >-
  Guía práctica de pruebas y validación del proyecto Birdie: elección de comandos de verificación según el cambio, mapa de las suites Vitest existentes y diagnóstico de fallos, distinguiendo entornos locales, remotos (Supabase Cloud) y de CI (GitHub Actions). Úsala al seleccionar qué pruebas ejecutar, interpretar sus salidas o auditar la cobertura real.
---

# Pruebas y Validación en Birdie (`birdie-testing`)

Esta skill contiene las pautas para **elegir qué pruebas ejecutar**, **entender e interpretar sus resultados** y **distinguir el alcance de cada entorno de verificación** en **Birdie**.

- **Reglas operativas generales, ciclo de estados y convenciones**: Consulta [`AGENTS.md`](../../../AGENTS.md).
- **Procedimientos paso a paso de desarrollo**:
  - Para la creación de tablas, RLS y tests de base de datos, consulta [`birdie-workflows` Flujo 2](../birdie-workflows/SKILL.md).
  - Para la revisión de cierre de fase y auditoría de SSR sin duplicar layouts, consulta [`birdie-workflows` Flujo 3](../birdie-workflows/SKILL.md).
  - Para la lógica offline, sincronización y ciclo de vida de la caché SQLite, consulta [`birdie-workflows` Flujo 4](../birdie-workflows/SKILL.md).

---

## 1. Selección del Comando según el Cambio Realizado

Usa el comando más rápido y acotado durante el ciclo de edición y la batería completa antes de cerrar una tarea o fase (respetando las consideraciones de entorno en Windows descritas en [`AGENTS.md` §4](../../../AGENTS.md)):

| Qué se modificó | Comando recomendado | Propósito y comportamiento |
| :--- | :--- | :--- |
| Tipos TypeScript, interfaces o contratos | `npm run typecheck` | Ejecuta `tsc --noEmit`. No requiere red ni conexión a base de datos. |
| Función o componente de un módulo específico | `npx vitest run <ruta-archivo>` | Ejecución aislada y rápida de una única suite (ej. `npx vitest run src/lib/scoring/__tests__/scoring-and-sync.test.ts`). |
| Cambio funcional, SQL o antes de completar una tarea en `BACKLOG.md` | `npm run test` | Ejecuta `vitest run` sobre las 11 suites del repositorio (unitarias, integración y auditoría estática). |
| Esquema SQL, triggers `FOR UPDATE`, RPCs o políticas RLS en vivo | `npm run verify:supabase` | Regenera `supabase/full-setup.sql` y valida contra el proyecto Supabase real configurado en `.env.local`. |
| Nuevas páginas en `src/app/` o configuración de clubes | `npm run build` (o `npm run build:apk`) | Valida la exportación estática de Next.js en `out/`. Requiere limpiar `.next` previamente si hay rutas nuevas (ver [`birdie-workflows` Flujo 3](../birdie-workflows/SKILL.md)). |

---

## 2. Diferenciación de Entornos: Local vs. Supabase Cloud vs. GitHub Actions

Para no asumir capacidades inexistentes, distingue estrictamente qué verifica cada entorno:

1. **Local sin red (`npm run typecheck`, `npm run test`, `npm run build`)**:
   - `vitest` corre en entorno `node` ([`vitest.config.ts`](../../../vitest.config.ts)).
   - **Aislamiento de `.env.local`**: Vitest no carga automáticamente las variables de `.env.local`. Por diseño, `isSupabaseConfigured()` evalúa a `false` durante los tests unitarios para garantizar que sean reproducibles y no muten datos en la nube. Si una función admite cliente Supabase, las pruebas unitarias inyectan mocks o `customClient: null` para verificar el modo local/demo.
2. **Local contra Supabase Cloud (`npm run verify:supabase`)**:
   - Script [`scripts/verify-supabase.ts`](../../../scripts/verify-supabase.ts) que lee `.env.local` de forma explícita.
   - Requiere acceso de red y credenciales activas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
   - Prueba las tablas, RPCs y triggers en vivo creando y limpiando registros temporales en bloques `finally`.
3. **GitHub Actions CI (`.github/workflows/ci.yml`)**:
   - **PostgreSQL 15 efímero con Docker**: El job `supabase-pgtap` utiliza `supabase db start` y ejecuta `supabase test db` contra un motor PostgreSQL real (configurado en [`supabase/config.toml`](../../../supabase/config.toml)).
   - **Matriz Multi-Club Android**: Compila los APKs nativos con Gradle y JDK 17 en runners Ubuntu ([`.github/workflows/build-club-apk.yml`](../../../.github/workflows/build-club-apk.yml)).

---

## 3. Mapa de Suites Vitest Existentes y Cobertura Real

A fecha actual, el proyecto cuenta exactamente con **14 suites de pruebas activas** (117 tests en total) en `src/**/__tests__/`. La cobertura debe describirse siempre en base al estado implementado, sin atribuir cobertura de subfases futuras:

1. **`src/lib/club-config/__tests__/club-config.test.ts` (9 tests)**: Registro de clubes (`demo-club`, `senorio-illescas`), validación de esquemas, variables CSS de tema y correspondencia con la matriz CI.
2. **`src/lib/golf-api/__tests__/golf-api.test.ts` (6 tests)**: Catálogo de recorridos, coordenadas GPS de greens, filtros de búsqueda, totales de 9 y 18 hoyos y normalizador compartido.
3. **`src/lib/scoring/__tests__/scoring-and-sync.test.ts` (5 tests)**: Distribución de golpes WHS en 9 y 18 hoyos, puntuación Stableford, clasificación respecto al par y sincronización con control de revisiones.
4. **`src/lib/theme/__tests__/theme-manager.test.ts` (4 tests)**: Alternancia de temas Dark/Light, persistencia y consistencia de clases y variables visuales.
5. **`src/lib/community/__tests__/community-and-admin.test.ts` (17 tests)**:
   - *Cobertura actual*: Subfase 4.1 (Directorio `/players`: privacidad de perfiles y filtros por hándicap), Subfase 4.2 (Noticias `/news` e Información `/info`: control de permisos `player` vs `club_admin` y renderizado SSR), Subfase 4.3 (Foro `/forum`: categorías, debates fijados, control RLS de debates cerrados `isLocked`, Realtime y renderizado SSR), Subfase 4.4 (Chat de administración `/admin-chat`: aislamiento privado 1-a-1 por jugador, prohibición de intrusión cruzada RLS, Realtime y renderizado SSR), y Subfase 4.5 (Panel de administración `/admin`: guardias de acceso `assertAdminRole`, cálculo de KPIs y renderizado SSR con bloqueo 403 para jugadores).
   - *Nota sobre alcance*: Toda la lógica y pantallas de comunidad y administración (4.1 a 4.5) se encuentran completamente cubiertas por pruebas automatizadas.
6. **`src/components/__tests__/app-shell-and-profile.test.tsx` (8 tests)**: Navegación por rol en `AppShell`, rutas alias de inicio (`/en/home/`, etc.), perfil de usuario y verificación de no-duplicación estructural de layouts.
7. **`src/lib/competition/__tests__/competition-and-operations.test.ts` (7 tests)**: Reservas de tee times (control de cupos 1..4 y franjas bloqueadas), calendario de partidas, clasificación de torneos y eventos especiales (Fase 3).
8. **`src/lib/supabase/__tests__/migrations-rls-audit.test.ts` (5 tests)**: Auditoría estática de integridad de las 5 migraciones SQL, habilitación obligatoria de RLS en las 25 tablas y concordancia de planes `pgTAP`.
9. **`src/lib/stats/__tests__/stats-analyzer.test.ts` (5 tests)**: Cálculo de estadísticas de juego (FIR %, GIR %, Scrambling %, Sand Saves y medias por Par).
10. **`src/lib/capacitor/__tests__/capacitor-wrappers.test.ts` (9 tests)**: Wrappers de geolocalización GPS, base de datos SQLite offline-first (Android nativo y fallback web), y registro/persistencia de tokens push.
11. **`src/lib/push/__tests__/push-dispatcher.test.ts` (8 tests)**: Validación de parámetros, normalización de payloads FCM v1 (Android/Web) y APNs (iOS), detección de tokens revocados y guardias de rol.
12. **`src/lib/capacitor/__tests__/push-notifications.test.tsx` (11 tests)**: Suite integral de notificaciones push cubriendo ciclo de vida de tokens, fallback seguro, payloads multi-plataforma y renderizado SSR en `/profile` y `/admin`.
13. **`src/lib/__tests__/env.test.ts` (2 tests)**: Detección y valores por defecto del entorno de ejecución.
14. **`src/components/__tests__/role-authorization-and-simulator.test.tsx` (19 tests)**: Control de acceso por rol y restricción estricta del simulador al superadmin autenticado, ocultación de `club.appId` a `player` y `club_admin`, rechazo lógico ante llamadas no autorizadas a `setRole`, resistencia a manipulaciones en `localStorage`, autenticación en modo demo y renderizado homogéneo de pantallas para los tres roles.

---

## 4. Diagnóstico e Interpretación de Fallos Comunes

Cuando una prueba falle, utiliza esta guía para identificar la causa raíz antes de alterar código:

- **Fallo en `migrations-rls-audit.test.ts` (`El número de aserciones en ... no coincide con SELECT plan(N)`)**:
  - *Causa*: Se modificó un archivo `.test.sql` en `supabase/tests/database/` añadiendo o quitando aserciones sin actualizar el valor `N` en `SELECT plan(N);`.
  - *Solución*: Ajusta el plan al número exacto de sentencias `SELECT is(...)`, `throws_ok(...)`, etc. según el procedimiento de [`birdie-workflows` Flujo 2](../birdie-workflows/SKILL.md).
- **Fallo en `migrations-rls-audit.test.ts` (`Falta ENABLE ROW LEVEL SECURITY en public.<tabla>`)**:
  - *Causa*: Se creó una tabla en las migraciones pero falta la directiva de RLS o su entrada en `EXPECTED_PUBLIC_TABLES`.
- **Fallo de SSR en componentes (`expected 2 to be 1` en `<header>` o `<aside>`)**:
  - *Causa*: La nueva página en `src/app/` incluyó `<AppShell>` en su JSX de forma redundante cuando ya está montado en `src/app/layout.tsx`.
  - *Solución*: Elimina `<AppShell>` del JSX de la página y mantén la envoltura solo en el test (ver [`birdie-workflows` Flujo 3](../birdie-workflows/SKILL.md)).
- **Fallo en pruebas de cola offline o marcadores (datos residuales de tests previos)**:
  - *Causa*: No se limpió el almacén en memoria entre tests.
  - *Solución*: Asegura la llamada a `clearOfflineStore()` en `beforeEach` (ver [`birdie-workflows` Flujo 4](../birdie-workflows/SKILL.md)).
- **Error TS18048 / TS2532 en `npm run typecheck` (`is possibly undefined`)**:
  - *Causa*: Acceso directo a propiedades opcionales del club (ej. `club.contact?.phone`).
  - *Solución*: Emplear encadenamiento opcional y coalescencia nula (`?? '—'`).

---

## 5. Particularidades y Puntos No Confirmados en el Repositorio

- **`npm run lint` (`next lint`)**: Declarado en `package.json`, pero no cuenta con archivo de configuración (`.eslintrc*` o `eslint.config.*`) ni se ejecuta en `.github/workflows/ci.yml`. No debe incluirse en gates automáticos locales hasta formalizar su configuración.
- **`supabase/config.toml` frente al entorno local Windows**: Contiene la configuración de puertos y semillas para el CLI de Supabase, pero este no se encuentra instalado localmente. Las pruebas `pgTAP` en contenedor corresponden exclusivamente a GitHub Actions (`ci.yml`).
