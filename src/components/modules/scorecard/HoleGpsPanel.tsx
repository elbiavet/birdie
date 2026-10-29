'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  calculateDistanceMeters,
  calculateGreenDistances,
  getCurrentPosition,
  metersToYards,
} from '@/lib/capacitor/geolocation';
import type { ClubCoordinates } from '@/types/club';
import type { GolfApiHole } from '@/lib/golf-api/types';
import { Compass, LocateFixed, Navigation, ShieldAlert } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export interface HoleGpsPanelProps {
  hole: GolfApiHole;
}

export function HoleGpsPanel({ hole }: HoleGpsPanelProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [unit, setUnit] = useState<'meters' | 'yards'>('meters');
  // Progreso simulado a lo largo del hoyo (0 = Tee de salida, 0.5 = Calle, 0.85 = Approach)
  const [progressAlongHole, setProgressAlongHole] = useState<number>(0);
  const [liveGpsPosition, setLiveGpsPosition] = useState<ClubCoordinates | null>(null);
  const [usingHardwareGps, setUsingHardwareGps] = useState<boolean>(false);

  // Cuando cambia de hoyo, colocamos al jugador en el Tee de salida del hoyo activo
  useEffect(() => {
    setProgressAlongHole(0);
    setUsingHardwareGps(false);
  }, [hole.holeNumber]);

  const currentPlayerCoords: ClubCoordinates = useMemo(() => {
    if (usingHardwareGps && liveGpsPosition) {
      return liveGpsPosition;
    }
    const lat =
      hole.teeLat + (hole.greenCenterLat - hole.teeLat) * progressAlongHole;
    const lng =
      hole.teeLng + (hole.greenCenterLng - hole.teeLng) * progressAlongHole;
    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    };
  }, [hole, progressAlongHole, usingHardwareGps, liveGpsPosition]);

  const greenDistances = useMemo(() => {
    return calculateGreenDistances(currentPlayerCoords, {
      front: { lat: hole.greenFrontLat, lng: hole.greenFrontLng },
      center: { lat: hole.greenCenterLat, lng: hole.greenCenterLng },
      back: { lat: hole.greenBackLat, lng: hole.greenBackLng },
    });
  }, [currentPlayerCoords, hole]);

  const poiDistances = useMemo(() => {
    return hole.pois.map((poi) => {
      const meters = calculateDistanceMeters(currentPlayerCoords, {
        lat: poi.lat,
        lng: poi.lng,
      });
      return {
        ...poi,
        meters,
        yards: metersToYards(meters),
      };
    });
  }, [currentPlayerCoords, hole.pois]);

  const handleReadHardwareGps = async () => {
    const pos = await getCurrentPosition({
      lat: hole.teeLat,
      lng: hole.teeLng,
    });
    setLiveGpsPosition({
      lat: pos.lat,
      lng: pos.lng,
    });
    setUsingHardwareGps(true);
  };

  const formatDist = (meters: number, yards: number) =>
    unit === 'meters' ? `${meters} m` : `${yards} yd`;

  return (
    <div
      style={{
        backgroundColor: isDark ? '#0F241B' : '#FFFFFF',
        borderColor: isDark ? '#1B3D2F' : '#D8DFD9',
        color: isDark ? '#FFFFFF' : '#1A2E22',
      }}
      className="rounded-2xl border p-5 shadow-sm transition-colors duration-200"
    >
      <div
        style={{ borderColor: isDark ? '#1B3D2F' : '#E8ECE9' }}
        className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"
      >
        <div className="flex items-center gap-2">
          <Compass
            style={{ color: isDark ? '#D4AF37' : '#0A3A2A' }}
            className="h-5 w-5 shrink-0"
          />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">
              Telémetro GPS · Hoyo {hole.holeNumber}
            </h3>
            <p className="text-[11px] opacity-75 font-normal">
              Posición: {currentPlayerCoords.lat.toFixed(5)},{' '}
              {currentPlayerCoords.lng.toFixed(5)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUnit(unit === 'meters' ? 'yards' : 'meters')}
            style={{
              backgroundColor: isDark ? '#16382A' : '#E8ECE9',
              borderColor: isDark ? '#255440' : '#CBD5E1',
              color: isDark ? '#FFFFFF' : '#1A2E22',
            }}
            className="rounded-lg border px-2.5 py-1 text-xs font-semibold transition hover:opacity-90 cursor-pointer"
          >
            {unit === 'meters' ? 'Metros (m)' : 'Yardas (yd)'}
          </button>
          <button
            type="button"
            onClick={handleReadHardwareGps}
            style={{
              backgroundColor: isDark ? '#D4AF37' : '#0A3A2A',
              color: isDark ? '#08130E' : '#FFFFFF',
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition hover:opacity-95 cursor-pointer shadow-xs"
          >
            <LocateFixed className="h-3.5 w-3.5" />
            GPS Nativo
          </button>
        </div>
      </div>

      {/* Distancias a Frente / Centro / Fondo de Green */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div
          style={{
            backgroundColor: isDark ? '#16382A' : '#F4F6F4',
            borderColor: isDark ? '#255440' : '#E8ECE9',
          }}
          className="rounded-xl border p-3 transition-colors"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
            Frente Green
          </span>
          <p className="mt-1 text-xl font-metric">
            {formatDist(greenDistances.frontMeters, greenDistances.frontYards)}
          </p>
        </div>

        <div
          style={{
            backgroundColor: isDark ? '#16382A' : '#E8ECE9',
            borderColor: isDark ? '#D4AF37' : '#A38332',
          }}
          className="rounded-xl border-2 p-3 shadow-xs transition-colors"
        >
          <span
            style={{ color: isDark ? '#D4AF37' : '#A38332' }}
            className="text-[11px] font-bold uppercase tracking-wider"
          >
            Centro Bandera
          </span>
          <p
            style={{ color: isDark ? '#D4AF37' : '#0A3A2A' }}
            className="mt-1 text-2xl font-metric font-bold"
          >
            {formatDist(greenDistances.centerMeters, greenDistances.centerYards)}
          </p>
        </div>

        <div
          style={{
            backgroundColor: isDark ? '#16382A' : '#F4F6F4',
            borderColor: isDark ? '#255440' : '#E8ECE9',
          }}
          className="rounded-xl border p-3 transition-colors"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
            Fondo Green
          </span>
          <p className="mt-1 text-xl font-metric">
            {formatDist(greenDistances.backMeters, greenDistances.backYards)}
          </p>
        </div>
      </div>

      {/* Simulador de avance en calle (Tee -> Calle -> Approach -> Green) */}
      <div
        style={{
          backgroundColor: isDark ? '#16382A' : '#F4F6F4',
          borderColor: isDark ? '#255440' : '#E8ECE9',
        }}
        className="mt-4 rounded-xl border p-3 transition-colors"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 font-medium">
            <Navigation
              style={{ color: isDark ? '#D4AF37' : '#0A3A2A' }}
              className="h-3.5 w-3.5"
            />
            Posición en el hoyo (Tee → Green)
          </span>
          <span className="font-mono font-metric font-semibold">
            {Math.round(progressAlongHole * 100)}% recorrido
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={0.95}
          step={0.05}
          value={progressAlongHole}
          aria-label="Posición del jugador en el hoyo"
          onChange={(e) => {
            setUsingHardwareGps(false);
            setProgressAlongHole(Number(e.target.value));
          }}
          className="mt-2 w-full accent-[var(--theme-accent)]"
        />
        <div className="mt-1 flex justify-between text-[10px] opacity-75 font-normal">
          <span>Salida (Tee)</span>
          <span>Zona de Caída (Drive)</span>
          <span>Approach (100m)</span>
          <span>Green</span>
        </div>
      </div>

      {/* Obstáculos y Puntos de Interés del Hoyo */}
      {poiDistances.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <span
            style={{ color: isDark ? '#D4AF37' : '#0A3A2A' }}
            className="text-[11px] font-bold uppercase tracking-wider"
          >
            Obstáculos y Referencias del Hoyo
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {poiDistances.map((poi, idx) => (
              <div
                key={`${poi.label}-${idx}`}
                style={{
                  backgroundColor: isDark ? '#16382A' : '#F4F6F4',
                  borderColor: isDark ? '#255440' : '#E8ECE9',
                }}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  {poi.label}
                </span>
                <span className="font-mono font-metric font-semibold text-[var(--theme-accent)]">
                  {formatDist(poi.meters, poi.yards)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
