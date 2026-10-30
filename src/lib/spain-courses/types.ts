import type { GolfApiCourse, GolfApiTee, GolfApiHole } from '@/lib/golf-api/types';
import type { CourseProvenance, OsmGeometryType } from './osm-types';

export * from './osm-types';

export type SpainAutonomousCommunity =
  | 'Andalucía'
  | 'Aragón'
  | 'Asturias'
  | 'Illes Balears'
  | 'Canarias'
  | 'Cantabria'
  | 'Castilla y León'
  | 'Castilla-La Mancha'
  | 'Cataluña'
  | 'Comunidad de Madrid'
  | 'Comunidad Valenciana'
  | 'Extremadura'
  | 'Galicia'
  | 'La Rioja'
  | 'Navarra'
  | 'País Vasco'
  | 'Región de Murcia';

export interface SpainGolfCourse extends GolfApiCourse {
  autonomousCommunity: SpainAutonomousCommunity;
  province: string;
  postalCode?: string;
  email?: string;
  designer?: string;
  yearFounded?: number;
  facilities: string[];
  hasHoleDetail: boolean;
  isBirdieClub?: boolean;
  description?: string;
  /** Procedencia del registro: curada por Birdie/RFEG o inventario de OpenStreetMap */
  provenance?: 'curated' | 'osm';
  /** Metadatos de procedencia cuando proviene de OpenStreetMap */
  osmId?: number;
  osmType?: OsmGeometryType;
  osmUrl?: string;
  osmKey?: string;
  importedAt?: string;
  hasExplicitName?: boolean;
  rawTags?: Record<string, string>;
}

export interface SpainCourseFilterOptions {
  query?: string;
  community?: SpainAutonomousCommunity | '' | 'all';
  holesCount?: 9 | 18 | 'all';
  provenance?: CourseProvenance;
}
