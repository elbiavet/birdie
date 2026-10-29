---
name: birdie-theme
description: >-
  Guía completa y fuente única de verdad de la identidad visual de alta gama y gestión de temas (Dark / Light) en Birdie: paletas por componente con códigos HEX finales, tipografía jerarquizada, principios de composición compacta, reglas de preservación de datos reales y enlaces a las imágenes de referencia.
---

# Identidad Visual y Gestión de Temas (`birdie-theme`)

Esta skill es la **fuente única de verdad** para el diseño visual, la composición espacial, la jerarquía tipográfica y las paletas cromáticas oficiales (**Modo Oscuro** y **Modo Claro**) de la plataforma de golf white-label **Birdie**.

---

## 1. Propósito y Contexto de Uso

Birdie combina la sofisticación de los clubes de golf tradicionales de prestigio con la precisión digital moderna. La interfaz adopta una estética de panel de club compacta y estructurada en tarjetas:
- **Modo Oscuro (Club nocturno / Casa Club)**: Ambientes interiores y nocturnos con negros carbón profundos, verdes esmeralda intensos y acentos en dorado cálido.
- **Modo Claro (En Campo / Fairway Mist)**: Diseñado para legibilidad táctica bajo luz solar directa con fondos marfil cálido, cabeceras verde grisáceo y contrastes nítidos.

El sistema cuenta con un gestor reactivo (`ThemeProvider`) y variables semánticas CSS que garantizan:
1. Conmutación reactiva e instantánea entre ambos modos sin recargar la página ni romper layouts.
2. Persistencia en `localStorage` con la clave `birdie_theme_mode_v1` y detección automática de `prefers-color-scheme`.
3. Coexistencia armónica con la personalización white-label de cada club (`bg-club-primary`, `bg-club-secondary`).

---

## 2. Paletas Finales Oficiales por Componente

Los colores están asignados de forma específica y deliberada a cada componente de la interfaz para reproducir con fidelidad las capturas de referencia:

### 2.1. Modo Oscuro (Referencia: Imagen 1)

| Componente / Capa | Color o Degradado | Código HEX | Rol y Comportamiento Visual |
| :--- | :--- | :--- | :--- |
| **Fondo Exterior (Canvas)** | Negro carbón con textura sutil | `#0B0C10` | Fondo general (`body`, vista exterior con textura radial tenue a 24px). |
| **Barra Superior (Header)** | Verde profundo | `#06372D` | Barra superior baja con píldoras de telemetría y controles. |
| **Barra Lateral (Sidebar)** | Carbón profundo | `#202127` | Tarjeta flotante freestanding con bordes dorados discretos. |
| **Panel Inferior Contenedor** | Carbón profundo | `#202127` | Tarjeta contenedora de la sección *Club Ecosystem*. |
| **Panel de Bienvenida (Hero)** | Degradado verde bosque | `#064334` → `#0D3028` | Tarjeta de bienvenida destacada en verde esmeralda con borde `rgba(201, 173, 116, 0.25)` y curvas doradas sutiles en la derecha. |
| **Tarjetas de Métricas (las 4 en fila)** | Carbón suave con bordes dorados | `#19191E` → `#252329` | Las 4 tarjetas de KPIs WHS en una única fila horizontal. |
| **Tarjetas de Acciones (las 3 principales)** | Carbón suave con bordes dorados | `#19191E` → `#252329` | Tarjetas de *Iniciar Vuelta*, *Reservar Salida* y *Mi Perfil*. |
| **Tarjetas de Módulos (Ecosistema)** | Verde bosque intenso | `#0C3029` → `#104238` | Tarjetas modulares dentro del panel inferior, sin adornos artificiales. |
| **Acento Dorado Metálico Brillante** | Oro cálido con degradado sutil de alto lujo | `#D4BA80` → `#E6D4A7` → `#C9AD74` → `#BA9C61` | Botones de acción rápida, avatar de club y elemento activo (`Inicio`), con reflejo champán cálido y suave, sin destellos blancos ni contraste agresivo. |
| **Texto Destacado / Títulos** | Champán claro | `#E4D3AC` | Títulos principales, valores numéricos de métricas y nombres. |
| **Texto General / Contenido** | Arena dorado | `#D5C7A5` | Etiquetas de botones, descripciones de acciones y datos. |
| **Texto Secundario / Metadatos** | Verde salvia tenue | `#92A99E` | Leyendas, subtítulos federativos, horas y estados secundarios. |

