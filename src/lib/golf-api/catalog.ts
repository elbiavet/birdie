import type { GolfApiCourse, GolfApiHole } from './types';

const VALLE_VERDE_HOLES_RAW: Array<
  [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
> = [
  [1, 4, 11, 368, 352, 320, 305, 40.46911, -3.78021, 40.46922, -3.78015, 40.46933, -3.78009, 40.4682, -3.7815],
  [2, 5, 3, 510, 492, 455, 430, 40.47041, -3.77881, 40.47052, -3.77872, 40.47063, -3.77863, 40.46945, -3.77995],
  [3, 3, 17, 175, 162, 145, 130, 40.4711, -3.7779, 40.4712, -3.77782, 40.4713, -3.77774, 40.4707, -3.7785],
  [4, 4, 1, 415, 398, 360, 340, 40.4723, -3.7791, 40.47241, -3.7792, 40.47252, -3.7793, 40.4714, -3.7777],
  [5, 4, 9, 372, 358, 325, 302, 40.4731, -3.7805, 40.47321, -3.78061, 40.47332, -3.78072, 40.4726, -3.7794],
  [6, 3, 15, 188, 174, 152, 138, 40.4725, -3.7818, 40.47242, -3.78191, 40.47234, -3.78202, 40.4733, -3.7808],
  [7, 5, 5, 525, 504, 468, 442, 40.4709, -3.7831, 40.47078, -3.78321, 40.47066, -3.78332, 40.4722, -3.7821],
  [8, 4, 13, 348, 332, 300, 282, 40.4696, -3.7826, 40.46949, -3.78251, 40.46938, -3.78242, 40.4705, -3.7833],
  [9, 4, 7, 392, 376, 342, 318, 40.4685, -3.7819, 40.4684, -3.7818, 40.4683, -3.7817, 40.4693, -3.7823],
  [10, 4, 10, 365, 349, 316, 296, 40.4673, -3.7824, 40.46719, -3.78251, 40.46708, -3.78262, 40.4681, -3.7817],
  [11, 3, 18, 162, 148, 132, 118, 40.4664, -3.7832, 40.46631, -3.7833, 40.46622, -3.7834, 40.467, -3.7827],
  [12, 5, 4, 518, 498, 458, 434, 40.4651, -3.7819, 40.46499, -3.78179, 40.46488, -3.78168, 40.4661, -3.7834],
  [13, 4, 2, 412, 395, 358, 336, 40.4658, -3.7804, 40.46591, -3.78029, 40.46602, -3.78018, 40.4649, -3.7816],
  [14, 4, 14, 344, 329, 298, 278, 40.4668, -3.7794, 40.46691, -3.7793, 40.46702, -3.7792, 40.4661, -3.7801],
  [15, 3, 16, 179, 166, 146, 131, 40.4676, -3.7786, 40.4677, -3.77851, 40.4678, -3.77842, 40.4671, -3.7791],
  [16, 5, 6, 498, 480, 444, 420, 40.4689, -3.7775, 40.46901, -3.77761, 40.46912, -3.77772, 40.4679, -3.7784],
  [17, 4, 12, 358, 342, 310, 290, 40.4684, -3.7792, 40.46831, -3.77931, 40.46822, -3.77942, 40.4691, -3.7778],
  [18, 4, 8, 396, 378, 344, 322, 40.46815, -3.7811, 40.46818, -3.78122, 40.46821, -3.78134, 40.4682, -3.7795],
];

const SENORIO_ILLESCAS_HOLES_RAW: Array<
  [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
> = [
  // NOTA TÉCNICA Y LIMITACIÓN DOCUMENTADA:
  // Las métricas deportivas (par, handicap y distancias por barra) de los 9 hoyos
  // están verificadas oficialmente por RFEG/FGM y la ficha técnica del club.
  // Sin embargo, las coordenadas geodésicas individuales por hoyo (tees y green)
  // no han sido provistas por Golf API ni por un levantamiento topográfico oficial.
  // Se mantienen coordenadas de referencia a nivel de instalación con hasVerifiedGpsTelemetry: false,
  // y la interfaz de usuario muestra por defecto el esquema técnico vectorial con el aviso correspondiente.
  [1, 4, 5, 355, 345, 320, 273, 40.1542, -3.8441, 40.1543, -3.844, 40.1544, -3.8439, 40.1533, -3.8452],
  [2, 3, 3, 165, 159, 142, 114, 40.1553, -3.8432, 40.1554, -3.8431, 40.1555, -3.843, 40.1545, -3.8438],
  [3, 4, 7, 306, 287, 264, 230, 40.1565, -3.8445, 40.1566, -3.8444, 40.1567, -3.8443, 40.1556, -3.8429],
  [4, 3, 9, 116, 100, 86, 81, 40.1572, -3.8455, 40.1573, -3.8454, 40.1574, -3.8453, 40.1568, -3.8442],
  [5, 4, 1, 418, 394, 363, 313, 40.1585, -3.8468, 40.1586, -3.8467, 40.1587, -3.8466, 40.1575, -3.8452],
  [6, 5, 4, 474, 436, 380, 375, 40.1571, -3.8482, 40.157, -3.8483, 40.1569, -3.8484, 40.1588, -3.8465],
  [7, 3, 8, 192, 173, 151, 124, 40.1558, -3.8475, 40.1557, -3.8476, 40.1556, -3.8477, 40.1568, -3.8485],
  [8, 5, 6, 431, 400, 376, 344, 40.1545, -3.8461, 40.1544, -3.8462, 40.1543, -3.8463, 40.1555, -3.8478],
  [9, 4, 2, 343, 316, 295, 264, 40.1534, -3.8449, 40.1533, -3.845, 40.1532, -3.8451, 40.1542, -3.8464],
];

function buildSenorioIllescasHoles(): GolfApiHole[] {
  return SENORIO_ILLESCAS_HOLES_RAW.map(
    ([
      holeNumber,
      par,
      strokeIndex,
      w,
      y,
      b,
      r,
      gfLat,
      gfLng,
      gcLat,
      gcLng,
      gbLat,
      gbLng,
      tLat,
      tLng,
    ]) => ({
      holeNumber,
      par,
      strokeIndex,
      distanceWhiteMeters: w,
      distanceYellowMeters: y,
      distanceBlueMeters: b,
      distanceRedMeters: r,
      teeLat: tLat,
      teeLng: tLng,
      greenFrontLat: gfLat,
      greenFrontLng: gfLng,
      greenCenterLat: gcLat,
      greenCenterLng: gcLng,
      greenBackLat: gbLat,
      greenBackLng: gbLng,
      // Los POIs no se inventan ni derivan sintéticamente si no están presentes en Golf API
      pois: [],
    })
  );
}

function buildHolesWithOffset(latOffset = 0, lngOffset = 0): GolfApiHole[] {
  return VALLE_VERDE_HOLES_RAW.map(
    ([
      holeNumber,
      par,
      strokeIndex,
      w,
      y,
      b,
      r,
      gfLat,
      gfLng,
      gcLat,
      gcLng,
      gbLat,
      gbLng,
      tLat,
      tLng,
    ]) => {
      const greenFrontLat = Number((gfLat + latOffset).toFixed(6));
      const greenFrontLng = Number((gfLng + lngOffset).toFixed(6));
      const greenCenterLat = Number((gcLat + latOffset).toFixed(6));
      const greenCenterLng = Number((gcLng + lngOffset).toFixed(6));
      const greenBackLat = Number((gbLat + latOffset).toFixed(6));
      const greenBackLng = Number((gbLng + lngOffset).toFixed(6));
      const teeLat = Number((tLat + latOffset).toFixed(6));
      const teeLng = Number((tLng + lngOffset).toFixed(6));

      return {
        holeNumber,
        par,
        strokeIndex,
        distanceWhiteMeters: w,
        distanceYellowMeters: y,
        distanceBlueMeters: b,
        distanceRedMeters: r,
        teeLat,
        teeLng,
        greenFrontLat,
        greenFrontLng,
        greenCenterLat,
        greenCenterLng,
        greenBackLat,
        greenBackLng,
        pois: [
          {
            id: `poi-h${holeNumber}-bunker-left`,
            poiType: 'bunker',
            label: 'Bunker Izquierdo Green',
            lat: Number((greenFrontLat - 0.00012).toFixed(6)),
            lng: Number((greenFrontLng - 0.00015).toFixed(6)),
          },
          ...(par >= 4
            ? [
                {
                  id: `poi-h${holeNumber}-dogleg`,
                  poiType: 'dogleg' as const,
                  label: 'Caída de Drive / Dogleg',
                  lat: Number(((teeLat + greenCenterLat) / 2).toFixed(6)),
                  lng: Number(((teeLng + greenCenterLng) / 2).toFixed(6)),
                },
              ]
            : []),
        ],
      };
    }
  );
}

export const GOLF_API_COURSES_CATALOG: readonly GolfApiCourse[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    externalGolfApiId: 'golfapi_course_1024',
    name: 'Recorrido Championship 18 Hoyos',
    clubName: 'Real Club de Golf Valle Verde',
    city: 'Madrid',
    country: 'España',
    holesCount: 18,
    parTotal: 72,
    latitude: 40.4682,
    longitude: -3.7815,
    address: 'Carretera del Monte km 4.5, Madrid',
    phone: '+34 910 000 100',
    website: 'https://rcgvalleverde.es',
    hasVerifiedGpsTelemetry: true,
    tees: [
      {
        id: 'tee-vv-white',
        name: 'Blancas',
        colorHex: '#E2E8F0',
        gender: 'men',
        courseRating: 73.2,
        slopeRating: 134,
        totalDistanceMeters: 6345,
      },
      {
        id: 'tee-vv-yellow',
        name: 'Amarillas',
        colorHex: '#FACC15',
        gender: 'men',
        courseRating: 71.5,
        slopeRating: 128,
        totalDistanceMeters: 6053,
      },
      {
        id: 'tee-vv-blue',
        name: 'Azules',
        colorHex: '#3B82F6',
        gender: 'women',
        courseRating: 73.8,
        slopeRating: 131,
        totalDistanceMeters: 5511,
      },
      {
        id: 'tee-vv-red',
        name: 'Rojas',
        colorHex: '#EF4444',
        gender: 'women',
        courseRating: 71.1,
        slopeRating: 124,
        totalDistanceMeters: 5192,
      },
    ],
    holes: buildHolesWithOffset(0, 0),
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    externalGolfApiId: 'golfapi_course_3096',
    name: 'Recorrido Sur — Correspondencia',
    clubName: 'Club de Golf Costa Mediterránea',
    city: 'Valencia',
    country: 'España',
    holesCount: 18,
    parTotal: 72,
    latitude: 39.4699,
    longitude: -0.3763,
    address: 'Camino del Saler 12, Valencia',
    phone: '+34 960 000 300',
    website: 'https://costamedgolf.es',
    hasVerifiedGpsTelemetry: false,
    tees: [
      {
        id: 'tee-cm-yellow',
        name: 'Amarillas',
        colorHex: '#FACC15',
        gender: 'men',
        courseRating: 71.8,
        slopeRating: 129,
        totalDistanceMeters: 6053,
      },
      {
        id: 'tee-cm-red',
        name: 'Rojas',
        colorHex: '#EF4444',
        gender: 'women',
        courseRating: 71.2,
        slopeRating: 125,
        totalDistanceMeters: 5192,
      },
    ],
    holes: buildHolesWithOffset(-0.9983, 3.4052),
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    externalGolfApiId: 'golfapi_course_8833',
    name: 'Recorrido 9 Hoyos Señorío de Illescas',
    clubName: 'Señorío de Illescas Club de Golf & Padel',
    city: 'Illescas (Toledo)',
    country: 'España',
    holesCount: 9,
    parTotal: 35,
    latitude: 40.1533,
    longitude: -3.8452,
    address: 'Av. de Europa, 14, Urb. Señorío de Illescas, 45200 Illescas, Toledo',
    phone: '+34 925 518 359',
    website: 'https://senoriodeillescasgolf.com',
    hasVerifiedGpsTelemetry: false,
    tees: [
      {
        id: 'tee-si-white',
        name: 'Blancas',
        colorHex: '#E2E8F0',
        gender: 'men',
        courseRating: 34.8,
        slopeRating: 122,
        totalDistanceMeters: 2800,
      },
      {
        id: 'tee-si-yellow',
        name: 'Amarillas',
        colorHex: '#FACC15',
        gender: 'men',
        courseRating: 33.9,
        slopeRating: 118,
        totalDistanceMeters: 2610,
      },
      {
        id: 'tee-si-blue',
        name: 'Azules',
        colorHex: '#3B82F6',
        gender: 'women',
        courseRating: 35.5,
        slopeRating: 120,
        totalDistanceMeters: 2377,
      },
      {
        id: 'tee-si-red',
        name: 'Rojas',
        colorHex: '#EF4444',
        gender: 'women',
        courseRating: 34.6,
        slopeRating: 116,
        totalDistanceMeters: 2118,
      },
    ],
    holes: buildSenorioIllescasHoles(),
  },
];
