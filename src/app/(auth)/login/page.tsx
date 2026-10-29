'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LogOut,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  ArrowRight,
} from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/components/providers/LanguageProvider';
import { AuthAccessView } from '@/components/auth/AuthAccessView';
import type { UserRole } from '@/types/database';

export default function LoginPage() {
  const router = useRouter();
  const {
    club,
    profile,
    authenticatedProfile,
    canSimulateRoles,
    simulatedRole,
    setRole,
    resetSimulatedRole,
    logout,
  } = useClub();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();

  const isDark = resolvedTheme === 'dark';

  // Si el usuario ya tiene una sesión válida y navega a la página de acceso, llévalo a la página principal de la aplicación
  useEffect(() => {
    if (authenticatedProfile) {
      router.push('/');
    }
  }, [authenticatedProfile, router]);

  const handleSimulateRole = (role: UserRole) => {
    setRole(role);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Si el usuario ya tiene una sesión válida, mostrar aviso de redirección */}
      {authenticatedProfile ? (
        <>
          <div className="hero-banner-luxury rounded-3xl border p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-[var(--theme-border)]">
              <h1 className="text-xl font-bold text-[var(--theme-text-primary)]">
                {t('auth.loginTitle')} — {club.name}
              </h1>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-accent)]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[var(--theme-text-primary)]">
                    {authenticatedProfile.fullName}
                  </p>
                  <p className="text-[11px] text-[var(--theme-text-secondary)]">
                    Sesión activa · Rol:{' '}
                    <strong className="capitalize text-[var(--theme-text-primary)]">
                      {authenticatedProfile.role}
                    </strong>
                    {simulatedRole && (
                      <span className="ml-1.5 text-amber-500 font-medium">
                        (Simulando: {simulatedRole})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                title={t('common.logout')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400 hover:bg-rose-500/20 transition cursor-pointer font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('common.logout')}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-xs flex items-center justify-between">
              <span className="text-[var(--theme-text-secondary)]">
                Ya has iniciado sesión en {club.name}. Redirigiendo al panel principal...
              </span>
              <Link
                href="/"
                className="btn-gold-gradient px-3.5 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 shadow-xs"
              >
                <span>{t('auth.goToDashboard', 'Ir al Panel')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Cuentas demo accesibles */}
          <div
            data-testid="demo-accounts-panel"
            className="card-luxury rounded-2xl border p-5 space-y-3 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--theme-accent)]" />
              <h2 className="text-xs font-bold text-[var(--theme-text-primary)]">
                Acceso Rápido con Perfiles Demo Autorizados (1 Clic)
              </h2>
            </div>
            <p className="text-[11px] text-[var(--theme-text-secondary)]">
              Para cambiar de cuenta de demostración rápidamente:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setTimeout(() => router.push('/login'), 50);
                }}
                className="p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-left hover:border-[var(--theme-accent)] transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-[var(--theme-accent)]">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Superadmin</span>
                </div>
                <div className="text-[10px] text-[var(--theme-text-secondary)] mt-0.5 truncate">
                  ops@birdie.app
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  setTimeout(() => router.push('/login'), 50);
                }}
                className="p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-left hover:border-[var(--theme-accent)] transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-[var(--theme-text-primary)]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Club</span>
                </div>
                <div className="text-[10px] text-[var(--theme-text-secondary)] mt-0.5 truncate">
                  comite@rcgvalleverde.es
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  setTimeout(() => router.push('/login'), 50);
                }}
                className="p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-left hover:border-[var(--theme-accent)] transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-[var(--theme-text-primary)]">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Jugador</span>
                </div>
                <div className="text-[10px] text-[var(--theme-text-secondary)] mt-0.5 truncate">
                  carlos.mendoza@socio.es
                </div>
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Si el usuario NO tiene sesión válida, muestra la página de acceso completa */
        <AuthAccessView />
      )}

      {/* Simulador de Roles de Usuario: EXCLUSIVO para superadmin autenticado */}
      {canSimulateRoles && (
        <div
          data-testid="superadmin-simulator-panel"
          className="card-luxury rounded-2xl border p-6 shadow-sm space-y-3 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--theme-accent)]" />
              <h2 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Simulador de Roles RLS (Exclusivo Superadmin)
              </h2>
            </div>
            {simulatedRole && (
              <button
                type="button"
                onClick={resetSimulatedRole}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--theme-accent)] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer a Superadmin</span>
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--theme-text-secondary)] font-normal">
            Como usuario con rol autenticado <code className="font-mono text-emerald-400">superadmin</code>,
            puedes simular la perspectiva y permisos de interfaz de cualquiera de los roles:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleSimulateRole('player')}
              style={
                profile?.role === 'player'
                  ? {
                      background: isDark
                        ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                        : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                      borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                      color: '#0B0C10',
                    }
                  : undefined
              }
              className={`p-3 rounded-xl border text-left transition text-xs cursor-pointer ${
                profile?.role === 'player'
                  ? 'shadow-xs font-bold'
                  : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
              }`}
            >
              <div
                className={`font-semibold flex items-center gap-1.5 ${
                  profile?.role === 'player' ? 'text-[#0B0C10]' : 'text-[var(--theme-text-primary)]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Jugador (Player)</span>
              </div>
              <div
                className={`text-[11px] mt-0.5 ${
                  profile?.role === 'player'
                    ? 'text-[#0B0C10]/80'
                    : 'text-[var(--theme-text-secondary)]'
                }`}
              >
                Acceso a marcador, GPS y torneos propios
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSimulateRole('club_admin')}
              style={
                profile?.role === 'club_admin'
                  ? {
                      background: isDark
                        ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                        : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                      borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                      color: '#0B0C10',
                    }
                  : undefined
              }
              className={`p-3 rounded-xl border text-left transition text-xs cursor-pointer ${
                profile?.role === 'club_admin'
                  ? 'shadow-xs font-bold'
                  : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
              }`}
            >
              <div
                className={`font-semibold flex items-center gap-1.5 ${
                  profile?.role === 'club_admin'
                    ? 'text-[#0B0C10]'
                    : 'text-[var(--theme-text-primary)]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Club</span>
              </div>
              <div
                className={`text-[11px] mt-0.5 ${
                  profile?.role === 'club_admin'
                    ? 'text-[#0B0C10]/80'
                    : 'text-[var(--theme-text-secondary)]'
                }`}
              >
                Gestión de campos, torneos y socios
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSimulateRole('superadmin')}
              style={
                profile?.role === 'superadmin'
                  ? {
                      background: isDark
                        ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                        : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                      borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                      color: '#0B0C10',
                    }
                  : undefined
              }
              className={`p-3 rounded-xl border text-left transition text-xs cursor-pointer ${
                profile?.role === 'superadmin'
                  ? 'shadow-xs font-bold'
                  : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
              }`}
            >
              <div
                className={`font-semibold flex items-center gap-1.5 ${
                  profile?.role === 'superadmin'
                    ? 'text-[#0B0C10]'
                    : 'text-[var(--theme-text-primary)]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Superadmin</span>
              </div>
              <div
                className={`text-[11px] mt-0.5 ${
                  profile?.role === 'superadmin'
                    ? 'text-[#0B0C10]/80'
                    : 'text-[var(--theme-text-secondary)]'
                }`}
              >
                Control de infraestructura multi-club y App ID
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
