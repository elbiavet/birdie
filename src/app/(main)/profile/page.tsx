'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, Eye, EyeOff, LogOut, Medal, Save, Shield } from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/components/providers/LanguageProvider';
import {
  calculatePlayingHandicap,
  DEMO_HANDICAP_HISTORY,
} from '@/lib/supabase/client';
import {
  deactivatePushToken,
  registerForPushNotifications,
} from '@/lib/capacitor/push';

const COURSE_TEES_PREVIEW = [
  { name: 'Blancas (Caballeros)', slope: 134, rating: 73.2, par: 72, color: '#CBD5E1' },
  { name: 'Amarillas (Caballeros)', slope: 128, rating: 71.5, par: 72, color: '#FACC15' },
  { name: 'Azules (Damas)', slope: 131, rating: 73.8, par: 72, color: '#3B82F6' },
  { name: 'Rojas (Damas)', slope: 124, rating: 71.1, par: 72, color: '#EF4444' },
];

export default function ProfilePage() {
  const { club, profile, updateProfile, logout } = useClub();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [handicapInput, setHandicapInput] = useState(String(profile?.handicapIndex ?? '0.0'));
  const [license, setLicense] = useState(profile?.federationLicense || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isDirectoryVisible, setIsDirectoryVisible] = useState(profile?.isDirectoryVisible ?? true);
  const [pushTokenInfo, setPushTokenInfo] = useState<string | null>(null);
  const [currentPushToken, setCurrentPushToken] = useState<string | null>(null);
  const [isPushActive, setIsPushActive] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);
  const isDark = resolvedTheme === 'dark';

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="hero-banner-luxury relative overflow-hidden rounded-2xl border p-8 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border shadow-sm mb-4 bg-[var(--theme-surface-subtle)] text-[var(--theme-accent)]">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--theme-text-primary)]">
            {t('profile.sessionRequired')}
          </h1>
          <p className="text-sm text-[var(--theme-text-secondary)] mt-2 max-w-md mx-auto">
            {t('profile.sessionRequiredDesc')}
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold btn-gold-gradient transition shadow-sm text-xs"
            >
              {t('common.login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

  const handleTogglePush = async () => {
    try {
      setPushLoading(true);
      setPushError(null);

      if (isPushActive && currentPushToken) {
        await deactivatePushToken(currentPushToken, profile.id);
        setIsPushActive(false);
        setPushTokenInfo(null);
        setCurrentPushToken(null);
      } else {
        const registration = await registerForPushNotifications(club.clubId, profile.id);
        setCurrentPushToken(registration.token);
        setIsPushActive(true);
        setPushTokenInfo(
          `${registration.platform.toUpperCase()} (${registration.deviceName}): ${registration.token}`
        );
      }
    } catch (err) {
      setPushError(
        err instanceof Error ? err.message : 'Error al gestionar notificaciones push'
      );
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera de Perfil y Hándicap */}
      <div className="hero-banner-luxury relative overflow-hidden rounded-2xl border p-6 shadow-sm flex flex-wrap items-center justify-between gap-4 transition-colors">
        {/* Curvas sutiles de fondo */}
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20 dark:opacity-15"
          viewBox="0 0 400 200"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 200 C 150 180, 250 80, 400 0 L 400 200 Z"
            fill="url(#profile-hero-gold)"
          />
          <defs>
            <linearGradient id="profile-hero-gold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9AD74" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#E6D4A7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#BA9C61" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex items-center gap-4">
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
              color: '#0B0C10',
              borderColor: isDark ? '#DFCB9E' : '#CCB88E',
              boxShadow: isDark
                ? '0 4px 14px rgba(201, 173, 116, 0.22)'
                : '0 4px 14px rgba(169, 138, 85, 0.18)',
            }}
            className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-bold shadow-sm border"
          >
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-85">HCP</span>
            <span className="text-xl font-extrabold">{profile.handicapIndex.toFixed(1)}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--theme-text-primary)]">
                {profile.fullName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--theme-surface-subtle)] text-[var(--theme-accent)] border border-[var(--theme-border)]">
                <Shield className="w-3.5 h-3.5" />
                {profile.role}
              </span>
            </div>
            <p className="text-xs text-[var(--theme-text-secondary)] mt-0.5 font-normal">
              {t('profile.federationNumber')}: <strong className="text-[var(--theme-text-primary)]">{profile.federationLicense}</strong> · {profile.email}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePush}
            disabled={pushLoading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer border ${
              isPushActive
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
            }`}
          >
            <Bell className={`w-4 h-4 ${isPushActive ? 'text-emerald-400' : 'text-[var(--theme-accent)]'}`} />
            {pushLoading
              ? 'Conectando...'
              : isPushActive
              ? 'Desactivar Push (Activo)'
              : 'Activar Notificaciones Push (FCM / APNs)'}
          </button>

          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            {t('common.logout')}
          </button>
        </div>
      </div>

      {pushError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-2">
          <span>{pushError}</span>
        </div>
      )}

      {pushTokenInfo && (
        <div className="p-4 rounded-2xl bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-primary)] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>
            Dispositivo registrado en <code>public.device_push_tokens</code> ({pushTokenInfo})
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Datos del Jugador y Hándicap */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-2 card-luxury rounded-2xl border p-6 shadow-sm space-y-4 transition-colors"
        >
          <h2 className="text-base font-bold text-[var(--theme-text-primary)]">
            Datos del Jugador y Configuración de Privacidad
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--theme-accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1">
                Licencia Federativa
              </label>
              <input
                type="text"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--theme-accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1">
                Índice de Hándicap WHS (-10.0 a 54.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="-10"
                max="54"
                value={handicapInput}
                onChange={(e) => setHandicapInput(e.target.value)}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3 py-2 text-sm font-metric focus:outline-none focus:border-[var(--theme-accent)]"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setIsDirectoryVisible((v) => !v)}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  isDirectoryVisible
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)]'
                    : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-secondary)]'
                }`}
              >
                <span>Visible en Directorio de Jugadores</span>
                {isDirectoryVisible ? (
                  <Eye className="w-4 h-4 text-[var(--theme-accent)]" />
                ) : (
                  <EyeOff className="w-4 h-4 text-[var(--theme-text-secondary)]" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1">
              Notas de juego / Preferencia de salidas
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--theme-accent)]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedBanner ? (
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Perfil y hándicap actualizados
              </span>
            ) : (
              <span className="text-xs text-[var(--theme-text-secondary)] font-normal">
                Protegido por política RLS <code>profiles_update_self_or_admin</code>
              </span>
            )}

            <button
              type="submit"
              className="btn-gold-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition"
            >
              <Save className="w-4 h-4" />
              Guardar Cambios
            </button>
          </div>
        </form>

        {/* Calculadora de Hándicap de Juego por Barras (Course Handicap) */}
        <div className="card-luxury rounded-2xl border p-6 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center gap-2">
            <Medal className="w-5 h-5 text-[var(--theme-accent)]" />
            <h2 className="text-base font-bold text-[var(--theme-text-primary)]">
              Hándicap de Juego en {club.shortName}
            </h2>
          </div>
          <p className="text-xs text-[var(--theme-text-secondary)] font-normal">
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
                  className="flex items-center justify-between p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)]"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{ backgroundColor: tee.color }}
                      className="w-3.5 h-3.5 rounded-full border border-[var(--theme-border)]"
                    />
                    <div>
                      <div className="text-xs font-bold text-[var(--theme-text-primary)]">
                        {tee.name}
                      </div>
                      <div className="text-[11px] text-[var(--theme-text-secondary)] font-normal">
                        CR {tee.rating} · Slope {tee.slope}
                      </div>
                    </div>
                  </div>
                  <span className="text-base font-metric text-[var(--theme-text-primary)]">
                    {playingHcp > 0 ? `+${playingHcp}` : playingHcp} golpes
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historial de Revisiones de Hándicap */}
      <div className="bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)] p-6 shadow-xs transition-colors">
        <h2 className="text-base font-bold text-[var(--theme-text-primary)] mb-3">
          Historial de Evolución de Hándicap (<code>public.handicap_history</code>)
        </h2>
        <div className="divide-y divide-[var(--theme-border)]">
          {DEMO_HANDICAP_HISTORY.map((entry) => (
            <div
              key={entry.id}
              className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div>
                <span className="font-semibold text-[var(--theme-text-primary)]">
                  {entry.reason}
                </span>
                <span className="text-[var(--theme-text-secondary)] ml-2">
                  ({entry.effectiveDate})
                </span>
              </div>
              <div className="font-mono font-metric">
                <span className="text-[var(--theme-text-secondary)] line-through mr-2">
                  {entry.previousHandicap?.toFixed(1)}
                </span>
                <span className="text-[var(--theme-accent)]">{entry.newHandicap.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
