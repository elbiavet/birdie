'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Home } from 'lucide-react';
import DashboardPage from '@/app/page';
import { isHomeAliasPath } from '@/components/layout/AppShell';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function NotFoundPage() {
  const pathname = usePathname();
  const { club } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Si la ruta corresponde a cualquier variante o alias de inicio (ej. '/en/home/', '/es/home/', '/home/'),
  // mostramos directamente la página de Inicio (DashboardPage) sin mostrar error 404.
  if (isHomeAliasPath(pathname)) {
    return <DashboardPage />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-xs flex flex-wrap items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div
            style={{
              backgroundColor: isDark ? '#16382A' : '#0A3A2A',
              color: isDark ? '#D4AF37' : '#FFFFFF',
              borderColor: isDark ? '#255440' : '#1A4D3A',
            }}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-xs"
          >
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--theme-text-primary)]">
              Ruta redirigida al Inicio de {club.name}
            </h1>
            <p className="text-xs text-[var(--theme-text-secondary)] font-normal">
              La dirección solicitada (<code>{pathname}</code>) no existe como módulo independiente; a continuación tienes el panel principal del club.
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="btn-gold-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs transition"
        >
          <Home className="w-4 h-4" />
          Ir a Inicio
        </Link>
      </div>

      <DashboardPage />
    </div>
  );
}
