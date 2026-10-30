# Guía de Despliegue en Vercel — Birdie White-Label

Esta guía describe el procedimiento paso a paso para desplegar **Birdie** en [Vercel](https://vercel.com), aprovechando la arquitectura Next.js 15 App Router y el motor multi-club de marca blanca (*white-label*).

---

## 1. Arquitectura y Compatibilidad en Vercel

Birdie está diseñado para ejecutarse en Vercel con máxima eficiencia:
- **Prebuild automatizado**: El script `prebuild` (`npm run prebuild`) se ejecuta automáticamente antes de `next build`. Lee `NEXT_PUBLIC_CLUB_ID` y genera el branding, colores CSS y assets del club activo.
- **Exportación estática optimizada**: Con `output: 'export'` por defecto, Vercel distribuye las 24 rutas del proyecto directamente en su red global Edge CDN (cero latencia de inicio en frío, 100% de fiabilidad para clubes de golf).
- **Modo servidor opcional**: Si se define `NEXT_OUTPUT_MODE=server`, la app compila en modo SSR / Serverless Functions si se requiere renderizado dinámico en servidor.
- **Cabeceras de seguridad**: Configuradas automáticamente en `vercel.json` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, etc.).

---

## 2. Estrategia Multi-Club en Vercel (White-Label)

Dado que Birdie es un monorepo white-label, puedes alojar infinitos clubes desde el mismo repositorio de GitHub creando un **proyecto de Vercel por cada club**:

| Club | Proyecto en Vercel | Dominio sugerido | Variable `NEXT_PUBLIC_CLUB_ID` |
| :--- | :--- | :--- | :--- |
| **Real Club Valle Verde** | `birdie-valleverde` | `valleverde.birdie.app` o propio | `demo-club` |
| **Señorío de Illescas Golf & Padel** | `birdie-senorioillescas` | `app.senoriodeillescasgolf.com` o `staging.illescas.birdie.app` | `senorio-illescas` |

Cada proyecto en Vercel apunta al mismo repositorio de GitHub (`elbiavet/birdie`), pero define sus propias **Environment Variables** en Vercel Dashboard.

---

## 3. Método 1: Despliegue vía Vercel Dashboard + GitHub (Recomendado)

Este método habilita **CI/CD continuo**: cada vez que hagas `git push` a `main`, Vercel compilará y actualizará la aplicación automáticamente.

### Paso 1: Subir los cambios a GitHub
Asegúrate de que tus últimos commits estén en tu repositorio remoto:
```bash
git push origin main
```

### Paso 2: Importar el repositorio en Vercel
1. Inicia sesión en [vercel.com](https://vercel.com).
2. Haz clic en **"Add New..."** → **"Project"**.
3. En la lista de repositorios de GitHub, busca y selecciona **`birdie`** (o `elbiavet/birdie`).
4. Haz clic en **"Import"**.

### Paso 3: Configurar el proyecto
En la pantalla de configuración de Vercel:
- **Project Name**: Asigna el nombre del club (ej. `birdie-valleverde` o `birdie-senorioillescas`).
- **Framework Preset**: Detectará automáticamente **Next.js**.
- **Root Directory**: Déjalo en `./` (raíz).
- **Build and Output Settings**:
  - *Build Command*: Déjalo por defecto (`npm run build`). Nuestro hook `prebuild` se ejecutará automáticamente.
  - *Output Directory*: Detectado automáticamente por Next.js (`out` o `.next`).

### Paso 4: Añadir Variables de Entorno (Environment Variables)
Despliega la sección **Environment Variables** y añade las siguientes claves:

| Variable | Valor de ejemplo | Entornos requeridos |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_CLUB_ID` | `demo-club` (o `senorio-illescas`) | Production, Preview, Development |
| `NEXT_PUBLIC_APP_ENV` | `production` (o `staging`) | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJh...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJh...` *(opcional para Edge)* | Production |
| `GOLF_API_PROVIDER` | `golfapi_io` | Production, Preview, Development |
| `GOLF_API_BASE_URL` | `https://api.golfapi.io/v1` | Production, Preview, Development |
| `GOLF_API_KEY` | `tu-api-key` | Production, Preview, Development |

*(Si aún estás probando sin Supabase en vivo, puedes omitir las claves de Supabase o usar valores demo: la aplicación arrancará en modo demo local/offline con datos de prueba de alta fidelidad).*

### Paso 5: Desplegar
Haz clic en **"Deploy"**. Vercel compilará la aplicación en ~1-2 minutos y te proporcionará una URL pública (ej. `birdie-valleverde.vercel.app`).

---

## 4. Método 2: Despliegue directo mediante Vercel CLI

Si prefieres desplegar directamente desde tu terminal local:

### 1. Iniciar sesión en Vercel
```bash
npx vercel login
```
*(Sigue las instrucciones en el navegador para autorizar la sesión).*

### 2. Vincular el proyecto
```bash
npx vercel link
```
Selecciona tu cuenta o equipo y confirma si deseas vincular a un proyecto existente o crear uno nuevo (ej. `birdie-valleverde`).

### 3. Configurar variables de entorno desde la CLI
```bash
npx vercel env add NEXT_PUBLIC_CLUB_ID
# Introduce 'demo-club' o 'senorio-illescas' y selecciona Production, Preview y Development

npx vercel env add NEXT_PUBLIC_APP_ENV
# Introduce 'production'
```

### 4. Desplegar
- **Despliegue de Preview / Staging**:
  ```bash
  npx vercel
  ```
- **Despliegue a Producción**:
  ```bash
  npx vercel --prod
  ```

---

## 5. Asignación de Dominio Personalizado

Para asociar el dominio oficial de cada club (ej. `socios.valleverde.es` o `app.senoriodeillescasgolf.com`):
1. Ve a tu proyecto en Vercel → **Settings** → **Domains**.
2. Escribe tu dominio y pulsa **"Add"**.
3. Configura los registros DNS según te indique Vercel:
   - Registro `CNAME` apuntando a `cname.vercel-dns.com`.
   - O registro `A` apuntando a `76.76.21.21`.
4. Vercel aprovisionará automáticamente el certificado SSL Let's Encrypt gratuito en segundos.

---

## 6. Verificación Post-Despliegue

Una vez completado el despliegue, verifica los siguientes puntos en la URL generada:
1. **Branding del club**: Comprueba que el logo y colores correspondan al club activo (`NEXT_PUBLIC_CLUB_ID`).
2. **Navegación**: Comprueba que las rutas `/scorecard`, `/clubs`, `/bookings`, `/tournaments`, `/events`, `/profile` carguen limpiamente.
3. **Modo Oscuro / Claro**: Pulsa el conmutador de tema en el header y valida la persistencia.
4. **Offline First**: Abre DevTools, activa modo *Offline* en Network y verifica que el marcador de hoyos y el GPS simulado siguen funcionando.
