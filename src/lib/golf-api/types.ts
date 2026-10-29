export type GolfPoiType =
  | 'green_front'
  | 'green_center'
  | 'green_back'
  | 'bunker'
  | 'water_hazard'
  | 'dogleg'
  | 'tee_box';

export interface GolfApiPoi {
  id: string;
  poiType: GolfPoiType;
  label: string;
  lat: number;
  lng: number;
}

export interface GolfApiTee {
  id: string;
  name: string;
  colorHex: string;
  gender: 'men' | 'women' | 'mixed';
  courseRating: number;
  slopeRating: number;
  totalDistanceMeters: number;
}

/**
 * Limitación documentada de Golf API:
 * El payload estándar y los endpoints de Golf API proveen métricas deportivas exactas
 * (par, handicap, distancias por barra, coordenadas GPS de tee, green frente/centro/fondo
 * y POIs de bunkers/agua/doglegs), pero NO suministran imágenes fotográficas ráster ni
 * planos vectoriales prediseñados por hoyo.
 * Para solventarlo de forma verídica y sin falsear información, Birdie implementa un
 * renderizador de trazado técnico vectorial SVG interactivo proyectado directamente
 * desde las coordenadas GPS reales de Golf API, admitiendo opcionalmente imágenes
 * fotográficas provistas por el club (`photoUrl`) cuando estén disponibles.
 */
export interface GolfApiHole {
  holeNumber: number;
  par: number;
  strokeIndex: number;
  distanceWhiteMeters: number;
  distanceYellowMeters: number;
  distanceBlueMeters: number;
  distanceRedMeters: number;
  teeLat: number;
  teeLng: number;
  greenFrontLat: number;
  greenFrontLng: number;
  greenCenterLat: number;
  greenCenterLng: number;
  greenBackLat: number;
  greenBackLng: number;
  pois: GolfApiPoi[];
  photoUrl?: string;
  description?: string;
}

export interface GolfApiCourse {
  id: string;
  externalGolfApiId: string;
  name: string;
  clubName: string;
  city: string;
  country: string;
  holesCount: 9 | 18;
  parTotal: number;
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  website: string;
  tees: GolfApiTee[];
  holes: GolfApiHole[];
}

export interface CourseNineTotals {
  outPar: number;
  inPar: number;
  totalPar: number;
  outMeters: number;
  inMeters: number;
  totalMeters: number;
}

export interface ExternalGolfApiRawPayload {
  courseID: string;
  courseName: string;
  clubName: string;
  city?: string;
  country?: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  website?: string;
  tees?: Array<{
    teeID?: string;
    teeName: string;
    teeColor?: string;
    gender?: 'men' | 'women' | 'mixed';
    courseRating: number;
    slopeRating: number;
    totalMeters: number;
  }>;
  holes: Array<{
    hole: number;
    par: number;
    handicap: number;
    whiteMeters?: number;
    yellowMeters: number;
    blueMeters?: number;
    redMeters?: number;
    teeLat?: number;
    teeLng?: number;
    greenFrontLat: number;
    greenFrontLng: number;
    greenCenterLat: number;
    greenCenterLng: number;
    greenBackLat: number;
    greenBackLng: number;
  }>;
}
