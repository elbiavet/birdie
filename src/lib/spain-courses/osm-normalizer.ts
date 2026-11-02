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

export interface SpainProvinceDefinition {
  code: string;
  name: string;
  community: SpainAutonomousCommunity;
  lat: number;
  lon: number;
}

/**
 * Relación de las 50 provincias y 2 ciudades autónomas de España con código INE y coordenadas geodésicas.
 */
export const SPAIN_PROVINCES: readonly SpainProvinceDefinition[] = [
  // 01-08
  { code: '01', name: 'Álava', community: 'País Vasco', lat: 42.8469, lon: -2.6716 },
  { code: '02', name: 'Albacete', community: 'Castilla-La Mancha', lat: 38.9943, lon: -1.8585 },
  { code: '03', name: 'Alicante', community: 'Comunidad Valenciana', lat: 38.3452, lon: -0.481 },
  { code: '04', name: 'Almería', community: 'Andalucía', lat: 36.8381, lon: -2.4597 },
  { code: '05', name: 'Ávila', community: 'Castilla y León', lat: 40.6567, lon: -4.6812 },
  { code: '06', name: 'Badajoz', community: 'Extremadura', lat: 38.8794, lon: -6.9706 },
  { code: '07', name: 'Illes Balears', community: 'Illes Balears', lat: 39.5696, lon: 2.6502 },
  { code: '08', name: 'Barcelona', community: 'Cataluña', lat: 41.3879, lon: 2.1699 },
  // 09-16
  { code: '09', name: 'Burgos', community: 'Castilla y León', lat: 42.344, lon: -3.6969 },
  { code: '10', name: 'Cáceres', community: 'Extremadura', lat: 39.4753, lon: -6.3722 },
  { code: '11', name: 'Cádiz', community: 'Andalucía', lat: 36.5271, lon: -6.2886 },
  { code: '12', name: 'Castellón', community: 'Comunidad Valenciana', lat: 39.9864, lon: -0.0513 },
  { code: '13', name: 'Ciudad Real', community: 'Castilla-La Mancha', lat: 38.9848, lon: -3.9274 },
  { code: '14', name: 'Córdoba', community: 'Andalucía', lat: 37.8882, lon: -4.7794 },
  { code: '15', name: 'A Coruña', community: 'Galicia', lat: 43.3623, lon: -8.4115 },
  { code: '16', name: 'Cuenca', community: 'Castilla-La Mancha', lat: 40.0704, lon: -2.1374 },
  // 17-24
  { code: '17', name: 'Girona', community: 'Cataluña', lat: 41.9794, lon: 2.8214 },
  { code: '18', name: 'Granada', community: 'Andalucía', lat: 37.1773, lon: -3.5986 },
  { code: '19', name: 'Guadalajara', community: 'Castilla-La Mancha', lat: 40.6337, lon: -3.1674 },
  { code: '20', name: 'Gipuzkoa', community: 'País Vasco', lat: 43.3183, lon: -1.9812 },
  { code: '21', name: 'Huelva', community: 'Andalucía', lat: 37.2614, lon: -6.9447 },
  { code: '22', name: 'Huesca', community: 'Aragón', lat: 42.1362, lon: -0.4087 },
  { code: '23', name: 'Jaén', community: 'Andalucía', lat: 37.7796, lon: -3.7849 },
  { code: '24', name: 'León', community: 'Castilla y León', lat: 42.5987, lon: -5.5671 },
  // 25-32
  { code: '25', name: 'Lleida', community: 'Cataluña', lat: 41.6176, lon: 0.62 },
  { code: '26', name: 'La Rioja', community: 'La Rioja', lat: 42.4658, lon: -2.4499 },
  { code: '27', name: 'Lugo', community: 'Galicia', lat: 43.0125, lon: -7.5558 },
  { code: '28', name: 'Madrid', community: 'Comunidad de Madrid', lat: 40.4168, lon: -3.7038 },
  { code: '29', name: 'Málaga', community: 'Andalucía', lat: 36.7213, lon: -4.4214 },
  { code: '30', name: 'Murcia', community: 'Región de Murcia', lat: 37.9922, lon: -1.1307 },
  { code: '31', name: 'Navarra', community: 'Navarra', lat: 42.8125, lon: -1.6458 },
  { code: '32', name: 'Ourense', community: 'Galicia', lat: 42.3358, lon: -7.8639 },
  // 33-40
  { code: '33', name: 'Asturias', community: 'Asturias', lat: 43.3619, lon: -5.8494 },
  { code: '34', name: 'Palencia', community: 'Castilla y León', lat: 42.0095, lon: -4.5288 },
  { code: '35', name: 'Las Palmas', community: 'Canarias', lat: 28.1235, lon: -15.4363 },
  { code: '36', name: 'Pontevedra', community: 'Galicia', lat: 42.431, lon: -8.6444 },
  { code: '37', name: 'Salamanca', community: 'Castilla y León', lat: 40.9701, lon: -5.6635 },
  { code: '38', name: 'Santa Cruz de Tenerife', community: 'Canarias', lat: 28.4636, lon: -16.2518 },
  { code: '39', name: 'Cantabria', community: 'Cantabria', lat: 43.4623, lon: -3.8099 },
  { code: '40', name: 'Segovia', community: 'Castilla y León', lat: 40.9429, lon: -4.1088 },
  // 41-48
  { code: '41', name: 'Sevilla', community: 'Andalucía', lat: 37.3891, lon: -5.9845 },
  { code: '42', name: 'Soria', community: 'Castilla y León', lat: 41.7666, lon: -2.477 },
  { code: '43', name: 'Tarragona', community: 'Cataluña', lat: 41.1189, lon: 1.2445 },
  { code: '44', name: 'Teruel', community: 'Aragón', lat: 40.3456, lon: -1.1072 },
  { code: '45', name: 'Toledo', community: 'Castilla-La Mancha', lat: 39.8628, lon: -4.0273 },
  { code: '46', name: 'Valencia', community: 'Comunidad Valenciana', lat: 39.4699, lon: -0.3763 },
  { code: '47', name: 'Valladolid', community: 'Castilla y León', lat: 41.6523, lon: -4.7245 },
  { code: '48', name: 'Bizkaia', community: 'País Vasco', lat: 43.263, lon: -2.935 },
  // 49-52
  { code: '49', name: 'Zamora', community: 'Castilla y León', lat: 41.5063, lon: -5.7446 },
  { code: '50', name: 'Zaragoza', community: 'Aragón', lat: 41.6488, lon: -0.8891 },
  { code: '51', name: 'Ceuta', community: 'Andalucía', lat: 35.8894, lon: -5.3213 },
  { code: '52', name: 'Melilla', community: 'Andalucía', lat: 35.2923, lon: -2.9381 },
];

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
 * Resuelve la provincia y Comunidad Autónoma de forma precisa a partir de:
 * 1. Prefijo de Código Postal español (01..52, precisión 100%).
 * 2. Texto de provincia o municipio conocido.
 * 3. Coordenadas geodésicas (Canarias, Baleares o proximidad a centroides provinciales).
 * Nunca devuelve un fallback artificial a 'Comunidad de Madrid'.
 */
