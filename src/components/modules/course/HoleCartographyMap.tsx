'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { GolfApiHole, GolfApiPoi } from '@/lib/golf-api/types';
import { useTranslation } from '@/components/providers/LanguageProvider';
import { AlertCircle, RefreshCw, Layers, WifiOff, Compass } from 'lucide-react';

export const PNOA_WMTS_URL =
  'https://www.ign.es/wmts/pnoa-ma?Service=WMTS&Request=GetTile&Version=1.0.0&Layer=OI.OrthoimageCoverage&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileCol={x}&TileRow={y}';

export const PNOA_ATTRIBUTION =
  '<a href="https://www.scne.es" target="_blank" rel="noopener noreferrer">PNOA CC BY 4.0 scne.es</a>';

export interface HoleBoundsResult {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
}

/**
 * Calcula la caja envolvente (Bounding Box) y centro de un hoyo a partir de
 * las coordenadas GPS oficiales (Tee, Green Frente, Centro, Fondo y POIs).
 */
export function calculateHoleBounds(hole: GolfApiHole): HoleBoundsResult {
  const lats: number[] = [
    hole.teeLat,
    hole.greenCenterLat,
    hole.greenFrontLat,
    hole.greenBackLat,
  ];
  const lngs: number[] = [
    hole.teeLng,
    hole.greenCenterLng,
    hole.greenFrontLng,
    hole.greenBackLng,
  ];

  if (hole.pois && hole.pois.length > 0) {
    for (const poi of hole.pois) {
      if (typeof poi.lat === 'number' && typeof poi.lng === 'number') {
        lats.push(poi.lat);
        lngs.push(poi.lng);
      }
    }
  }

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    centerLat: (minLat + maxLat) / 2,
    centerLng: (minLng + maxLng) / 2,
  };
}

export interface HoleCartographyMapProps {
  hole?: GolfApiHole | null;
  clubName?: string;
  courseName?: string;
  hasVerifiedGpsTelemetry?: boolean;
  courseCoordinates?: {
    latitude: number;
    longitude: number;
  } | null;
  onTileError?: () => void;
  onSwitchToVector?: () => void;
  className?: string;
}

