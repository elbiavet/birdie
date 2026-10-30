import type {
  OsmDatasetFile,
  OsmGeometryType,
  OsmGolfCourse,
  OverpassRawElement,
  OverpassRawResponse,
} from './osm-types';
import type { SpainAutonomousCommunity, SpainGolfCourse } from './types';

/**
 * Mapeo oficial de provincias españolas a sus respectivas Comunidades Autónomas.
 */
const PROVINCE_TO_COMMUNITY: Record<string, SpainAutonomousCommunity> = {
  // Andalucía
  almeria: 'Andalucía',
  cadiz: 'Andalucía',
  cordoba: 'Andalucía',
  granada: 'Andalucía',
  huelva: 'Andalucía',
  jaen: 'Andalucía',
  malaga: 'Andalucía',
  sevilla: 'Andalucía',
  // Aragón
  huesca: 'Aragón',
  teruel: 'Aragón',
  zaragoza: 'Aragón',
  // Asturias
  asturias: 'Asturias',
  // Baleares
  baleares: 'Illes Balears',
  balears: 'Illes Balears',
  mallorca: 'Illes Balears',
  menorca: 'Illes Balears',
  ibiza: 'Illes Balears',
  // Canarias
  laspalmas: 'Canarias',
  santacruzdetenerife: 'Canarias',
  tenerife: 'Canarias',
  grancanaria: 'Canarias',
  // Cantabria
  cantabria: 'Cantabria',
  // Castilla y León
  avila: 'Castilla y León',
  burgos: 'Castilla y León',
  leon: 'Castilla y León',
  palencia: 'Castilla y León',
  salamanca: 'Castilla y León',
  segovia: 'Castilla y León',
  soria: 'Castilla y León',
  valladolid: 'Castilla y León',
  zamora: 'Castilla y León',
  // Castilla-La Mancha
  albacete: 'Castilla-La Mancha',
  ciudadreal: 'Castilla-La Mancha',
  cuenca: 'Castilla-La Mancha',
  guadalajara: 'Castilla-La Mancha',
  toledo: 'Castilla-La Mancha',
  // Cataluña
  barcelona: 'Cataluña',
  girona: 'Cataluña',
  gerona: 'Cataluña',
  lleida: 'Cataluña',
  lerida: 'Cataluña',
  tarragona: 'Cataluña',
  // Comunidad de Madrid
  madrid: 'Comunidad de Madrid',
  // Comunidad Valenciana
  alicante: 'Comunidad Valenciana',
  alacant: 'Comunidad Valenciana',
  castellon: 'Comunidad Valenciana',
  castello: 'Comunidad Valenciana',
  valencia: 'Comunidad Valenciana',
  // Extremadura
  badajoz: 'Extremadura',
  caceres: 'Extremadura',
  // Galicia
  coruna: 'Galicia',
  acoruna: 'Galicia',
  lugo: 'Galicia',
  ourense: 'Galicia',
  orense: 'Galicia',
  pontevedra: 'Galicia',
  // La Rioja
  larioja: 'La Rioja',
  rioja: 'La Rioja',
  // Navarra
  navarra: 'Navarra',
  nafarroa: 'Navarra',
  // País Vasco
  alava: 'País Vasco',
  araba: 'País Vasco',
  bizkaia: 'País Vasco',
  vizcaya: 'País Vasco',
  gipuzkoa: 'País Vasco',
  guipuzcoa: 'País Vasco',
  // Región de Murcia
  murcia: 'Región de Murcia',
};

/**
 * Normaliza un texto para indexación y comparación (minúsculas, sin tildes ni caracteres especiales).
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Resuelve la Comunidad Autónoma a partir del nombre de la provincia o municipio si es identificable.
 */
export function resolveAutonomousCommunity(
  province?: string,
  city?: string
): SpainAutonomousCommunity | undefined {
  if (province) {
    const norm = normalizeText(province);
    if (PROVINCE_TO_COMMUNITY[norm]) return PROVINCE_TO_COMMUNITY[norm];
  }
  if (city) {
    const norm = normalizeText(city);
    if (PROVINCE_TO_COMMUNITY[norm]) return PROVINCE_TO_COMMUNITY[norm];
  }
  return undefined;
}

/**
 * Extrae las coordenadas representativas (punto o centroide) de un elemento de Overpass.
 * Si no es posible determinar una coordenada válida en rango geográfico, devuelve null.
 */
