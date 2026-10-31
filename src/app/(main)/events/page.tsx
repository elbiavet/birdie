'use client';

import React, { useEffect, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  getConfirmedEventAttendeesCount,
  INITIAL_SPECIAL_EVENTS,
  loadSpecialEvents,
  submitEventRsvp,
  type SpecialEventItem,
} from '@/lib/competition';
import {
  AlertCircle,
  CalendarHeart,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function SpecialEventsPage() {
  const { club, profile } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [events, setEvents] = useState<SpecialEventItem[]>(INITIAL_SPECIAL_EVENTS);
  const [guestsByEvent, setGuestsByEvent] = useState<Record<string, number>>({});
  const [banner, setBanner] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    loadSpecialEvents()
      .then(({ events: remoteEvents }) => {
        if (!active || remoteEvents.length === 0) return;
        setEvents(remoteEvents);
      })
      .catch((err) => {
        if (!active) return;
        setBanner({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los eventos especiales desde el servidor.',
        });
      });
    return () => {
      active = false;
    };
  }, []);

  const handleRsvp = async (
    eventId: string,
    desiredStatus: 'attending' | 'cancelled'
  ) => {
    try {
      const guestsCount = guestsByEvent[eventId] ?? 0;
      const { updatedEvents, assignedStatus, meta } = await submitEventRsvp(
        events,
        {
          eventId,
          userId: profile?.id ?? 'guest-player',
          userName: profile?.fullName ?? 'Invitado',
          guestsCount,
          desiredStatus,
        }
      );
      setEvents(updatedEvents);

      if (assignedStatus === 'attending') {
        setBanner({
          type: 'ok',
          message: `Asistencia registrada para ${profile?.fullName ?? 'Invitado'}${
            guestsCount > 0 ? ` + ${guestsCount} acompañante(s)` : ''
          }. ${meta.notice}`,
        });
      } else if (assignedStatus === 'waitlist') {
        setBanner({
          type: 'ok',
          message: `Aforo completo: asignado a Lista de Espera. ${meta.notice}`,
        });
      } else {
        setBanner({
          type: 'ok',
          message: `Tu asistencia al evento ha sido cancelada. ${meta.notice}`,
        });
      }
    } catch (err) {
      setBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al actualizar RSVP.',
      });
    }
  };

  return (
    <div className="space-y-6">
        {/* Cabecera */}
        <section className="hero-banner-luxury p-6 shadow-sm relative overflow-hidden transition-all duration-200">
          <div className="relative z-10">
            <span
              style={{
                backgroundColor: isDark ? 'rgba(42, 36, 20, 0.85)' : 'rgba(255, 255, 255, 0.7)',
                borderColor: isDark ? 'rgba(201, 173, 116, 0.35)' : 'rgba(197, 160, 89, 0.45)',
                color: isDark ? '#E4D3AC' : '#0A3A2A',
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Vida Social del Club · Gestión de Aforo y Lista de Espera
            </span>
            <h2 className="mt-2 text-2xl font-bold">
              Eventos Especiales de {club.name}
            </h2>
            <p className="text-sm font-normal opacity-90">
              Confirma tu asistencia (RSVP) a cenas de gala, entregas de trofeos y clínics
              técnicos exclusivos para socios.
            </p>
          </div>

          {banner && (
            <div
              role="status"
              className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold relative z-10 ${
                banner.type === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              }`}
            >
              {banner.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-500" />
              )}
              <span>{banner.message}</span>
            </div>
          )}
        </section>

        {/* Tarjetas de Eventos */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {events.map((ev) => {
            const confirmedSeats = getConfirmedEventAttendeesCount(ev);
            const remainingSeats = Math.max(0, ev.maxCapacity - confirmedSeats);
            const myRsvp = profile ? ev.rsvps.find((r) => r.userId === profile.id) : undefined;
            const selectedGuests =
              guestsByEvent[ev.id] ?? myRsvp?.guestsCount ?? 0;

            return (
              <div
                key={ev.id}
                className="card-luxury flex flex-col justify-between p-6 shadow-xs transition-colors"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-bold text-[var(--theme-accent)]">
                      <CalendarHeart className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                      {ev.category}
                    </span>
                    <span className="rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-bold text-[var(--theme-text-primary)]">
                      {ev.priceEuros} € / persona
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-bold text-[var(--theme-text-primary)]">
                    {ev.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--theme-text-secondary)] font-normal">
                    {ev.description}
                  </p>

                  <div className="mt-4 space-y-1.5 text-xs text-[var(--theme-text-secondary)] font-normal">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                      <span>
                        {ev.eventDate} a las {ev.eventTime} h
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                      <span>{ev.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                      <span className="font-semibold text-[var(--theme-text-primary)]">
                        Asistentes confirmados: {confirmedSeats}/{ev.maxCapacity} (
                        {remainingSeats} plazas libres)
                      </span>
                    </div>
                  </div>

                  {myRsvp && myRsvp.status !== 'cancelled' && (
                    <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-400">
                      Tu estado actual:{' '}
                      <span className="uppercase font-bold">
                        {myRsvp.status === 'attending'
                          ? 'Confirmado'
                          : 'En Lista de Espera'}
                      </span>{' '}
                      ({1 + myRsvp.guestsCount} plaza[s])
                    </div>
                  )}
                </div>

                {/* Controles RSVP */}
                <div className="mt-6 border-t border-[var(--theme-border)] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-[var(--theme-text-primary)]">
                        Acompañantes (0-3):
                      </label>
                      <select
                        value={selectedGuests}
                        aria-label={`Acompañantes para ${ev.title}`}
                        onChange={(e) =>
                          setGuestsByEvent((prev) => ({
                            ...prev,
                            [ev.id]: Number(e.target.value),
                          }))
                        }
                        className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                      >
                        <option value={0} className="bg-[var(--theme-surface)]">Solo socio (0)</option>
                        <option value={1} className="bg-[var(--theme-surface)]">+1 acompañante</option>
                        <option value={2} className="bg-[var(--theme-surface)]">+2 acompañantes</option>
                        <option value={3} className="bg-[var(--theme-surface)]">+3 acompañantes</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRsvp(ev.id, 'attending')}
                        className="btn-gold-gradient inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-xs transition hover:opacity-95 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirmar RSVP
                      </button>

                      {myRsvp && myRsvp.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleRsvp(ev.id, 'cancelled')}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
  );
}
