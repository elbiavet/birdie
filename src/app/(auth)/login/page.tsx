'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';

export default function LoginPage() {
  const router = useRouter();
  const { club, profile, setRole } = useClub();
  const { resolvedTheme } = useTheme();
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const supabaseReady = isSupabaseConfigured();
  const isDark = resolvedTheme === 'dark';

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatusMessage(
        'Modo Demo/Staging activo: se ha iniciado sesión con el perfil local seleccionado.'
      );
      router.push('/profile');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setStatusMessage(`Error de autenticación: ${error.message}`);
      return;
    }
    router.push('/');
  };

  const handleQuickRoleSelect = (role: UserRole) => {
    setRole(role);
    setStatusMessage(`Sesión cambiada al rol RLS "${role}".`);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="hero-banner-luxury relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-colors">
        {/* Curvas sutiles de fondo */}
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20 dark:opacity-15"
          viewBox="0 0 400 200"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 200 C 150 180, 250 80, 400 0 L 400 200 Z"
            fill="url(#login-hero-gold)"
          />
          <defs>
            <linearGradient id="login-hero-gold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9AD74" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#E6D4A7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#BA9C61" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex items-center gap-3 mb-4">
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
            className="w-11 h-11 rounded-xl flex items-center justify-center border shadow-sm"
          >
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--theme-text-primary)]">
              Acceso de Socios — {club.name}
            </h1>
            <p className="text-xs text-[var(--theme-text-secondary)] font-normal">
              Proyecto Supabase aislado por club · RLS activo por rol
            </p>
          </div>
        </div>

        <form onSubmit={handleSupabaseLogin} className="relative z-10 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1">
              Correo electrónico del socio
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3.5 py-2 text-sm focus:outline-none focus:border-[var(--theme-accent)]"
              placeholder="socio@club.es"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3.5 py-2 text-sm focus:outline-none focus:border-[var(--theme-accent)]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn-gold-gradient w-full py-2.5 rounded-xl font-bold text-sm shadow-xs transition cursor-pointer"
          >
            {supabaseReady ? 'Iniciar Sesión en Supabase' : 'Acceso Rápido Modo Staging / Demo'}
          </button>
        </form>

        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] text-xs text-[var(--theme-text-secondary)]">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Simulador de Roles de Usuario para Pruebas RLS */}
      <div className="card-luxury rounded-2xl border p-6 shadow-sm space-y-3 transition-colors">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[var(--theme-accent)]" />
          <h2 className="text-sm font-bold text-[var(--theme-text-primary)]">
            Conmutador de Roles RLS (Entorno Staging/Dev)
          </h2>
        </div>
        <p className="text-xs text-[var(--theme-text-secondary)] font-normal">
          Permite probar de forma reactiva las políticas RLS y los permisos de interfaz de cada
          rol:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleQuickRoleSelect('player')}
            style={
              profile.role === 'player'
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
              profile.role === 'player'
                ? 'shadow-xs font-bold'
                : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
            }`}
          >
            <div className={`font-semibold flex items-center gap-1.5 ${profile.role === 'player' ? 'text-[#0B0C10]' : 'text-[var(--theme-text-primary)]'}`}>
              <UserCheck className="w-3.5 h-3.5" />
              Jugador
            </div>
            <div className={`text-[11px] mt-0.5 ${profile.role === 'player' ? 'text-[#0B0C10]/80' : 'text-[var(--theme-text-secondary)]'}`}>
              Acceso a marcador, GPS y torneos propios
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickRoleSelect('club_admin')}
            style={
              profile.role === 'club_admin'
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
              profile.role === 'club_admin'
                ? 'shadow-xs font-bold'
                : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
            }`}
          >
            <div className={`font-semibold flex items-center gap-1.5 ${profile.role === 'club_admin' ? 'text-[#0B0C10]' : 'text-[var(--theme-text-primary)]'}`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Club
            </div>
            <div className={`text-[11px] mt-0.5 ${profile.role === 'club_admin' ? 'text-[#0B0C10]/80' : 'text-[var(--theme-text-secondary)]'}`}>
              Gestión de campos, torneos y socios
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickRoleSelect('superadmin')}
            style={
              profile.role === 'superadmin'
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
              profile.role === 'superadmin'
                ? 'shadow-xs font-bold'
                : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
            }`}
          >
            <div className={`font-semibold flex items-center gap-1.5 ${profile.role === 'superadmin' ? 'text-[#0B0C10]' : 'text-[var(--theme-text-primary)]'}`}>
              <ShieldAlert className="w-3.5 h-3.5" />
              Superadmin
            </div>
            <div className={`text-[11px] mt-0.5 ${profile.role === 'superadmin' ? 'text-[#0B0C10]/80' : 'text-[var(--theme-text-secondary)]'}`}>
              Control de infraestructura multi-club
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