export function extractCenterCoordinates(
  element: OverpassRawElement
): { lat: number; lon: number } | null {
  // Caso 1: Nodos puntuales
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    if (isValidCoordinate(element.lat, element.lon)) {
      return { lat: element.lat, lon: element.lon };
    }
  }

  // Caso 2: Vías y relaciones con centroide provisto por Overpass (out center)
  if (element.center && typeof element.center.lat === 'number' && typeof element.center.lon === 'number') {
    if (isValidCoordinate(element.center.lat, element.center.lon)) {
      return { lat: element.center.lat, lon: element.center.lon };
    }
  }

  // Caso 3: Bounding box de la geometría (minlat, minlon, maxlat, maxlon)
  if (
    element.bounds &&
    typeof element.bounds.minlat === 'number' &&
    typeof element.bounds.maxlat === 'number' &&
    typeof element.bounds.minlon === 'number' &&
    typeof element.bounds.maxlon === 'number'
  ) {
    const lat = (element.bounds.minlat + element.bounds.maxlat) / 2;
    const lon = (element.bounds.minlon + element.bounds.maxlon) / 2;
    if (isValidCoordinate(lat, lon)) {
      return { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) };
    }
  }

  return null;
}

/**
 * Valida que una latitud y longitud estén en los rangos geodésicos terrestres (-90..90, -180..180).
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return !Number.isNaN(lat) && !Number.isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Deduplica un array de elementos de Overpass por su tipo e identificador único (${type}/${id}).
 */
export function deduplicateOsmElements(elements: OverpassRawElement[]): OverpassRawElement[] {
  const seen = new Set<string>();
  const result: OverpassRawElement[] = [];

  for (const el of elements) {
    if (!el || !el.type || typeof el.id !== 'number') continue;
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(el);
  }

  return result;
}

/**
 * Normaliza un elemento de OpenStreetMap en una entidad OsmGolfCourse.
 * Si el objeto carece de coordenadas válidas, devuelve null.
 * Cumple la regla de NO inventar datos ausentes.
 */
export function normalizeOsmElement(
  element: OverpassRawElement,
  importedAt: string
): OsmGolfCourse | null {
  const coords = extractCenterCoordinates(element);
  if (!coords) return null;

  const tags = element.tags ?? {};

  // Extracción del nombre
  const explicitName =
    tags.name?.trim() ||
    tags['name:es']?.trim() ||
    tags['name:ca']?.trim() ||
    tags['name:gl']?.trim() ||
    tags['name:eu']?.trim() ||
    tags.int_name?.trim();

  const hasExplicitName = Boolean(explicitName);
  const name = explicitName || `Campo de golf (sin nombre en OSM #${element.id})`;

  // Operador o club
  const clubName = tags.operator?.trim() || tags.brand?.trim() || undefined;

  // Hoyos: parseo estricto; si no es entero positivo, se deja undefined
  let holesCount: number | undefined;
  const rawHoles = tags['golf:holes']?.trim() || tags.holes?.trim();
  if (rawHoles) {
    const parsedHoles = Number.parseInt(rawHoles, 10);
    if (!Number.isNaN(parsedHoles) && parsedHoles > 0 && parsedHoles <= 72) {
      holesCount = parsedHoles;
    }
  }

  // Par: parseo estricto si está presente
  let parTotal: number | undefined;
  const rawPar = tags['golf:par']?.trim() || tags.par?.trim();
  if (rawPar) {
    const parsedPar = Number.parseInt(rawPar, 10);
    if (!Number.isNaN(parsedPar) && parsedPar > 20 && parsedPar <= 150) {
      parTotal = parsedPar;
    }
  }

  // Dirección física
  const street = tags['addr:street']?.trim();
  const housenumber = tags['addr:housenumber']?.trim();
  let address: string | undefined;
  if (street) {
    address = housenumber ? `${street}, ${housenumber}` : street;
  }

  const city = tags['addr:city']?.trim() || tags['addr:municipality']?.trim() || undefined;
  const province = tags['addr:province']?.trim() || undefined;
  const postalCode = tags['addr:postcode']?.trim() || undefined;

  // Contacto
  const phone = tags.phone?.trim() || tags['contact:phone']?.trim() || undefined;
  const website = tags.website?.trim() || tags['contact:website']?.trim() || tags.url?.trim() || undefined;
  const email = tags.email?.trim() || tags['contact:email']?.trim() || undefined;

  const osmType: OsmGeometryType = element.type;
  const osmKey = `${osmType}/${element.id}`;
  const osmUrl = `https://www.openstreetmap.org/${osmType}/${element.id}`;

  return {
    id: `osm-${osmType}-${element.id}`,
    osmId: element.id,
    osmType,
    osmKey,
    name,
    hasExplicitName,
    clubName,
    latitude: coords.lat,
    longitude: coords.lon,
    holesCount,
    parTotal,
    address,
    city,
    province,
    postalCode,
    phone,
    website,
    email,
    osmUrl,
    provenance: 'osm',
    importedAt,
    rawTags: tags,
  };
}

