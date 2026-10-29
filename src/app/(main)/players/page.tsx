'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  filterDirectoryPlayers,
  INITIAL_DIRECTORY_PLAYERS,
  loadDirectoryPlayers,
  type HandicapBracket,
} from '@/lib/community';
import type { PlayerProfile } from '@/types/database';
import {
  Award,
  CheckCircle2,
  Filter,
  Phone,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

const HANDICAP_BRACKETS: Array<{
  id: HandicapBracket;
  label: string;
  description: string;
}> = [
  { id: 'all', label: 'Todos los Hándicaps', description: '0.0 a 36.0' },
  { id: 'low', label: '1ª Categoría (≤ 10.0)', description: 'Scratch a 10.0' },
  { id: 'mid', label: '2ª Categoría (10.1 – 20.0)', description: '10.1 a 20.0' },
  { id: 'high', label: '3ª Categoría (> 20.0)', description: '20.1 a 36.0' },
];

export default function PlayerDirectoryPage() {
  const { club } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [sourceProfiles, setSourceProfiles] = useState<PlayerProfile[]>(
    INITIAL_DIRECTORY_PLAYERS
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBracket, setSelectedBracket] =
    useState<HandicapBracket>('all');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadDirectoryPlayers()
      .then(({ players, meta }) => {
        if (!active) return;
        if (players.length > 0) {
          setSourceProfiles(players);
        }
        setSyncNotice(meta.notice);
      })
      .catch(() => {
        // Mantiene el catálogo semilla visible si no hay conexión
      });
    return () => {
      active = false;
    };
  }, []);

  const visiblePlayers = useMemo(
    () =>
      filterDirectoryPlayers(sourceProfiles, {
        searchQuery,
        bracket: selectedBracket,
      }),
    [sourceProfiles, searchQuery, selectedBracket]
  );

  const totalVisibleInClub = useMemo(
    () => filterDirectoryPlayers(sourceProfiles).length,
    [sourceProfiles]
  );

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-xs transition-colors">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
              <Users className="h-3.5 w-3.5" />
              Comunidad de Socios · Privacidad Opt-In (RLS)
            </span>
            <h2 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)]">
              Directorio de Jugadores
            </h2>
            <p className="text-sm text-[var(--theme-text-secondary)] font-normal">
              Encuentra compañeros de partida en {club.name} por nombre, licencia
              federativa o tramo de hándicap WHS. Solo se muestran socios con
              visibilidad pública activa.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-4 py-3">
            <Award className="h-8 w-8 text-[var(--theme-accent)]" />
            <div>
              <div className="text-xs font-semibold text-[var(--theme-text-secondary)]">
                Socios Visibles
              </div>
              <div className="text-xl font-metric font-bold text-[var(--theme-text-primary)]">
                {visiblePlayers.length}{' '}
                <span className="text-xs font-normal text-[var(--theme-text-secondary)]">
                  de {totalVisibleInClub}
                </span>
              </div>
            </div>
          </div>
        </div>

        {syncNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>{syncNotice}</span>
          </div>
        )}

        {/* Controles de Búsqueda y Filtro por Tramo de Hándicap */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="relative lg:col-span-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-secondary)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar socio por nombre, licencia (ej. AM-284910) o modalidad..."
              aria-label="Buscar jugador en el directorio"
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] py-2.5 pl-10 pr-4 text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-accent)] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:col-span-7">
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
              <Filter className="h-3.5 w-3.5" />
              Tramo HCP:
            </span>
            {HANDICAP_BRACKETS.map((b) => {
              const active = selectedBracket === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBracket(b.id)}
                  style={
                    active
                      ? {
                          backgroundColor: isDark ? '#D4AF37' : '#0A3A2A',
                          color: isDark ? '#08130E' : '#FFFFFF',
                          borderColor: isDark ? '#D4AF37' : '#0A3A2A',
                        }
                      : undefined
                  }
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'shadow-xs'
                      : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Listado de Tarjetas de Socios */}
      {visiblePlayers.length === 0 ? (
        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-10 text-center shadow-xs">
          <p className="text-sm font-semibold text-[var(--theme-text-primary)]">
            No se encontraron socios visibles con los filtros seleccionados.
          </p>
          <p className="mt-1 text-xs text-[var(--theme-text-secondary)] font-normal">
            Prueba con otro tramo de hándicap o limpia el término de búsqueda.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visiblePlayers.map((player) => (
            <article
              key={player.id}
              className="flex flex-col justify-between rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5 shadow-xs transition hover:border-[var(--theme-accent)]"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[var(--theme-text-primary)]">
                        {player.fullName}
                      </h3>
                      {player.role !== 'player' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                          <ShieldCheck className="h-3 w-3" />
                          Comité
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-[var(--theme-text-secondary)] font-normal">
                      Licencia RFEG: {player.federationLicense}
                    </p>
                  </div>

                  <div
                    style={{
                      backgroundColor: isDark ? '#16382A' : '#0A3A2A',
                      color: isDark ? '#D4AF37' : '#FFFFFF',
                      borderColor: isDark ? '#255440' : '#1A4D3A',
                    }}
                    className="rounded-xl border px-3 py-1.5 text-center shadow-xs"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                      HCP WHS
                    </div>
                    <div className="font-mono text-base font-metric font-bold">
                      {player.handicapIndex.toFixed(1)}
                    </div>
                  </div>
                </div>

                {player.bio && (
                  <p className="mt-3 text-xs leading-relaxed text-[var(--theme-text-secondary)] font-normal">
                    {player.bio}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--theme-border)] pt-3 text-xs text-[var(--theme-text-secondary)] font-normal">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Phone className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                  {player.phone ?? 'Contacto vía Casa Club'}
                </span>
                <span className="rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--theme-text-primary)]">
                  {player.handicapIndex <= 10
                    ? '1ª Cat.'
                    : player.handicapIndex <= 20
                    ? '2ª Cat.'
                    : '3ª Cat.'}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