---

### 2.2. Modo Claro (Referencia: Imagen 2)

| Componente / Capa | Color o Degradado | Código HEX | Rol y Comportamiento Visual |
| :--- | :--- | :--- | :--- |
| **Fondo Exterior (Canvas)** | Marfil cálido | `#F7F3EA` | Lienzo general exterior diurno. |
| **Barra Superior (Header)** | Verde grisáceo claro | `#DCE6DD` | Barra superior baja con pastillas en blanco cálido `#FCFAF5`. |
| **Barra Lateral y Paneles** | Blanco cálido | `#FCFAF5` | Barra lateral flotante y tarjeta contenedora inferior. |
| **Panel de Bienvenida (Hero)** | Degradado champán oro / arena dorada | `#F2ECE0` → `#E9DECA` → `#DECBA4` | Tarjeta destacada con degradado dorado cálido continuo, borde fino oro mate `rgba(197, 160, 89, 0.45)`, curvas doradas áureas (`#C5A059`) y pastilla GPS translúcida. |
| **Tarjetas de Métricas (Hero)** | Blanco marfil con bordes dorados | `#FFFFFF` | Las 4 métricas WHS dentro del hero con fondo blanco marfil puro, bordes `rgba(197, 160, 89, 0.35)` y sombra cálida. |
| **Tarjetas de Acciones Principales** | Blanco marfil con bordes dorados | `#FFFDF6` | Tarjetas de *Iniciar Vuelta*, *Reservar Salida* y *Mi Perfil* con bordes `rgba(169, 138, 85, 0.3)`. |
| **Tarjetas de Módulos (Ecosistema)** | Verde salvia suave | `#D8E4D9` | Tarjetas modulares dentro del panel inferior. |
| **Acento Dorado Metálico Brillante** | Oro champán con degradado sutil de alto lujo | `#BEA16D` → `#D4BE92` → `#AC8E58` → `#9C7E4A` | Botones de acción rápida, avatar de club y elemento activo de navegación, con reflejo luminoso suave y bisel fino, sin estridencias. |
| **Texto Principal y Nav Activo** | Verde corporativo profundo | `#0A3A2A` | Títulos principales, elemento activo, cifras e iconos clave. |
| **Texto Secundario / Metadatos** | Verde salvia apagado | `#52665B` | Subtítulos, metadatos, leyendas y etiquetas secundarias. |

---

## 3. Tipografía y Reglas Estrictas de Pesos

Se utiliza **Inter** como tipografía principal, con **Montserrat** y `sans-serif` como alternativas de respaldo.

### Escala y Jerarquía de Pesos:
- **Bold (`font-bold`, peso 700)**:
  - Títulos de primer y segundo nivel (`h1`, `h2`, `Bienvenido, Carlos Mendoza`).
  - Cifras y valores principales de métricas (`11.4`, `12`, `14`).
  - Botones de acción rápida y texto de la píldora activa de navegación.
  - Nombre oficial del club en la cabecera.
- **Medium / Semi-Bold (`font-medium` 500 / `font-semibold` 600)**:
  - Etiquetas descriptivas superiores de las tarjetas de métricas (`HÁNDICAP EXACTO`, etc.).
  - Píldoras de estado (`Online · Supabase Sync`, `HCP 11.4`, `DEMO CLUB`).
  - Títulos de tarjetas modulares secundarias.
- **Regular (`font-normal`, peso 400)**:
  - Textos descriptivos de tarjetas de acciones y párrafos explicativos.
  - Subtítulos institucionales y licencias federativas.
  - Textos de navegación secundaria inactiva.

---

## 4. Composición, Escala Compacta y Detalles Visuales

La interfaz sigue una cuadrícula estructurada y compacta para evitar vacíos desproporcionados:

