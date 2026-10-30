/**
 * Tipos y contratos para el Catálogo Geográfico Nacional de Campos de Golf
 * basado en OpenStreetMap (OSM).
 *
 * Licencia de los datos:
 * Los datos procedentes de OpenStreetMap se distribuyen bajo la licencia
 * Open Database License (ODbL) 1.0 de la OpenStreetMap Foundation (OSMF).
 * Atribución obligatoria: «© OpenStreetMap contributors»
 * https://www.openstreetmap.org/copyright
 */

export type OsmGeometryType = 'node' | 'way' | 'relation';

export type CourseProvenance = 'all' | 'curated' | 'osm';

/**
 * Representación cruda de un elemento en la respuesta JSON de Overpass API.
 */
export interface OverpassRawElement {
  type: OsmGeometryType;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  bounds?: {
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
  };
  nodes?: number[];
  members?: Array<{
    type: OsmGeometryType;
    ref: number;
    role: string;
  }>;
  tags?: Record<string, string>;
}

/**
 * Estructura de respuesta de la API de Overpass.
 */
export interface OverpassRawResponse {
  version?: number;
  generator?: string;
  osm3s?: {
    timestamp_osm_base?: string;
    copyright?: string;
  };
  elements: OverpassRawElement[];
}

/**
 * Entidad normalizada de un campo de golf registrado en OpenStreetMap.
 * Cumple estrictamente la regla de NO inventar datos: los atributos ausentes en OSM
 * se mantienen como undefined o sin valor.
 */
export interface OsmGolfCourse {
  /** Identificador único para Birdie: osm-<type>-<id> */
  id: string;
  /** Identificador numérico nativo de OSM */
  osmId: number;
  /** Tipo de geometría OSM: node, way o relation */
  osmType: OsmGeometryType;
  /** Clave canónica OSM: e.g. 'node/12345', 'way/67890' */
  osmKey: string;
  /** Nombre del campo según etiqueta OSM, o etiqueta indicativa si no tiene nombre */
  name: string;
  /** Indica si el objeto OSM tenía etiqueta 'name' explícita */
  hasExplicitName: boolean;
  /** Nombre del operador o club si está presente en OSM */
  clubName?: string;
  /** Coordenadas del punto o del centro de la geometría */
  latitude: number;
  longitude: number;
  /** Número de hoyos si está mapeado en la etiqueta 'holes' */
  holesCount?: number;
  /** Par total si está mapeado en la etiqueta 'par' */
  parTotal?: number;
  /** Dirección física según etiquetas addr:* */
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  /** Datos de contacto según etiquetas contact:* o directas */
  phone?: string;
  website?: string;
  email?: string;
  /** Enlace oficial al objeto en openstreetmap.org */
  osmUrl: string;
  /** Procedencia explícita */
  provenance: 'osm';
  /** Marca de tiempo ISO de la importación */
  importedAt: string;
  /** Diccionario de etiquetas crudas preservadas */
  rawTags: Record<string, string>;
}

/**
 * Contenedor del archivo versionable local (src/data/osm-golf-courses.json).
 */
export interface OsmDatasetFile {
  schemaVersion: string;
  generator: string;
  license: string;
  attribution: string;
  importedAt: string;
  overpassInstance: string;
  elementsCount: number;
  courses: OsmGolfCourse[];
}
