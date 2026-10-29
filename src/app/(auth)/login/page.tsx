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
      <div className="bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)] p-6 shadow-xs transition-colors">
        <div className="flex items-center gap-3 mb-4">
          <div
            style={{
              backgroundColor: isDark ? '#16382A' : '#0A3A2A',
              color: isDark ? '#D4AF37' : '#FFFFFF',
              borderColor: isDark ? '#255440' : '#1A4D3A',
            }}
            className="w-11 h-11 rounded-xl flex items-center justify-center border shadow-xs"
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

        <form onSubmit={handleSupabaseLogin} className="space-y-4">
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
      <div className="bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)] p-6 shadow-xs space-y-3 transition-colors">
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
            className={`p-3 rounded-xl border text-left transition text-xs ${
              profile.role === 'player'
                ? 'border-[var(--theme-accent)] bg-[var(--theme-surface-subtle)] font-bold'
                : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'
            }`}
          >
            <div className="font-semibold text-[var(--theme-text-primary)] flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              Jugador
            </div>
            <div className="text-[11px] text-[var(--theme-text-secondary)] mt-0.5">
              Acceso a marcador, GPS y torneos propios
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickRoleSelect('club_admin')}
            className={`p-3 rounded-xl border text-left transition text-xs ${
              profile.role === 'club_admin'
                ? 'border-[var(--theme-accent)] bg-[var(--theme-surface-subtle)] font-bold'
                : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'
            }`}
          >
            <div className="font-semibold text-[var(--theme-text-primary)] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              Admin Club
            </div>
            <div className="text-[11px] text-[var(--theme-text-secondary)] mt-0.5">
              Gestión de campos, torneos y socios
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickRoleSelect('superadmin')}
            className={`p-3 rounded-xl border text-left transition text-xs ${
              profile.role === 'superadmin'
                ? 'border-[var(--theme-accent)] bg-[var(--theme-surface-subtle)] font-bold'
                : 'border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'
            }`}
          >
            <div className="font-semibold text-[var(--theme-text-primary)] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              Superadmin
            </div>
            <div className="text-[11px] text-[var(--theme-text-secondary)] mt-0.5">
              Control de infraestructura multi-club
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