1. **Barra Superior Baja (Low-Profile Header)**:
   - Altura compacta (`py-2.5 px-4`), con logo distintivo cuadrado de esquinas redondeadas (`rounded-2xl`).
   - Todos los controles (estado online, handicap, selectores de club/rol, conmutador de tema y acceso) adoptan forma de cápsula redondeada completa (`rounded-full`).
2. **Barra Lateral Flotante (Sidebar)**:
   - Tarjeta freestanding separada del lienzo con esquinas muy redondeadas (`rounded-3xl`) y sombra suave.
   - **Ítem Activo (`Inicio` y módulos)**: Píldora redondeada completa (`rounded-full`) con degradado dorado metálico refinado (`linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)`, borde `#DFCB9E`) y texto oscuro contrastado (`#0B0C10`, 700 bold) en Dark, y en Light (`linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)`, borde `#CCB88E`).
3. **Regla Universal de Cabeceras (`.hero-banner-luxury`) en Todas las Páginas**:
   - **Obligatorio para toda página**: La sección superior de bienvenida o encabezado de módulo (`/`, `/scorecard`, `/stats`, `/bookings`, `/calendar`, `/tournaments`, `/events`, `/players`, `/clubs`, `/news`, `/info`, `/forum`, `/admin-chat`, `/profile`, `/login`) debe usar la clase `.hero-banner-luxury` con curvas SVG sutiles en la esquina derecha.
   - **Modo Oscuro**: Degradado verde bosque esmeralda profundo (`#064334` → `#0D3028`), borde `rgba(201, 173, 116, 0.25)`, título `#E4D3AC`, subtítulo `#92A99E`.
   - **Modo Claro**: Degradado champán dorado continuo (`#F2ECE0` → `#E9DECA` → `#DECBA4`), borde oro mate `rgba(197, 160, 89, 0.45)`, título `#0A3A2A`, subtítulo `#42584A`.
4. **Regla Universal de Botones de Acción Dorados (`.btn-gold-gradient`)**:
   - **Obligatorio en todos los sitios donde se use dorado**: Todo botón de acción primaria, selector activo o badge dorado debe incorporar el degradado metálico direccional con brillo lujoso y suave.
   - **Calibración de contraste y luminosidad**:
     - **Prohibido** convertir el dorado en un color plano o mate; debe mantener siempre su degradado a 135° y sensación tridimensional metálica.
     - **Prohibido** usar destellos casi blancos (`#FFF8E7`, `#FDF7E7`) o efectos cromados estridentes.
     - La transición entre claros y oscuros se reduce a un delta controlado (~22% de variación de luminancia), empleando reflejos champán cálidos (`#E6D4A7` en Dark, `#D4BE92` en Light) y sombras doradas sutiles (`#BA9C61` en Dark, `#9C7E4A` en Light).
   - Texto siempre en negro carbón `#0B0C10` en negrita 700, borde fino `#DFCB9E` (Dark) / `#CCB88E` (Light) y sombra dorada sutil `0 4px 14px rgba(201, 173, 116, 0.22)` (Dark) / `rgba(169, 138, 85, 0.18)` (Light).
5. **Regla Universal de Tarjetas (`.card-luxury`)**:
   - Las tarjetas de contenido, métricas y formularios deben usar `.card-luxury`, que provee esquinas redondeadas (`rounded-2xl` o `rounded-3xl`), fondo carbón `#19191E`→`#252329` con borde oro `rgba(201, 173, 116, 0.2)` en Dark, y blanco marfil puro `#FFFFFF` con borde oro `rgba(197, 160, 89, 0.35)` y sombra cálida en Light.
6. **Regla de Ausencia de Adornos Artificiales**:
   - **Prohibido** añadir wireframes geométricos, ilustraciones poligonales o hileras de píldoras accesorias que no formen parte de las referencias visuales aprobadas.
   - **Prohibido** volver a hardcodear colores antiguos (`#16382A`, `#0F241B`, `#08130E`, `#F4F6F4`, `#A38332`, `#D4AF37`) directamente en componentes.

---

## 5. Reglas de Preservación de Datos, Textos y Navegación

> [!IMPORTANT]
> **Las imágenes de referencia son únicamente guías de diseño y estética**, nunca una fuente literal para sobreescribir datos del sistema.

