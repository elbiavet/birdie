import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { ClubCoordinates } from '@/types/club';

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  timestamp: number;
  source: 'native' | 'web' | 'simulated';
}

export interface HoleGreenTargets {
  front: ClubCoordinates;
  center: ClubCoordinates;
  back: ClubCoordinates;
}

export interface GreenDistances {
  frontMeters: number;
  centerMeters: number;
  backMeters: number;
  frontYards: number;
  centerYards: number;
  backYards: number;
}

const EARTH_RADIUS_METERS = 6371000;
const METERS_TO_YARDS_FACTOR = 1.0936133;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calcula la distancia geodésica (fórmula de Haversine) en metros entre dos coordenadas GPS.
 */
export function calculateDistanceMeters(
  from: ClubCoordinates,
  to: ClubCoordinates
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Convierte metros a yardas redondeando al entero más cercano.
 */
export function metersToYards(meters: number): number {
  return Math.round(meters * METERS_TO_YARDS_FACTOR);
}

/**
 * Calcula las distancias al frente, centro y fondo de green tanto en metros como en yardas.
 */
export function calculateGreenDistances(
  playerPos: ClubCoordinates,
  green: HoleGreenTargets
): GreenDistances {
  const frontMeters = calculateDistanceMeters(playerPos, green.front);
  const centerMeters = calculateDistanceMeters(playerPos, green.center);
  const backMeters = calculateDistanceMeters(playerPos, green.back);

  return {
    frontMeters,
    centerMeters,
    backMeters,
    frontYards: metersToYards(frontMeters),
    centerYards: metersToYards(centerMeters),
    backYards: metersToYards(backMeters),
  };
}

/**
 * Obtiene la posición GPS actual usando @capacitor/geolocation en Android/iOS,
 * con fallback a Web Geolocation API o a coordenadas simuladas del hoyo/club.
 */
export async function getCurrentGpsPosition(
  fallbackCoords: ClubCoordinates = { lat: 40.4682, lng: -3.7815 }
): Promise<GpsPosition> {
  try {
    if (Capacitor.isNativePlatform()) {
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        await Geolocation.requestPermissions();
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 8000,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy ?? null,
        timestamp: pos.timestamp,
        source: 'native',
      };
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
        });
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy ?? null,
        timestamp: pos.timestamp,
        source: 'web',
      };
    }
  } catch {
    // Fallback controlado a coordenadas simuladas del tee/club cuando no hay permisos o en entorno de pruebas
  }

  return {
    lat: fallbackCoords.lat,
    lng: fallbackCoords.lng,
    accuracyMeters: 5,
    timestamp: Date.now(),
    source: 'simulated',
  };
}
