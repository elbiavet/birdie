'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { useClub } from '@/components/providers/ClubProvider';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';

export default function LoginPage() {
  const router = useRouter();
  const { club, profile, setRole } = useClub();
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const supabaseReady = isSupabaseConfigured();

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
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div
            style={{
              backgroundColor: club.theme.primary,
              color: club.theme.primaryForeground,
            }}
            className="w-11 h-11 rounded-xl flex items-center justify-center"
          >
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Acceso de Socios — {club.name}
            </h1>
            <p className="text-xs text-slate-500">
              Proyecto Supabase aislado por club · RLS activo por rol
            </p>
          </div>
        </div>

        <form onSubmit={handleSupabaseLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Correo electrónico del socio
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="socio@club.es"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            style={{
              backgroundColor: club.theme.primary,
              color: club.theme.primaryForeground,
            }}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm shadow-xs hover:opacity-95 transition cursor-pointer"
          >
            {supabaseReady ? 'Iniciar Sesión con Supabase' : 'Entrar en Modo Demo / Staging'}
          </button>
        </form>

        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Selector rápido de Roles RLS para pruebas en Staging / Local */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Simulador de Roles RLS (Staging & Desarrollo)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cambia de rol para verificar los permisos de jugador, administrador de club y superadmin.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleQuickRoleSelect('player')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              profile.role === 'player'
                ? 'border-emerald-600 bg-emerald-50/70'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-700 mb-1" />
            <div className="text-xs font-bold">Jugador (player)</div>
            <div className="text-[11px] text-slate-500">HCP 11.4 · Socio</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickRoleSelect('club_admin')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              profile.role === 'club_admin'
                ? 'border-emerald-600 bg-emerald-50/70'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-600 mb-1" />
            <div className="text-xs font-bold">Admin de Club</div>
            <div className="text-[11px] text-slate-500">Comité / Gerencia</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickRoleSelect('superadmin')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              profile.role === 'superadmin'
                ? 'border-emerald-600 bg-emerald-50/70'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-indigo-600 mb-1" />
            <div className="text-xs font-bold">Superadmin</div>
            <div className="text-[11px] text-slate-500">Multi-Club Global</div>
          </button>
        </div>
      </div>
    </div>
  );
}
