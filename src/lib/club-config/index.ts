import demoClubJson from '../../../clubs/demo-club/config.json';
import senorioIllescasJson from '../../../clubs/senorio-illescas/config.json';
import type { ClubConfig, ClubFeatureKey, ClubFeatures } from '@/types/club';
import { resolveRuntimeEnvironment, type AppEnvironment } from '@/lib/env';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const CLUB_ID_REGEX = /^[a-z0-9-]+$/;
const APP_ID_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

const REQUIRED_FEATURE_KEYS: readonly ClubFeatureKey[] = [
  'scorecard',
  'gps',
  'stats',
  'calendar',
  'tournaments',
  'bookings',
  'playerDirectory',
  'clubDirectory',
  'news',
  'clubInfo',
  'forum',
  'adminChat',
  'specialEvents',
] as const;

const CLUB_REGISTRY: Record<string, ClubConfig> = {
  'demo-club': demoClubJson as ClubConfig,
  'senorio-illescas': senorioIllescasJson as ClubConfig,
};

/**
 * Valida que un objeto arbitrario cumpla estrictamente con el esquema de configuración de un club.
 * Lanza un Error descriptivo si algún campo obligatorio o formato es inválido.
 */
export function validateClubConfig(input: unknown): ClubConfig {
  if (!input || typeof input !== 'object') {
    throw new Error('La configuración del club debe ser un objeto válido.');
  }

  const candidate = input as Record<string, unknown>;

  if (typeof candidate.clubId !== 'string' || !CLUB_ID_REGEX.test(candidate.clubId)) {
    throw new Error('clubId inválido: debe estar en formato kebab-case (ej. demo-club).');
  }

  if (typeof candidate.name !== 'string' || candidate.name.trim().length < 2) {
    throw new Error('name inválido: el nombre del club debe tener al menos 2 caracteres.');
  }

  if (
    typeof candidate.shortName !== 'string' ||
    candidate.shortName.trim().length < 2 ||
    candidate.shortName.trim().length > 24
  ) {
    throw new Error('shortName inválido: debe tener entre 2 y 24 caracteres.');
  }

  if (typeof candidate.appId !== 'string' || !APP_ID_REGEX.test(candidate.appId)) {
    throw new Error(
      'appId inválido: debe ser un identificador de paquete válido (ej. com.birdie.democlub).'
    );
  }

  const domains = candidate.domains as Record<string, unknown> | undefined;
  if (
    !domains ||
    typeof domains.staging !== 'string' ||
    domains.staging.trim().length < 3 ||
    typeof domains.production !== 'string' ||
    domains.production.trim().length < 3
  ) {
    throw new Error('domains inválido: debe definir dominios staging y production.');
  }

  const theme = candidate.theme as Record<string, unknown> | undefined;
  const themeKeys = [
    'primary',
    'primaryForeground',
    'secondary',
    'accent',
    'background',
  ] as const;
  if (!theme || typeof theme !== 'object') {
    throw new Error('theme inválido: falta el objeto de colores del club.');
  }
  for (const key of themeKeys) {
    const val = theme[key];
    if (typeof val !== 'string' || !HEX_COLOR_REGEX.test(val)) {
      throw new Error(`theme.${key} inválido: debe ser un color hexadecimal #RRGGBB.`);
    }
  }

  const coordinates = candidate.coordinates as Record<string, unknown> | undefined;
  if (
    !coordinates ||
    typeof coordinates.lat !== 'number' ||
    coordinates.lat < -90 ||
    coordinates.lat > 90 ||
    typeof coordinates.lng !== 'number' ||
    coordinates.lng < -180 ||
    coordinates.lng > 180
  ) {
    throw new Error('coordinates inválido: lat (-90..90) y lng (-180..180) son obligatorios.');
  }

  if (
    typeof candidate.defaultCourseExternalId !== 'string' ||
    candidate.defaultCourseExternalId.trim().length === 0
  ) {
    throw new Error('defaultCourseExternalId inválido: no puede estar vacío.');
  }

  const features = candidate.features as Record<string, unknown> | undefined;
  if (!features || typeof features !== 'object') {
    throw new Error('features inválido: debe especificar los módulos habilitados.');
  }
  for (const featureKey of REQUIRED_FEATURE_KEYS) {
    if (typeof features[featureKey] !== 'boolean') {
      throw new Error(`features.${featureKey} inválido: debe ser booleano.`);
    }
  }

  return candidate as unknown as ClubConfig;
}

/**
 * Devuelve la lista de IDs de clubes registrados en el repositorio.
 */
export function listRegisteredClubIds(): string[] {
  return Object.keys(CLUB_REGISTRY);
}

/**
 * Obtiene y valida la configuración de un club por su identificador.
 */
export function getClubConfig(clubId: string): ClubConfig {
  const normalized = clubId.trim();
  const found = CLUB_REGISTRY[normalized];
  if (!found) {
    const available = listRegisteredClubIds().join(', ');
    throw new Error(
      `Club "${normalized}" no encontrado. Clubes disponibles: ${available}`
    );
  }
  return validateClubConfig(found);
}

/**
 * Resuelve la configuración del club activo a partir de las variables de entorno.
 */
export function getActiveClubConfig(
  env: Record<string, string | undefined> = process.env
): ClubConfig {
  const { clubId } = resolveRuntimeEnvironment(env);
  return getClubConfig(clubId);
}

/**
 * Obtiene el dominio correspondiente al club y entorno activo (staging | production).
 */
export function getClubDomain(
  config: ClubConfig,
  environment: AppEnvironment = 'staging'
): string {
  return environment === 'production'
    ? config.domains.production
    : config.domains.staging;
}

/**
 * Devuelve el listado de claves de funcionalidades habilitadas para el club.
 */
export function getEnabledFeatures(config: ClubConfig): ClubFeatureKey[] {
  return REQUIRED_FEATURE_KEYS.filter(
    (key) => config.features[key as keyof ClubFeatures] === true
  );
}

/**
 * Genera un diccionario de variables CSS para inyectar el tema del club en el DOM.
 */
export function buildClubCssVariables(config: ClubConfig): Record<string, string> {
  return {
    '--club-primary': config.theme.primary,
    '--club-primary-fg': config.theme.primaryForeground,
    '--club-secondary': config.theme.secondary,
    '--club-accent': config.theme.accent,
    '--club-bg': config.theme.background,
  };
}

/**
 * Genera un bloque CSS `:root { ... }` listo para escribir en hojas de estilo.
 */
export function buildClubCssRootBlock(config: ClubConfig): string {
  const vars = buildClubCssVariables(config);
  const lines = Object.entries(vars).map(([key, value]) => `  ${key}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}
