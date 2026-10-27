'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle2, Eye, EyeOff, Medal, Save, Shield } from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  calculatePlayingHandicap,
  DEMO_HANDICAP_HISTORY,
} from '@/lib/supabase/client';
import { registerForPushNotifications } from '@/lib/capacitor/push';

const COURSE_TEES_PREVIEW = [
  { name: 'Blancas (Caballeros)', slope: 134, rating: 73.2, par: 72, color: '#CBD5E1' },
  { name: 'Amarillas (Caballeros)', slope: 128, rating: 71.5, par: 72, color: '#FACC15' },
  { name: 'Azules (Damas)', slope: 131, rating: 73.8, par: 72, color: '#3B82F6' },
  { name: 'Rojas (Damas)', slope: 124, rating: 71.1, par: 72, color: '#EF4444' },
];

export default function ProfilePage() {
  const { club, profile, updateProfile } = useClub();
  const [fullName, setFullName] = useState(profile.fullName);
  const [handicapInput, setHandicapInput] = useState(String(profile.handicapIndex));
  const [license, setLicense] = useState(profile.federationLicense);
  const [bio, setBio] = useState(profile.bio || '');
  const [isDirectoryVisible, setIsDirectoryVisible] = useState(profile.isDirectoryVisible);
  const [pushTokenInfo, setPushTokenInfo] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedHcp = Number.parseFloat(handicapInput);
    const validHcp =
      !Number.isNaN(parsedHcp) && parsedHcp >= -10 && parsedHcp <= 54
        ? Math.round(parsedHcp * 10) / 10
        : profile.handicapIndex;

    updateProfile({
      fullName: fullName.trim() || profile.fullName,
      handicapIndex: validHcp,
      federationLicense: license.trim() || profile.federationLicense,
      bio,
      isDirectoryVisible,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  const handleEnablePush = async () => {
    const registration = await registerForPushNotifications(club.clubId);
    setPushTokenInfo(`${registration.platform.toUpperCase()}: ${registration.token}`);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera de Perfil y Hándicap */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            style={{
              backgroundColor: club.theme.primary,
              color: club.theme.primaryForeground,
            }}
            className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-extrabold shadow-xs"
          >
            <span className="text-[10px] uppercase opacity-80">HCP</span>
            <span className="text-xl">{profile.handicapIndex.toFixed(1)}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{profile.fullName}</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                <Shield className="w-3.5 h-3.5" />
                {profile.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Licencia Federativa: <strong>{profile.federationLicense}</strong> · {profile.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleEnablePush}
          style={{
            backgroundColor: club.theme.accent,
            color: '#ffffff',
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs hover:opacity-95 transition cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          Activar Notificaciones Push (FCM / APNs)
        </button>
      </div>

      {pushTokenInfo && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>
            Dispositivo registrado en <code>public.device_push_tokens</code> ({pushTokenInfo})
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Datos del Jugador y Hándicap */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">
            Datos del Jugador y Configuración de Privacidad
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Licencia Federativa
              </label>
              <input
                type="text"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Índice de Hándicap WHS (-10.0 a 54.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="-10"
                max="54"
                value={handicapInput}
                onChange={(e) => setHandicapInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setIsDirectoryVisible((v) => !v)}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  isDirectoryVisible
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                <span>Visible en Directorio de Jugadores</span>
                {isDirectoryVisible ? (
                  <Eye className="w-4 h-4 text-emerald-700" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notas de juego / Preferencia de salidas
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedBanner ? (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Perfil y hándicap actualizados
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Protegido por política RLS <code>profiles_update_self_or_admin</code>
              </span>
            )}

            <button
              type="submit"
              style={{
                backgroundColor: club.theme.primary,
                color: club.theme.primaryForeground,
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Guardar Cambios
            </button>
          </div>
        </form>

        {/* Calculadora de Hándicap de Juego por Barras (Course Handicap) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Medal className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">
              Hándicap de Juego en {club.shortName}
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Golpes concedidos según las barras de salida del recorrido principal (Par 72):
          </p>

          <div className="space-y-2.5">
            {COURSE_TEES_PREVIEW.map((tee) => {
              const playingHcp = calculatePlayingHandicap({
                handicapIndex: profile.handicapIndex,
                slopeRating: tee.slope,
                courseRating: tee.rating,
                par: tee.par,
              });
              return (
                <div
                  key={tee.name}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/60"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{ backgroundColor: tee.color }}
                      className="w-3.5 h-3.5 rounded-full border border-slate-300"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{tee.name}</div>
                      <div className="text-[11px] text-slate-500">
                        CR {tee.rating} · Slope {tee.slope}
                      </div>
                    </div>
                  </div>
                  <span className="text-base font-extrabold text-slate-900">
                    {playingHcp > 0 ? `+${playingHcp}` : playingHcp} golpes
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historial de Revisiones de Hándicap */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-3">
          Historial de Evolución de Hándicap (`public.handicap_history`)
        </h2>
        <div className="divide-y divide-slate-100">
          {DEMO_HANDICAP_HISTORY.map((entry) => (
            <div
              key={entry.id}
              className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div>
                <span className="font-semibold text-slate-900">{entry.reason}</span>
                <span className="text-slate-400 ml-2">({entry.effectiveDate})</span>
              </div>
              <div className="font-mono font-bold">
                <span className="text-slate-400 line-through mr-2">
                  {entry.previousHandicap?.toFixed(1)}
                </span>
                <span className="text-emerald-700">{entry.newHandicap.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