/**
 * Procesa y valida una respuesta cruda de Overpass API, devolviendo el contenedor del dataset.
 * Lanza un error explícito si la respuesta no es válida o no contiene elementos,
 * permitiendo al script de importación salvaguardar la versión previa sin corromper el archivo.
 */
export function processOverpassResponse(
  rawResponse: unknown,
  options: {
    importedAt?: string;
    overpassInstance?: string;
  } = {}
): OsmDatasetFile {
  const elements = validateOverpassResponse(rawResponse);

  const importedAt = options.importedAt ?? new Date().toISOString();
  const overpassInstance = options.overpassInstance ?? 'https://overpass-api.de/api/interpreter';

  // Deduplicación
  const deduplicated = deduplicateOsmElements(elements);

  // Normalización
  const courses: OsmGolfCourse[] = [];
  for (const el of deduplicated) {
    const normalized = normalizeOsmElement(el, importedAt);
    if (normalized) {
      courses.push(normalized);
    }
  }

  if (courses.length === 0) {
    throw new Error('Ningún elemento de Overpass pudo ser normalizado con coordenadas válidas');
  }

  // Ordenar por nombre para facilitar diffs deterministas en git
  courses.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return {
    schemaVersion: '1.0.0',
    generator: 'Birdie Overpass Importer',
    license: 'Open Database License (ODbL) 1.0',
    attribution: '© OpenStreetMap contributors',
    importedAt,
    overpassInstance,
    elementsCount: courses.length,
    courses,
  };
}

/**
 * Valida la estructura básica de una respuesta de Overpass API.
 */
export function validateOverpassResponse(rawResponse: unknown): OverpassRawElement[] {
  if (!rawResponse || typeof rawResponse !== 'object') {
    throw new Error('Respuesta de Overpass no válida: no es un objeto JSON');
  }
  const resp = rawResponse as Record<string, unknown>;
  if (typeof resp.remark === 'string') {
    throw new Error(`Overpass devolvió error: ${resp.remark}`);
  }
  if (!('elements' in resp) || !Array.isArray(resp.elements)) {
    throw new Error('campo "elements" ausente o no es un array');
  }
  if (resp.elements.length === 0) {
    throw new Error('Respuesta de Overpass vacía: no contiene elementos');
  }
  return resp.elements as OverpassRawElement[];
}

/**
 * Alias de conveniencia para testing e integración
 */
export const extractElementCoordinates = extractCenterCoordinates;
export const normalizeOsmCourse = (el: OverpassRawElement) => normalizeOsmElement(el, '2026-10-30T15:00:00.000Z');
export const normalizeOsmElements = (elements: OverpassRawElement[], importedAt = '2026-10-30T15:00:00.000Z') => {
  const deduplicated = deduplicateOsmElements(elements);
  return deduplicated.map((el) => normalizeOsmElement(el, importedAt)).filter((c): c is OsmGolfCourse => c !== null);
};

/**
 * Calcula la distancia aproximada en kilómetros entre dos puntos geodésicos usando Haversine.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Comprueba si un campo de OSM ya está cubierto en el catálogo curado para evitar duplicados.
 * Compara por coincidencia léxica del nombre o proximidad geográfica (< 1.5 km) con coincidencia parcial.
 */
