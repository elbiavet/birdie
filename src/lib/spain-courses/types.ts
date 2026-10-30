import type { GolfApiCourse, GolfApiTee, GolfApiHole } from '@/lib/golf-api/types';

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
}

export interface SpainCourseFilterOptions {
  query?: string;
  community?: SpainAutonomousCommunity | '' | 'all';
  holesCount?: 9 | 18 | 'all';
}
