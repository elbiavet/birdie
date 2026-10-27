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
