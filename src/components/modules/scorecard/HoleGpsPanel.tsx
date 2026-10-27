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

export interface HoleGpsPanelProps {
  hole: GolfApiHole;
}

export function HoleGpsPanel({ hole }: HoleGpsPanelProps) {
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
    <div className="rounded-2xl border border-emerald-900/20 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 p-5 text-white shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
              Telémetro GPS · Hoyo {hole.holeNumber}
            </h3>
            <p className="text-[11px] text-emerald-100/70">
              Posición: {currentPlayerCoords.lat.toFixed(5)},{' '}
              {currentPlayerCoords.lng.toFixed(5)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUnit(unit === 'meters' ? 'yards' : 'meters')}
            className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {unit === 'meters' ? 'Metros (m)' : 'Yardas (yd)'}
          </button>
          <button
            type="button"
            onClick={handleReadHardwareGps}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
          >
            <LocateFixed className="h-3.5 w-3.5" />
            GPS Nativo
          </button>
        </div>
      </div>

      {/* Distancias a Frente / Centro / Fondo de Green */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
            Frente Green
          </span>
          <p className="mt-1 text-xl font-extrabold text-white">
            {formatDist(greenDistances.frontMeters, greenDistances.frontYards)}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 p-3 ring-2 ring-emerald-400/30">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            Centro Bandera
          </span>
          <p className="mt-1 text-2xl font-black text-white">
            {formatDist(greenDistances.centerMeters, greenDistances.centerYards)}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
            Fondo Green
          </span>
          <p className="mt-1 text-xl font-extrabold text-white">
            {formatDist(greenDistances.backMeters, greenDistances.backYards)}
          </p>
        </div>
      </div>

      {/* Simulador de avance en calle (Tee -> Calle -> Approach -> Green) */}
      <div className="mt-4 rounded-xl bg-black/25 p-3">
        <div className="flex items-center justify-between text-xs text-emerald-200">
          <span className="inline-flex items-center gap-1 font-medium">
            <Navigation className="h-3.5 w-3.5 text-emerald-400" />
            Posición en el hoyo (Tee → Green)
          </span>
          <span className="font-mono font-bold">
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
          className="mt-2 w-full accent-emerald-400"
        />
        <div className="mt-1 flex justify-between text-[10px] text-emerald-200/70">
          <span>Salida (Tee)</span>
          <span>Zona de Caída (Drive)</span>
          <span>Approach (100m)</span>
          <span>Green</span>
        </div>
      </div>

      {/* Obstáculos y Puntos de Interés del Hoyo */}
      {poiDistances.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            Obstáculos y Referencias del Hoyo
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {poiDistances.map((poi, idx) => (
              <div
                key={`${poi.label}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
              >
                <span className="inline-flex items-center gap-1.5 text-emerald-100">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  {poi.label}
                </span>
                <span className="font-mono font-bold text-amber-300">
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