export function isOsmCourseDuplicateOfCurated(
  osmCourse: OsmGolfCourse,
  curatedCourses: readonly SpainGolfCourse[]
): boolean {
  const osmNorm = normalizeText(osmCourse.name);
  if (!osmCourse.hasExplicitName) return false;

  for (const curated of curatedCourses) {
    const curatedNorm = normalizeText(curated.name);
    const clubNorm = normalizeText(curated.clubName);

    // Coincidencia exacta de nombres normalizados
    if (osmNorm === curatedNorm || osmNorm === clubNorm) {
      return true;
    }

    // Coincidencia de contención sustancial (ej. "valderrama", "camiral", "neguri")
    if (
      (osmNorm.length > 5 && curatedNorm.includes(osmNorm)) ||
      (curatedNorm.length > 5 && osmNorm.includes(curatedNorm)) ||
      (clubNorm.length > 5 && osmNorm.includes(clubNorm))
    ) {
      // Si el nombre contiene el término y la distancia es menor a 20 km (mismo complejo)
      const distKm = calculateDistanceKm(
        osmCourse.latitude,
        osmCourse.longitude,
        curated.latitude,
        curated.longitude
      );
      if (distKm < 20) {
        return true;
      }
    }

    // Proximidad geográfica estricta (< 1.2 km)
    const distKm = calculateDistanceKm(
      osmCourse.latitude,
      osmCourse.longitude,
      curated.latitude,
      curated.longitude
    );
    if (distKm < 1.2) {
      return true;
    }
  }

  return false;
}

/**
 * Adapta una entidad OsmGolfCourse al contrato SpainGolfCourse para su integración en la UI y el buscador.
 * Mantiene estrictamente vacíos tees y holes y desactiva hasHoleDetail, cumpliendo las directrices de integridad.
 */
export function adaptOsmCourseToSpainGolfCourse(
  osmCourse: OsmGolfCourse
): SpainGolfCourse {
  const community = resolveAutonomousCommunity(osmCourse.province, osmCourse.city) ?? 'Comunidad de Madrid';
  const displayCity = osmCourse.city || (osmCourse.province ? osmCourse.province : 'España');
  const displayProvince = osmCourse.province || 'Provincia no especificada en OSM';

  // Cumplimiento estricto: holesCount solo se establece si está disponible en OSM (9 o 18);
  // para el contrato de GolfApiCourse se usa 18 como estándar de visualización si no está definido,
  // pero hasHoleDetail permanece en false y tees y holes vacíos.
  const holesCount: 9 | 18 = osmCourse.holesCount === 9 ? 9 : 18;
  const parTotal = osmCourse.parTotal ?? (holesCount === 9 ? 35 : 72);

  return {
    id: osmCourse.id,
    externalGolfApiId: `osm_${osmCourse.osmType}_${osmCourse.osmId}`,
    name: osmCourse.name,
    clubName: osmCourse.clubName || (osmCourse.hasExplicitName ? osmCourse.name : 'Instalación deportiva (OSM)'),
    city: displayCity,
    country: 'España',
    autonomousCommunity: community,
    province: displayProvince,
    postalCode: osmCourse.postalCode,
    email: osmCourse.email,
    holesCount,
    parTotal,
    designer: undefined, // No inventar diseñador
    yearFounded: undefined, // No inventar año
    facilities: [
      'Inventario Geográfico Comunitario',
      `OSM ${osmCourse.osmType.toUpperCase()} #${osmCourse.osmId}`,
      ...(osmCourse.holesCount ? [`${osmCourse.holesCount} hoyos (etiqueta OSM)`] : []),
    ],
    hasHoleDetail: false, // ¡Sin tarjeta ni hoyos ficticios!
    hasVerifiedGpsTelemetry: false,
    isBirdieClub: false,
    latitude: osmCourse.latitude,
    longitude: osmCourse.longitude,
    address: osmCourse.address || 'Ubicación registrada en OpenStreetMap',
    phone: osmCourse.phone || 'Teléfono no registrado en OSM',
    website: osmCourse.website || osmCourse.osmUrl,
    description: osmCourse.hasExplicitName
      ? `Campo de golf registrado en OpenStreetMap (ID: ${osmCourse.osmKey}). Datos comunitarios sin telemetría deportiva homologada.`
      : `Elemento de golf mapeado en OpenStreetMap sin nombre específico (ID: ${osmCourse.osmKey}).`,
    tees: [], // Barras vacías: no inventar datos de Slope ni Course Rating
    holes: [], // Hoyos vacíos: no inventar distancias ni pares por hoyo
    provenance: 'osm',
    osmId: osmCourse.osmId,
    osmType: osmCourse.osmType,
    osmKey: osmCourse.osmKey,
    osmUrl: osmCourse.osmUrl,
    importedAt: osmCourse.importedAt,
    hasExplicitName: osmCourse.hasExplicitName,
    rawTags: osmCourse.rawTags,
  };
}