export function HoleCartographyMap({
  hole,
  clubName = 'Club de Golf',
  courseName = 'Campo Principal',
  hasVerifiedGpsTelemetry = true,
  courseCoordinates,
  onTileError,
  onSwitchToVector,
  className = '',
}: HoleCartographyMapProps) {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  const [tileErrorOccurred, setTileErrorOccurred] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<GolfApiPoi | null>(null);

  const isFullCourseMode = hasVerifiedGpsTelemetry === false;

  // Detección de conectividad del navegador
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      setTileErrorOccurred(false);
    };

    if (!navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const clubLat = courseCoordinates?.latitude;
  const clubLng = courseCoordinates?.longitude;
  const hasValidClubCoords =
    typeof clubLat === 'number' &&
    typeof clubLng === 'number' &&
    !isNaN(clubLat) &&
    !isNaN(clubLng);

  // Inicialización y actualización reactiva de Leaflet
  const initMap = useCallback(async () => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Si ya existe instancia previa en modo campo completo, no recrear ni reenfocar al cambiar de hoyo
    if (isFullCourseMode && mapInstanceRef.current) {
      return;
    }

    const L = await import('leaflet');

    // Si ya existe instancia previa, limpiarla antes de reinstanciar
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    if (isFullCourseMode) {
      if (!hasValidClubCoords || clubLat === undefined || clubLng === undefined) {
        return;
      }

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
        maxZoom: 19,
        minZoom: 10,
      });
      mapInstanceRef.current = map;

      const pnoaLayer = L.tileLayer(PNOA_WMTS_URL, {
        attribution: PNOA_ATTRIBUTION,
        maxZoom: 19,
        tileSize: 256,
        errorTileUrl: '',
      });

      pnoaLayer.on('tileerror', () => {
        setTileErrorOccurred(true);
        if (onTileError) {
          onTileError();
        }
      });

      pnoaLayer.addTo(map);

      // Centrado en la ubicación verificada del club para abarcar el campo completo
      // Zoom 15 abarca ~1.5 km x 1.2 km, ajustando el encuadre al campo completo sin inventar perímetros
      map.setView([clubLat, clubLng], 15);
      return;
    }

    if (!hole) return;

    const boundsData = calculateHoleBounds(hole);
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
      maxZoom: 19,
      minZoom: 10,
    });
    mapInstanceRef.current = map;

    // Capa Ortofoto PNOA oficial
    const pnoaLayer = L.tileLayer(PNOA_WMTS_URL, {
      attribution: PNOA_ATTRIBUTION,
      maxZoom: 19,
      tileSize: 256,
      errorTileUrl: '',
    });

    pnoaLayer.on('tileerror', () => {
      setTileErrorOccurred(true);
      if (onTileError) {
        onTileError();
      }
    });

    pnoaLayer.addTo(map);

    // Encuadre ajustado al hoyo con margen de visualización
    const latLngBounds = L.latLngBounds(
      [boundsData.minLat, boundsData.minLng],
      [boundsData.maxLat, boundsData.maxLng]
    );
    map.fitBounds(latLngBounds, { padding: [35, 35] });

    // 1. Eje de Tiro Teórico (Polyline discontinua: Salida -> Doglegs -> Green Centro)
    const doglegs = (hole.pois || []).filter((p) => p.poiType === 'dogleg');
    const pathCoords: [number, number][] = [
      [hole.teeLat, hole.teeLng],
      ...doglegs.map((d): [number, number] => [d.lat, d.lng]),
      [hole.greenCenterLat, hole.greenCenterLng],
    ];

    L.polyline(pathCoords, {
      color: '#FACC15',
      weight: 2.5,
      dashArray: '6, 6',
      opacity: 0.9,
    })
      .bindTooltip(
        `Eje de juego teórico · ${hole.distanceYellowMeters} m`,
        { permanent: false, direction: 'top' }
      )
      .addTo(map);

    // 2. Marcador de Salida (Tee Box)
    const teeIcon = L.divIcon({
      className: 'custom-tee-marker',
      html: `
        <div style="background: #0B2B20; border: 2px solid #C5A059; border-radius: 9999px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: bold; font-size: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
          Tee
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const teePopupContent = `
      <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #1e293b;">
        <strong style="color: #0F4C3A;">Salida Hoyo ${hole.holeNumber} (Par ${hole.par})</strong>
        <p style="margin: 4px 0; color: #64748b; font-size: 11px;">${courseName} · ${clubName}</p>
        <div style="margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
          <div><span style="color:#64748b;">Blancas:</span> <b>${hole.distanceWhiteMeters} m</b></div>
          <div><span style="color:#d97706;">Amarillas:</span> <b>${hole.distanceYellowMeters} m</b></div>
          <div><span style="color:#2563eb;">Azules:</span> <b>${hole.distanceBlueMeters} m</b></div>
          <div><span style="color:#dc2626;">Rojas:</span> <b>${hole.distanceRedMeters} m</b></div>
        </div>
      </div>
    `;

    L.marker([hole.teeLat, hole.teeLng], { icon: teeIcon })
      .bindPopup(teePopupContent)
      .addTo(map);

    // 3. Complejo del Green: Centro (Bandera), Entrada (Frente) y Salida (Fondo)
    const flagIcon = L.divIcon({
      className: 'custom-flag-marker',
      html: `
        <div style="background: #E11D48; border: 2px solid #FFFFFF; border-radius: 9999px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: bold; font-size: 11px; box-shadow: 0 2px 10px rgba(0,0,0,0.6);">
          P${hole.par}
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    L.marker([hole.greenCenterLat, hole.greenCenterLng], { icon: flagIcon })
      .bindPopup(
        `<div style="font-family: sans-serif; font-size: 12px; color: #1e293b;">
          <strong style="color: #0F4C3A;">Green Hoyo ${hole.holeNumber} (Bandera / Centro)</strong>
          <p style="margin: 3px 0; font-size: 11px; color: #64748b;">GPS: ${hole.greenCenterLat.toFixed(5)}, ${hole.greenCenterLng.toFixed(5)}</p>
          <p style="margin: 0; font-size: 11px;">Hándicap (Stroke Index): <b>${hole.strokeIndex}</b></p>
        </div>`
      )
      .addTo(map);

    // Cotas de Frente y Fondo del Green (Círculos precisos)
    L.circleMarker([hole.greenFrontLat, hole.greenFrontLng], {
      radius: 4,
      color: '#FFFFFF',
      fillColor: '#34D399',
      fillOpacity: 0.9,
      weight: 1.5,
    })
      .bindTooltip('Entrada de Green (Frente)', { direction: 'bottom' })
      .addTo(map);

    L.circleMarker([hole.greenBackLat, hole.greenBackLng], {
      radius: 4,
      color: '#FFFFFF',
      fillColor: '#34D399',
      fillOpacity: 0.9,
      weight: 1.5,
    })
      .bindTooltip('Salida de Green (Fondo)', { direction: 'top' })
      .addTo(map);

    // 4. Marcadores de Obstáculos y Puntos de Interés Oficiales (POIs)
    if (hole.pois && hole.pois.length > 0) {
      for (const poi of hole.pois) {
        if (poi.poiType === 'dogleg') continue; // Ya incluido en la polilínea

        const isBunker = poi.poiType === 'bunker';
        const color = isBunker ? '#D4AF37' : '#38BDF8';
        const labelText = isBunker ? 'Bunker' : 'Agua';

        const poiIcon = L.divIcon({
          className: 'custom-poi-marker',
          html: `
            <div style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid ${color}; border-radius: 6px; padding: 2px 4px; color: ${color}; font-weight: bold; font-size: 9px; box-shadow: 0 1px 4px rgba(0,0,0,0.4); white-space: nowrap;">
              ${labelText}
            </div>
          `,
          iconSize: [40, 16],
          iconAnchor: [20, 8],
        });

        const marker = L.marker([poi.lat, poi.lng], { icon: poiIcon });
        marker.on('click', () => setSelectedPoi(poi));
        marker.bindPopup(
          `<div style="font-family: sans-serif; font-size: 11px; color: #1e293b;">
            <strong>${poi.label}</strong>
            <p style="margin: 2px 0; color: #64748b; font-size: 10px;">${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}</p>
          </div>`
        );
        marker.addTo(map);
      }
    }
  }, [isFullCourseMode, hasValidClubCoords, clubLat, clubLng, hole, clubName, courseName, onTileError]);

  useEffect(() => {
    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initMap]);

  if (isFullCourseMode && !hasValidClubCoords) {
    return (
      <div
        className={`w-full h-[460px] rounded-2xl border border-[var(--border-luxury)] bg-stone-950 flex flex-col items-center justify-center p-6 text-center ${className}`}
        role="status"
        aria-label="Coordenadas del club no disponibles"
      >
        <Compass className="w-10 h-10 text-[var(--gold-meta)] mb-3 opacity-60" />
        <h4 className="text-sm font-semibold text-[var(--gold-title)]">
          Ubicación del club no disponible
        </h4>
        <p className="text-xs text-[var(--gold-meta)] mt-1 max-w-sm">
          No se dispone de coordenadas geodésicas verificadas de las instalaciones para encuadrar la imagen aérea del campo.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-[460px] rounded-2xl overflow-hidden border border-[var(--border-luxury)] bg-stone-950 select-none ${className}`}
      role="region"
      aria-label={
        isFullCourseMode
          ? `Mapa satelital PNOA del campo completo de ${clubName}`
          : `Mapa satelital PNOA del hoyo ${hole?.holeNumber ?? 1}`
      }
    >
      {/* Contenedor del Mapa Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Pill indicador de Vista General del Campo */}
      {isFullCourseMode && (
        <div className="absolute top-3 left-3 z-[900] px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-xs text-stone-200 flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-medium">
            Vista Aérea General · Campo Completo
          </span>
        </div>
      )}

      {/* Banner de Aviso: Fallo de Teselas o Modo Offline */}
      {(tileErrorOccurred || isOffline) && (
        <div className="absolute top-3 left-3 right-3 z-[1000] p-3 rounded-xl bg-amber-950/90 border border-amber-600/40 text-amber-200 text-xs backdrop-blur-md shadow-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isOffline ? (
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>
              {isOffline
                ? 'Dispositivo sin conexión. Las ortofotos PNOA requieren red activa.'
                : 'Error al cargar algunas teselas del servicio PNOA/IGN.'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isOffline && (
              <button
                type="button"
                onClick={() => {
                  setTileErrorOccurred(false);
                  initMap();
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800/70 border border-amber-500/40 text-[11px] font-semibold text-amber-100 flex items-center gap-1"
                aria-label="Reintentar carga de mapa"
              >
                <RefreshCw className="w-3 h-3" />
                Reintentar
              </button>
            )}

            {onSwitchToVector && (
              <button
                type="button"
                onClick={onSwitchToVector}
                className="px-2.5 py-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/70 border border-emerald-500/40 text-[11px] font-semibold text-emerald-100 flex items-center gap-1"
                aria-label="Ver esquema técnico"
              >
                <Layers className="w-3 h-3" />
                Esquema Técnico
              </button>
            )}
          </div>
        </div>
      )}

      {/* Popover flotante al seleccionar un POI */}
      {selectedPoi && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-stone-900/95 border border-[var(--gold-accent)]/50 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--gold-title)] capitalize">
              {selectedPoi.label || selectedPoi.poiType}
            </span>
            <button
              type="button"
              onClick={() => setSelectedPoi(null)}
              className="text-[var(--gold-meta)] hover:text-white p-0.5"
              aria-label="Cerrar detalle de obstáculo"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-[var(--gold-meta)] mt-1">
            GPS: {selectedPoi.lat.toFixed(5)}, {selectedPoi.lng.toFixed(5)}
          </p>
        </div>
      )}
    </div>
  );
}
