'use client';

import React, { useState } from 'react';
import type { GolfApiHole, GolfApiPoi } from '@/lib/golf-api/types';
import { useTranslation } from '@/components/providers/LanguageProvider';
import { Compass, AlertCircle, RefreshCw, Layers, Image as ImageIcon } from 'lucide-react';

interface HoleDiagramViewProps {
  hole: GolfApiHole | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  clubName?: string;
  courseName?: string;
}

export function HoleDiagramView({
  hole,
  isLoading = false,
  error = null,
  onRetry,
  clubName = 'Club de Golf',
  courseName = 'Campo Principal',
}: HoleDiagramViewProps) {
  const { t } = useTranslation();
  const [selectedPoi, setSelectedPoi] = useState<GolfApiPoi | null>(null);
  const [viewMode, setViewMode] = useState<'vector' | 'photo'>('vector');
  const [photoError, setPhotoError] = useState(false);

  if (isLoading) {
    return (
      <div
        className="w-full h-96 rounded-2xl border border-[var(--border-luxury)] bg-[var(--card-bg)] flex flex-col items-center justify-center p-6 animate-pulse"
        role="status"
        aria-label={t('course.loadingDiagram')}
      >
        <div className="w-12 h-12 rounded-full border-2 border-[var(--gold-accent)] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-medium text-[var(--gold-title)]">{t('course.loadingDiagram')}</p>
        <p className="text-xs text-[var(--gold-meta)] mt-1">{t('course.loadingCotas')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full h-96 rounded-2xl border border-red-500/30 bg-red-950/20 flex flex-col items-center justify-center p-6 text-center"
        role="alert"
      >
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <h3 className="text-base font-bold text-red-200">{t('course.errorLoadingDiagram')}</h3>
        <p className="text-xs text-red-300/80 max-w-sm mt-1 mb-4">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-red-900/40 text-red-200 border border-red-700/50 hover:bg-red-800/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('common.retry')}
          </button>
        )}
      </div>
    );
  }

  if (!hole) {
    return (
      <div className="w-full h-96 rounded-2xl border border-[var(--border-luxury)] bg-[var(--card-bg)] flex flex-col items-center justify-center p-6 text-center">
        <Compass className="w-10 h-10 text-[var(--gold-meta)] mb-3 opacity-60" />
        <p className="text-sm font-medium text-[var(--gold-title)]">{t('course.noHoleInfo')}</p>
        <p className="text-xs text-[var(--gold-meta)] mt-1">{t('course.noHoleInfoDesc')}</p>
      </div>
    );
  }

  const hasPhoto = Boolean(hole.photoUrl) && !photoError;
  const bunkers = hole.pois.filter((p) => p.poiType === 'bunker');
  const waterHazards = hole.pois.filter((p) => p.poiType === 'water_hazard');
  const doglegs = hole.pois.filter((p) => p.poiType === 'dogleg');

  // Curvatura del Fairway si hay dogleg
  const doglegPoi = doglegs[0];
  const hasDogleg = Boolean(doglegPoi);
  const fairwayCurvatureX = hasDogleg ? 190 : 160;

  return (
    <div className="w-full rounded-2xl border border-[var(--border-luxury)] bg-[var(--card-bg)] overflow-hidden shadow-lg flex flex-col">
      {/* Barra superior de herramientas y controles del diagrama */}
      <div className="px-4 py-3 border-b border-[var(--border-luxury)] bg-[var(--card-bg-elevated)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[var(--gold-accent)]/20 text-[var(--gold-title)] font-bold text-xs flex items-center justify-center border border-[var(--gold-accent)]/40">
            H{hole.holeNumber}
          </span>
          <div>
            <span className="text-xs font-bold text-[var(--gold-title)] tracking-wide uppercase">
              {t('common.par')} {hole.par} · {t('common.hcp')} {hole.strokeIndex}
            </span>
            <p className="text-[10px] text-[var(--gold-meta)]">
              {courseName} · {clubName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPhoto && (
            <div className="inline-flex rounded-full p-0.5 bg-black/20 border border-[var(--border-luxury)] text-xs">
              <button
                type="button"
                onClick={() => setViewMode('vector')}
                className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1.5 text-[11px] font-medium ${
                  viewMode === 'vector'
                    ? 'bg-[var(--gold-accent)] text-stone-900 font-bold shadow-sm'
                    : 'text-[var(--gold-meta)] hover:text-[var(--gold-title)]'
                }`}
              >
                <Layers className="w-3 h-3" />
                {t('course.technicalDiagram')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('photo')}
                className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1.5 text-[11px] font-medium ${
                  viewMode === 'photo'
                    ? 'bg-[var(--gold-accent)] text-stone-900 font-bold shadow-sm'
                    : 'text-[var(--gold-meta)] hover:text-[var(--gold-title)]'
                }`}
              >
                <ImageIcon className="w-3 h-3" />
                {t('course.photography')}
              </button>
            </div>
          )}

          <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-600/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t('course.gpsOfficial')}
          </div>
        </div>
      </div>

      {/* Contenido principal: Fotografía o Trazado Técnico Vectorial */}
      <div className="relative w-full bg-gradient-to-b from-stone-950 via-[#0B1512] to-stone-950 flex flex-col items-center justify-center p-4 min-h-[460px]">
        {viewMode === 'photo' && hasPhoto ? (
          <div className="w-full h-full min-h-[420px] flex items-center justify-center rounded-xl overflow-hidden relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hole.photoUrl}
              alt={`Fotografía oficial del Hoyo ${hole.holeNumber}`}
              className="w-full h-full object-cover max-h-[460px] rounded-xl"
              onError={() => {
                setPhotoError(true);
                setViewMode('vector');
              }}
            />
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs text-white">
              {t('course.photoOfficial')}
            </div>
          </div>
        ) : (
          <div className="relative w-full max-w-[340px] aspect-[340/520] flex items-center justify-center">
            {/* SVG Vectorial Técnico */}
            <svg
              viewBox="0 0 320 500"
              className="w-full h-full drop-shadow-2xl select-none"
              role="img"
              aria-label={`Plano vectorial del hoyo ${hole.holeNumber}, par ${hole.par}`}
            >
              <defs>
                {/* Degradado del Rough general */}
                <linearGradient id="roughGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0B2B20" />
                  <stop offset="50%" stopColor="#0E382A" />
                  <stop offset="100%" stopColor="#0B2B20" />
                </linearGradient>

                {/* Degradado de la Calle (Fairway) */}
                <linearGradient id="fairwayGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#156449" />
                  <stop offset="50%" stopColor="#1C7E5D" />
                  <stop offset="100%" stopColor="#259C73" />
                </linearGradient>

                {/* Degradado del Green */}
                <radialGradient id="greenGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3DD598" />
                  <stop offset="70%" stopColor="#28A779" />
                  <stop offset="100%" stopColor="#1B7A57" />
                </radialGradient>

                {/* Patrón de Bunker de arena fina */}
                <radialGradient id="bunkerGrad" cx="40%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#F5E5C9" />
                  <stop offset="80%" stopColor="#D8BE90" />
                  <stop offset="100%" stopColor="#BFA06B" />
                </radialGradient>

                {/* Agua */}
                <linearGradient id="waterGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#0284C7" />
                </linearGradient>
              </defs>

              {/* Contorno del Campo / Rough perimetral */}
              <rect x="10" y="10" width="300" height="480" rx="20" fill="url(#roughGrad)" stroke="rgba(212, 186, 128, 0.15)" strokeWidth="1" />

              {/* Arcos de Cota de Distancia (a 100m, 150m, 200m del Green) */}
              <g stroke="rgba(255, 255, 255, 0.12)" strokeDasharray="3 3" fill="none">
                <path d="M 60 160 Q 160 180 260 160" />
                <path d="M 50 220 Q 160 250 270 220" />
                <path d="M 40 280 Q 160 320 280 280" />
              </g>
              <text x="30" y="162" fill="rgba(255, 255, 255, 0.35)" fontSize="9" fontFamily="monospace">100m</text>
              <text x="25" y="222" fill="rgba(255, 255, 255, 0.35)" fontSize="9" fontFamily="monospace">150m</text>
              <text x="20" y="282" fill="rgba(255, 255, 255, 0.35)" fontSize="9" fontFamily="monospace">200m</text>

              {/* Trazado Fairway (Calle) curvada con dogleg si aplica */}
              <path
                d={`M 140 430 C 130 350, ${fairwayCurvatureX - 35} 250, 140 100 C 145 75, 175 75, 180 100 C 190 250, ${fairwayCurvatureX + 35} 350, 180 430 Z`}
                fill="url(#fairwayGrad)"
                stroke="#2FB584"
                strokeWidth="1.2"
                className="transition-all duration-300"
              />

              {/* Eje de tiro / Línea de diana */}
              <path
                d={`M 160 440 Q ${fairwayCurvatureX} 260 160 85`}
                stroke="rgba(212, 186, 128, 0.3)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                fill="none"
              />

              {/* Obstáculos de agua (si existen en POIs) */}
              {waterHazards.map((w, idx) => (
                <ellipse
                  key={w.id || idx}
                  cx={idx % 2 === 0 ? 105 : 215}
                  cy={180 + idx * 45}
                  rx="22"
                  ry="14"
                  fill="url(#waterGrad)"
                  stroke="#7DD3FC"
                  strokeWidth="1"
                  className="cursor-pointer hover:opacity-90"
                  onClick={() => setSelectedPoi(w)}
                />
              ))}

              {/* Bunkers (si existen en POIs o perimetrales del green) */}
              {bunkers.length > 0 ? (
                bunkers.map((b, idx) => {
                  const isLeft = idx % 2 === 0;
                  const bx = isLeft ? 122 : 198;
                  const by = 80 + (idx * 28);
                  return (
                    <ellipse
                      key={b.id || idx}
                      cx={bx}
                      cy={by}
                      rx="14"
                      ry="9"
                      fill="url(#bunkerGrad)"
                      stroke="#8C6F3D"
                      strokeWidth="1"
                      className="cursor-pointer hover:brightness-110"
                      onClick={() => setSelectedPoi(b)}
                    />
                  );
                })
              ) : (
                <>
                  {/* Bunker estándar por defecto alrededor del green */}
                  <ellipse cx="125" cy="85" rx="12" ry="8" fill="url(#bunkerGrad)" stroke="#8C6F3D" strokeWidth="1" />
                  <ellipse cx="195" cy="90" rx="10" ry="7" fill="url(#bunkerGrad)" stroke="#8C6F3D" strokeWidth="1" />
                </>
              )}

              {/* Complejo del Green */}
              {/* Fringe / Antegreen */}
              <ellipse cx="160" cy="85" rx="34" ry="24" fill="#1B7A57" opacity="0.6" />
              {/* Green superficie */}
              <ellipse cx="160" cy="85" rx="28" ry="19" fill="url(#greenGrad)" stroke="#52E3A7" strokeWidth="1.5" />

              {/* Cotas del Green: Frente, Centro, Fondo */}
              <circle cx="160" cy="98" r="2.5" fill="#FFFFFF" opacity="0.8" />
              <text x="168" y="100" fill="#FFFFFF" fontSize="7" opacity="0.8">Frente</text>

              <circle cx="160" cy="85" r="3" fill="#D4AF37" />
              <circle cx="160" cy="72" r="2.5" fill="#FFFFFF" opacity="0.8" />
              <text x="168" y="74" fill="#FFFFFF" fontSize="7" opacity="0.8">Fondo</text>

              {/* Bandera en Green Center */}
              <g transform="translate(160, 85)" className="cursor-pointer">
                {/* Mástil */}
                <line x1="0" y1="0" x2="0" y2="-18" stroke="#FFFFFF" strokeWidth="1.5" />
                {/* Banderín rojo/dorado */}
                <polygon points="0,-18 12,-13 0,-8" fill="#E11D48" stroke="#FFF" strokeWidth="0.5" />
                <circle cx="0" cy="0" r="2" fill="#D4AF37" />
              </g>

              {/* Zona de Salida (Tee Boxes) */}
              <rect x="135" y="440" width="50" height="26" rx="6" fill="#0D4433" stroke="#2FB584" strokeWidth="1" />
              {/* 4 Tees con colores federativos */}
              <circle cx="145" cy="448" r="3" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.5" />
              <circle cx="155" cy="448" r="3" fill="#FACC15" stroke="#CA8A04" strokeWidth="0.5" />
              <circle cx="165" cy="448" r="3" fill="#38BDF8" stroke="#0284C7" strokeWidth="0.5" />
              <circle cx="175" cy="448" r="3" fill="#F43F5E" stroke="#BE123C" strokeWidth="0.5" />
              <text x="160" y="461" fill="rgba(255, 255, 255, 0.7)" fontSize="7" textAnchor="middle" fontWeight="bold">
                TEES
              </text>

              {/* Distancia principal destacada al pie del hoyo */}
              <g transform="translate(160, 485)">
                <text x="0" y="0" textAnchor="middle" fill="#E4D3AC" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                  {hole.distanceYellowMeters}{t('common.meters')} ({t('course.yellowTees')}) · {Math.round(hole.distanceYellowMeters * 1.09361)} {t('common.yards')}
                </text>
              </g>
            </svg>

            {/* Píldora de información POI seleccionada */}
            {selectedPoi && (
              <div className="absolute top-4 left-4 right-4 bg-stone-900/95 border border-[var(--gold-accent)]/50 rounded-xl p-3 shadow-xl backdrop-blur-md animate-fadeIn text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--gold-title)] capitalize">
                    {selectedPoi.label || selectedPoi.poiType}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPoi(null)}
                    className="text-[var(--gold-meta)] hover:text-white p-0.5"
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
        )}

        {/* Leyenda y especificación de datos de Golf API */}
        <div className="w-full mt-2 pt-2 border-t border-white/5 flex flex-wrap items-center justify-between text-[11px] text-[var(--gold-meta)] gap-2 px-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15] inline-block" /> {t('course.yellowTees')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F8FAFC] inline-block" /> {t('course.whiteTees')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] inline-block" /> {t('course.blueTees')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E] inline-block" /> {t('course.redTees')}
            </span>
          </div>
          <span className="text-[10px] italic opacity-75">
            {t('course.apiNotice')}
          </span>
        </div>
      </div>
    </div>
  );
}
