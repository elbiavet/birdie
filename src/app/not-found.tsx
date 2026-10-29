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
            fill="url(#notfound-hero-gold)"
          />
          <defs>
            <linearGradient id="notfound-hero-gold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9AD74" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#E6D4A7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#BA9C61" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex items-center gap-3">
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
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-sm"
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
          className="relative z-10 btn-gold-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Home className="w-4 h-4" />
          Ir a Inicio
        </Link>
      </div>

      <DashboardPage />
    </div>
  );
}