Todo agente o desarrollador que modifique la interfaz debe cumplir rigurosamente estas reglas:
1. **Preservar los datos reales del usuario y del club**: Conservar los nombres de jugador (`profile.fullName`), licencias federativas (`profile.federationLicense`), índices de hándicap calculados (`profile.handicapIndex`, Playing Handicap WHS) y telemetría GPS del club (`club.coordinates`).
2. **Preservar la navegación completa**: Mantener operativas las 14 rutas del ecosistema de Birdie (`/`, `/scorecard`, `/stats`, `/bookings`, `/calendar`, `/tournaments`, `/events`, `/players`, `/clubs`, `/news`, `/info`, `/forum`, `/admin-chat`, `/profile`), respetando los permisos de rol (`player`, `club_admin`, `superadmin`).
3. **Preservar la arquitectura White-Label**: No hardcodear nombres o IDs de club; todo debe provenir de `ClubProvider` y `config.json`.

---

## 6. Imágenes de Referencia Oficiales

Los archivos de referencia de diseño se encuentran preservados en el repositorio:

- **Modo Oscuro (Imagen 1)**: [`docs/brand/reference-dark.jpg`](../../../docs/brand/reference-dark.jpg)
  - Muestra la composición con cabecera verde `#06372D`, fondo exterior carbón `#0B0C10`, barra lateral `#202127`, hero verde esmeralda con arcos dorados, tarjetas carbón con botones dorados `#C9AD74` y panel inferior con tarjetas verdes.
- **Modo Claro (Imagen 2)**: [`docs/brand/reference-light.jpg`](../../../docs/brand/reference-light.jpg)
  - Muestra la composición diurna con fondo marfil `#F7F3EA`, cabecera verde grisáceo `#DCE6DD`, tarjetas blanco marfil `#FFFDF6` con botones dorados `#A98A55` y tarjetas de módulos en salvia `#D8E4D9`.
- **Detalle Hero Dorado en Modo Claro (Imagen 3)**: [`docs/brand/reference-welcome-gold.jpg`](../../../docs/brand/reference-welcome-gold.jpg)
  - Muestra la tarjeta de bienvenida con degradado champán dorado (`#F2ECE0` → `#E9DECA` → `#DECBA4`), curvas áureas elegantes, píldora GPS translúcida y las 4 tarjetas de métricas en blanco puro con bordes dorados discretos.

---

## 7. Plantilla Oficial para Nuevas Páginas y Componentes

Al añadir una nueva página o componente en la aplicación, se debe seguir esta estructura oficial garantizada:

```tsx
import React from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Flag, Sparkles } from 'lucide-react';

export default function ExamplePage() {
  const { club } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      {/* 1. Cabecera Hero Oficial: .hero-banner-luxury */}
      <section className="hero-banner-luxury relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-colors">
        {/* Curvas sutiles de fondo */}
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20 dark:opacity-15"
          viewBox="0 0 400 200"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 200 C 150 180, 250 80, 400 0 L 400 200 Z"
            fill="url(#example-hero-gold)"
          />
          <defs>
            <linearGradient id="example-hero-gold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9AD74" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#E6D4A7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#BA9C61" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
              <Flag className="h-3.5 w-3.5" />
              Sección Oficial · {club.name}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)]">
              Título del Módulo
            </h1>
            <p className="text-sm font-normal text-[var(--theme-text-secondary)]">
              Subtítulo explicativo con la funcionalidad del módulo.
            </p>
          </div>

          {/* Botón de acción con degradado dorado metálico */}
          <button
            type="button"
            className="btn-gold-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Acción Principal
          </button>
        </div>
      </section>

      {/* 2. Tarjetas de Contenido Oficiales: .card-luxury */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <article className="card-luxury rounded-2xl border p-6 shadow-sm transition">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
            Métrica Oficial
          </span>
          <h3 className="mt-1 text-base font-bold text-[var(--theme-text-primary)]">
            Tarjeta de Información
          </h3>
          <p className="mt-2 text-xs font-normal leading-relaxed text-[var(--theme-text-secondary)]">
            Texto explicativo y detalles del módulo.
          </p>
        </article>
      </div>
    </div>
  );
}
```
