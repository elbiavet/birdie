'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Home } from 'lucide-react';
import DashboardPage from '@/app/page';
import { isHomeAliasPath } from '@/components/layout/AppShell';
import { useClub } from '@/components/providers/ClubProvider';

export default function NotFoundPage() {
  const pathname = usePathname();
  const { club } = useClub();

  // Si la ruta corresponde a cualquier variante o alias de inicio (ej. '/en/home/', '/es/home/', '/home/'),
  // mostramos directamente la página de Inicio (DashboardPage) sin mostrar error 404.
  if (isHomeAliasPath(pathname)) {
    return <DashboardPage />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            style={{
              backgroundColor: club.theme.primary,
              color: club.theme.primaryForeground,
            }}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          >
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Ruta redirigida al Inicio de {club.name}
            </h1>
            <p className="text-xs text-slate-600">
              La dirección solicitada (<code>{pathname}</code>) no existe como módulo independiente; a continuación tienes el panel principal del club.
            </p>
          </div>
        </div>
        <Link
          href="/"
          style={{
            backgroundColor: club.theme.primary,
            color: club.theme.primaryForeground,
          }}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold shadow-xs transition hover:opacity-95"
        >
          <Home className="w-4 h-4" />
          Ir a Inicio
        </Link>
      </div>

      <DashboardPage />
    </div>
  );
}
