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
| **Panel de Bienvenida (Hero)** | Degradado verde bosque | `#064334` → `#0D3028` | Tarjeta de bienvenida destacada con curvas doradas sutiles en la derecha. |
| **Tarjetas de Métricas (las 4 en fila)** | Carbón suave con bordes dorados | `#19191E` → `#252329` | Las 4 tarjetas de KPIs WHS en una única fila horizontal. |
| **Tarjetas de Acciones (las 3 principales)** | Carbón suave con bordes dorados | `#19191E` → `#252329` | Tarjetas de *Iniciar Vuelta*, *Reservar Salida* y *Mi Perfil*. |
| **Tarjetas de Módulos (Ecosistema)** | Verde bosque intenso | `#0C3029` → `#104238` | Tarjetas modulares dentro del panel inferior, sin adornos artificiales. |
| **Acento Dorado Cálido** | Oro cálido metálico | `#C9AD74` | Bordes discretos, botones de acción, iconos y elemento activo (`Inicio`). |
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
| **Panel de Bienvenida (Hero)** | Degradado beige arena | `#F0EBDD` → `#E8E3D4` | Tarjeta destacada con curvas suaves en bronce dorado. |
| **Tarjetas de Métricas y Acciones** | Blanco marfil con bordes dorados | `#FFFDF6` | Tarjetas de métricas y acciones con bordes `rgba(169, 138, 85, 0.3)`. |
| **Tarjetas de Módulos (Ecosistema)** | Verde salvia suave | `#D8E4D9` | Tarjetas modulares dentro del panel inferior. |
| **Acento Dorado / Bronce** | Bronce dorado | `#A98A55` | Bordes dorados suaves, botones e indicadores. |
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
   - **Ítem Activo (`Inicio`)**: Píldora redondeada completa (`rounded-full`) con degradado dorado metálico (`linear-gradient(135deg, #C9AD74 0%, #B8995E 100%)`) y texto oscuro contrastado (`#0B0C10`, 700 bold) en Dark, y verde `#0A3A2A` con texto blanco cálido en Light.
3. **Panel de Bienvenida (Welcome Hero)**:
   - Tarjeta destacada (`rounded-3xl`) con degradado suave.
   - **Curvas Lineales Doradas**: Arcos elípticos amplios y elegantes trazados en el cuadrante superior derecho con trazo dorado suave (`#C9AD74` al 45% de opacidad en Dark, `#A98A55` en Light).
   - **Fila de 4 Métricas**: Dispuestas estrictamente en una única fila horizontal de 4 columnas (`grid-cols-2 md:grid-cols-4 gap-3`), con tarjetas internas redondeadas (`rounded-2xl`) y bordes dorados discretos.
4. **Tres Tarjetas de Acciones Rápidas**:
   - Distribución en 3 columnas iguales (`grid-cols-1 md:grid-cols-3 gap-5`).
   - Cada tarjeta contiene: icono circular temático (`Flag`, `CalendarClock`, `Award`), título en 700 bold, subtítulo en dos líneas y un **botón dorado de ancho completo** con texto en negrita.
5. **Panel Inferior del Ecosistema del Club**:
   - Tarjeta contenedora carbón `#202127` (Dark) o blanco cálido `#FCFAF5` (Light).
   - Aloja exactamente 3 tarjetas modulares (`Calendario Partidos`, `Torneos Especiales`, `Mi Perfil y Hándicap WHS`) en verde bosque `#0C3029`→`#104238` (Dark) o salvia `#D8E4D9` (Light).
6. **Regla de Ausencia de Adornos Artificiales**:
   - **Prohibido** añadir wireframes geométricos, ilustraciones poligonales o hileras de píldoras accesorias que no formen parte de las referencias visuales aprobadas.

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

---

## 7. Plantilla para Nuevos Componentes

Al añadir una nueva tarjeta o vista que deba alinearse con esta identidad:

```tsx
import React from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function LuxuryCard({
  title,
  metric,
  description,
}: {
  title: string;
  metric: string;
  description: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <article
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #19191E 0%, #252329 100%)'
          : '#FFFDF6',
        borderColor: isDark
          ? 'rgba(201, 173, 116, 0.25)'
          : 'rgba(169, 138, 85, 0.3)',
      }}
      className="rounded-3xl p-6 border shadow-sm transition"
    >
      <span
        style={{ color: isDark ? '#92A99E' : '#52665B' }}
        className="text-[11px] font-semibold uppercase tracking-wider"
      >
        Métrica Oficial
      </span>
      <h3
        style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
        className="text-xl font-bold mt-1"
      >
        {title}
      </h3>
      <div
        style={{ color: isDark ? '#E4D3AC' : '#0A3A2A' }}
        className="text-2xl font-bold mt-2"
      >
        {metric}
      </div>
      <p
        style={{ color: isDark ? '#D5C7A5' : '#52665B' }}
        className="text-xs font-normal mt-2 leading-relaxed"
      >
        {description}
      </p>
    </article>
  );
}
```
