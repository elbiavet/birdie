---
name: birdie-workflows
description: >-
  Procedimientos detallados y reutilizables del proyecto Birdie para: (1) dar de alta o cambiar la configuración white-label de un club de golf, (2) añadir migraciones SQL de Supabase con políticas RLS y tests pgTAP, y (3) ejecutar la revisión de cierre de fase en BACKLOG.md. Úsala siempre que trabajes en alta de clubes, cambios de base de datos o cierres de fase.
---

# Flujos de Trabajo Reutilizables de Birdie (`birdie-workflows`)

Esta skill contiene las instrucciones operativas paso a paso para los tres flujos de trabajo recurrentes del proyecto **Birdie**. Las reglas generales y permanentes residen en [`AGENTS.md`](../../../AGENTS.md).

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
   - Comprueba que cada función o flujo nuevo tenga su test en `__tests__/`.
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