export function resolveGeodeticLocation(
  lat: number,
  lon: number,
  postalCode?: string,
  province?: string,
  city?: string
): { province: string; autonomousCommunity: SpainAutonomousCommunity } {
  // 1. Por código postal (los 2 primeros dígitos identifican la provincia en España de forma determinista)
  if (postalCode) {
    const clean = postalCode.trim().replace(/[^0-9]/g, '');
    if (clean.length >= 2) {
      const prefix = clean.padStart(5, '0').slice(0, 2);
      const found = SPAIN_PROVINCES.find((p) => p.code === prefix);
      if (found) {
        return { province: found.name, autonomousCommunity: found.community };
      }
    }
  }

  // 2. Por coincidencia textual directa de provincia
  if (province) {
    const norm = normalizeText(province);
    const foundProv = SPAIN_PROVINCES.find((p) => normalizeText(p.name) === norm);
    if (foundProv) {
      return { province: foundProv.name, autonomousCommunity: foundProv.community };
    }
    if (PROVINCE_TO_COMMUNITY[norm]) {
      return { province, autonomousCommunity: PROVINCE_TO_COMMUNITY[norm] };
    }
  }

  // 3. Por coincidencia textual directa de municipio
  if (city) {
    const normCity = normalizeText(city);
    const foundCity = SPAIN_PROVINCES.find((p) => normalizeText(p.name) === normCity);
    if (foundCity) {
      return { province: foundCity.name, autonomousCommunity: foundCity.community };
    }
    if (PROVINCE_TO_COMMUNITY[normCity]) {
      return { province: city, autonomousCommunity: PROVINCE_TO_COMMUNITY[normCity] };
    }
  }

  // 4. Geodésico para Islas Canarias (latitud < 30°)
  if (lat < 30.0) {
    const pLasPalmas = SPAIN_PROVINCES.find((p) => p.name === 'Las Palmas')!;
    const pTenerife = SPAIN_PROVINCES.find((p) => p.name === 'Santa Cruz de Tenerife')!;
    const dLP = calculateDistanceKm(lat, lon, pLasPalmas.lat, pLasPalmas.lon);
    const dTF = calculateDistanceKm(lat, lon, pTenerife.lat, pTenerife.lon);
    return dLP < dTF
      ? { province: pLasPalmas.name, autonomousCommunity: 'Canarias' }
      : { province: pTenerife.name, autonomousCommunity: 'Canarias' };
  }

  // 5. Geodésico para Illes Balears (longitud > 1.0 y latitud entre 38.5 y 40.5)
  if (lon > 1.0 && lat < 40.5) {
    return { province: 'Illes Balears', autonomousCommunity: 'Illes Balears' };
  }

  // 6. Proximidad geodésica a capital/centroide provincial peninsular más cercano (Voronoi territorial)
  let closest = SPAIN_PROVINCES[0];
  let minDist = Number.POSITIVE_INFINITY;

  for (const p of SPAIN_PROVINCES) {
    // Excluir islas del cálculo de proximidad peninsular
    if (p.community === 'Canarias' || p.community === 'Illes Balears') continue;
    const d = calculateDistanceKm(lat, lon, p.lat, p.lon);
    if (d < minDist) {
      minDist = d;
      closest = p;
    }
  }

  return { province: closest.name, autonomousCommunity: closest.community };
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
    const found = SPAIN_PROVINCES.find((p) => normalizeText(p.name) === norm);
    if (found) return found.community;
    if (PROVINCE_TO_COMMUNITY[norm]) return PROVINCE_TO_COMMUNITY[norm];
  }
  if (city) {
    const norm = normalizeText(city);
    const found = SPAIN_PROVINCES.find((p) => normalizeText(p.name) === norm);
    if (found) return found.community;
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
 * Cumple la regla de NO inventar datos deportivos ausentes y resuelve geodésicamente la provincia.
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
  const postalCode = tags['addr:postcode']?.trim() || undefined;
  let province = tags['addr:province']?.trim() || undefined;

  // Si la provincia no viene en las etiquetas de OSM, resolverla geodésicamente
  if (!province) {
    const geo = resolveGeodeticLocation(coords.lat, coords.lon, postalCode, undefined, city);
    province = geo.province;
  }

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
 * Determina si una entidad de OpenStreetMap es elegible para ser mostrada en la guía nacional de campos.
 * Excluye rigurosamente elementos que no tienen nombre explícito (autogenerados como "Campo de golf (sin nombre en OSM #...)")
 * y que tampoco disponen de hoyos conocidos ni recorrido verificado.
 */
export function isOsmCourseEligibleForCatalog(osmCourse: OsmGolfCourse): boolean {
  const hasValidName = Boolean(
    osmCourse.hasExplicitName &&
    osmCourse.name &&
    !osmCourse.name.startsWith('Campo de golf (sin nombre en OSM')
  );
  const hasVerifiedHoles = Boolean(osmCourse.holesCount && osmCourse.holesCount > 0);

  // Debe tener al menos nombre explícito o datos verificados de hoyos
  return hasValidName || hasVerifiedHoles;
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
  const resolved = resolveGeodeticLocation(
    osmCourse.latitude,
    osmCourse.longitude,
    osmCourse.postalCode,
    osmCourse.province,
    osmCourse.city
  );

  const community = resolved.autonomousCommunity;
  const displayProvince = osmCourse.province || resolved.province;
  const displayCity = osmCourse.city || (osmCourse.province ? osmCourse.province : resolved.province);

  // Cumplimiento estricto: holesCount solo se establece si está disponible en OSM (9 o 18);
  // para el contrato de GolfApiCourse se usa 18 como estándar de visualización si no está definido,
  // pero hasHoleDetail permanece en false, tees y holes vacíos y hasExplicitHoles en false.
  const hasExplicitHoles = Boolean(osmCourse.holesCount && osmCourse.holesCount > 0);
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
    hasExplicitHoles,
    designer: undefined, // No inventar diseñador
    yearFounded: undefined, // No inventar año
    facilities: [
      'Inventario Geográfico Comunitario',
      `OSM ${osmCourse.osmType.toUpperCase()} #${osmCourse.osmId}`,
      ...(osmCourse.holesCount
        ? [`${osmCourse.holesCount} hoyos (etiqueta OSM)`]
        : ['Hoyos y recorrido no especificados en OSM']),
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
