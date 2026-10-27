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

## 3. Convenciones de Código y Git

- **Commits pequeños y ramas cortas**: Cada tarea o subgrupo lógico verificable debe corresponder a un commit atómico y descriptivo (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
- **Aislamiento White-Label**: Prohibido hardcodear nombres de clubes, colores, dominios o IDs de paquete Android dentro de `src/`. Todo debe leerse desde `/clubs/<clubId>/config.json` y variables de entorno.
- **Seguridad por Defecto (RLS)**: Ninguna tabla en el esquema `public` de Supabase puede crearse sin `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` y sus respectivas políticas para `player`, `club_admin` y `superadmin`, acompañadas de su test en `supabase/tests/database/`.

---

## 4. Comandos de Prueba y Verificación del Proyecto

> **Regla**: No inventes comandos de prueba. Revisa siempre `package.json` y `supabase/config.toml` antes de ejecutar tests.

### Estado Actual Descubierto en el Repositorio
- **Comandos oficiales registrados en `package.json` (`F1.1-T02`)**:
  - `npm run typecheck`: Ejecuta `tsc --noEmit`.
  - `npm run test`: Ejecuta `vitest run`.
  - `npm run lint`: Ejecuta `next lint`.
  - `npm run build`: Ejecuta `next build` (con exportación estática `output: 'export'` por defecto).
  - `npm run configure:club`: Ejecuta `tsx scripts/configure-club.ts` (pendiente de implementar en `F1.2-T05`).
  - `npm run cap:sync`: Ejecuta `cap sync android`.
- **Supuestos y entorno local detectados**:
  - `git` (`2.45.1.windows.1`) está disponible en el entorno.
  - Los comandos de Node/npm (`npm`, `npx`, `tsc`, `vitest`) requieren ejecución fuera del sandbox (`BypassSandbox: true`) debido a que `node.exe` reside en NVM for Windows fuera del directorio del proyecto.
  - `supabase/config.toml` se inicializará en la tarea `F1.3-T01`.
