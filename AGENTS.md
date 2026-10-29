# AGENTS.md — Guía Operativa y Flujo de Trabajo para Agentes

## 1. Contexto del Proyecto (`Birdie`)
**Birdie** es una plataforma de golf **white-label (marca blanca)** en un único repositorio que permite desplegar aplicaciones web y nativas (Android APK/AAB mediante Capacitor) personalizadas por club:
- **Frontend / App**: Next.js (App Router compatible con exportación estática `output: 'export'` para el APK y despliegue en Vercel).
- **Empaquetado Nativo y Offline**: Capacitor (Android) con plugins `@capacitor/geolocation` (GPS en el campo), `@capacitor-community/sqlite` (marcador y datos de hoyos offline-first) y `@capacitor/push-notifications` (FCM / APNs).
- **Backend por Club**: Un proyecto Supabase por club (con entornos separados `staging` y `production`), compartiendo el mismo esquema de migraciones PostgreSQL, Realtime, Storage y Edge Functions.
- **Seguridad y Calidad de Datos**: Row Level Security (RLS) basada en roles (`player`, `club_admin`, `superadmin`) verificada con tests automatizados en **pgTAP**.
- **Datos de Campos**: Integración desacoplada con **Golf API** y caché en Supabase/SQLite.
- **CI/CD**: GitHub Actions (linters y tests en cada cambio + workflow matricial que compila una app por club).

---

## 2. Flujo Obligatorio de Planificación y Seguimiento

Antes de implementar cualquier funcionalidad, corrección o cambio arquitectónico, **todo agente debe cumplir estrictamente estas 5 reglas**:

1. **Dividir el trabajo en fases ordenadas y tareas pequeñas, concretas y verificables**:
   - Ninguna funcionalidad debe abordarse como un bloque monolítico.
   - Cada tarea debe tener un alcance acotado y un criterio de verificación claro (archivos creados/modificados, comando de validación o comportamiento comprobable).

2. **Guardar el plan en `BACKLOG.md` con estado explícito por tarea**:
   - Antes de escribir código de una nueva funcionalidad, registra o actualiza su desglose en [`BACKLOG.md`](./BACKLOG.md).
   - Respeta siempre el formato existente de `BACKLOG.md` y evita duplicar tareas.
   - Cada tarea debe tener exactamente uno de los siguientes estados:
     - `pendiente`
     - `en curso`
     - `completada`

3. **Actualizar `BACKLOG.md` en tiempo real y verificar antes de completar**:
   - Marca la tarea como `en curso` en `BACKLOG.md` **al empezarla**.
   - Marca la tarea como `completada` **únicamente después de haberla implementado y verificado**.
   - **Prohibido** marcar como `completada` cualquier tarea cuya compilación, ejecución o prueba no haya sido verificada (si existe un bloqueo de entorno, mantenla `en curso` o `pendiente` y documenta el bloqueo).

4. **Incluir tareas de tests y registrar su ejecución y resultado**:
   - Toda fase o funcionalidad debe incluir tareas específicas de pruebas (tests unitarios/integración, tests `pgTAP` para RLS/SQL, validación de esquemas o compilación).
   - En la columna/sección de registro de pruebas de `BACKLOG.md`, documenta:
     - **Ejecutado**: `Sí` / `No` / `Bloqueado`
     - **Comando utilizado**: El comando real del proyecto (no inventar comandos que no existan en `package.json` o en la configuración del repositorio).
     - **Resultado**: Salida resumida (ej. `PASS (12/12 tests)`, `FAIL`, o motivo del bloqueo).

5. **Resumen obligatorio al finalizar**:
   - Al terminar cada intervención o fase, entrega un resumen estructurado indicando:
     - **Qué se completó** (y cómo se verificó).
     - **Qué queda pendiente** (siguientes tareas en `BACKLOG.md`).
     - **Cualquier bloqueo o supuesto** detectado en el entorno o en las dependencias.

---

## 2B. Revisión Obligatoria de Cierre de Fase

Al terminar cada fase de [`BACKLOG.md`](./BACKLOG.md), **antes de dar la fase por cerrada**, es obligatorio ejecutar una revisión de cierre cumpliendo estos 5 puntos:

1. **Auditoría contra criterios de aceptación**: Compara el trabajo realizado con cada tarea y criterio de verificación de la fase en `BACKLOG.md`. Actualiza el estado real de cada tarea y no marques como `completada` ninguna tarea que tenga requisitos parciales o sin verificar.
2. **Cobertura de tests por cambio de comportamiento**: Comprueba que cada cambio de comportamiento implementado cuenta con un test automatizado adecuado. Añade o actualiza los tests que falten, ejecútalos y registra comando y resultado en `BACKLOG.md`. Si algún comportamiento no puede probarse automáticamente en el entorno local (ej. hardware nativo Android o demonio Docker/`supabase` CLI no instalado), documenta explícitamente por qué y cómo se verificó.
3. **Documentación y separación entre Reglas (`AGENTS.md`) y Skills (`.agents/skills/`)**:
   - Mantén en `AGENTS.md` las **reglas generales y permanentes** del proyecto.
   - Coloca en la skill del proyecto ([`.agents/skills/birdie-workflows/SKILL.md`](./.agents/skills/birdie-workflows/SKILL.md)) las **instrucciones detalladas paso a paso** de flujos de trabajo reutilizables (alta de clubes white-label, creación de migraciones con RLS/`pgTAP`, y checklist de cierre de fase), evitando duplicar contenido o añadir información no confirmada.
4. **Integridad del Backlog**: Si la revisión detecta trabajo faltante, añádelo como tarea explícita en `BACKLOG.md` y no cierres la fase hasta resolverlo o dejar claramente registrado el bloqueo.
5. **Informe de Cierre de Fase**: Entrega un resumen final detallando qué se revisó, qué tests pasaron o fallaron, qué se actualizó en `AGENTS.md`, en las skills y en `BACKLOG.md`, y dictamina si la fase queda formalmente cerrada.

---

## 3. Convenciones de Código y Git

- **Commits pequeños y ramas cortas**: Cada tarea o subgrupo lógico verificable debe corresponder a un commit atómico y descriptivo (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
- **Aislamiento White-Label**: Prohibido hardcodear nombres de clubes, colores, dominios o IDs de paquete Android dentro de `src/`. Todo debe leerse desde `/clubs/<clubId>/config.json` y variables de entorno.
- **Seguridad por Defecto (RLS)**: Ninguna tabla en el esquema `public` de Supabase puede crearse sin `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` y sus respectivas políticas para `player`, `club_admin` y `superadmin`, acompañadas de su test en `supabase/tests/database/`.
- **Cobertura por Cambio de Comportamiento**: Toda función exportada de dominio (`src/lib/`), Edge Function (`supabase/functions/`) y pantalla nueva en `src/app/` debe contar con verificaciones automatizadas en Vitest (incluyendo casos de error/bordes y renderizado SSR dentro de `ClubProvider`).

---

## 4. Comandos de Prueba y Verificación del Proyecto

> **Regla**: No inventes comandos de prueba. Revisa siempre `package.json` y `supabase/config.toml` antes de ejecutar tests. Para procedimientos paso a paso consulta la skill [`.agents/skills/birdie-workflows/SKILL.md`](./.agents/skills/birdie-workflows/SKILL.md).

### Estado Actual Confirmado en el Repositorio
- **Comandos oficiales registrados en `package.json`**:
  - `npm run typecheck`: Ejecuta `tsc --noEmit`.
  - `npm run test`: Ejecuta `vitest run` (tests unitarios, integración y auditoría estática de migraciones SQL/RLS/`pgTAP`).
  - `npm run lint`: Ejecuta `next lint`.
  - `npm run prebuild`: Ejecuta `tsx scripts/configure-club.ts` (invocado automáticamente por npm antes de `npm run build` en entornos de CI/CD como Vercel para resolver el club activo según variables de entorno).
  - `npm run build`: Ejecuta `next build` (con exportación estática `output: 'export'` en `out/`).
  - `npm run build:apk`: Ejecuta `CAPACITOR_BUILD=true next build`.
  - `npm run configure:club`: Ejecuta `tsx scripts/configure-club.ts` (acepta `club=<clubId> env=<staging|production>` o `--club=<clubId> --env=<staging|production>`).
  - `npm run verify:supabase`: Ejecuta `tsx scripts/verify-supabase.ts` (genera `supabase/full-setup.sql` y verifica en vivo contra el proyecto Supabase configurado en `.env.local` las semillas con UUIDs reales, la RPC `sync_golf_course_atomic`, los triggers `FOR UPDATE` de aforo y las políticas RLS de `hole_scores`).
  - `npm run cap:sync`: Ejecuta `cap sync android`.
- **Entorno local y limitaciones confirmadas**:
  - `git` (`2.45.1.windows.1`) está disponible; operaciones de escritura en `.git/` y `git push` requieren `BypassSandbox: true` en este entorno Windows.
  - Los comandos de Node/npm (`npm`, `npx`, `tsc`, `vitest`) requieren `BypassSandbox: true` porque `node.exe` está gestionado por NVM for Windows fuera del directorio del proyecto.
  - El CLI local `supabase` no está instalado en la máquina Windows local: la validación de cobertura RLS (25/25 tablas) y paridad de planes `pgTAP` se ejecuta localmente con `npm run test` (`migrations-rls-audit.test.ts`), mientras que `supabase test db` se ejecuta contra PostgreSQL real en GitHub Actions (`.github/workflows/ci.yml`).
