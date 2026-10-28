'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useClub } from '@/components/providers/ClubProvider';
import {
  getConfirmedEventAttendeesCount,
  INITIAL_SPECIAL_EVENTS,
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

export default function SpecialEventsPage() {
  const { club, profile } = useClub();
  const [events, setEvents] = useState<SpecialEventItem[]>(INITIAL_SPECIAL_EVENTS);
  const [guestsByEvent, setGuestsByEvent] = useState<Record<string, number>>({});
  const [banner, setBanner] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

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
          userId: profile.id,
          userName: profile.fullName,
          guestsCount,
          desiredStatus,
        }
      );
      setEvents(updatedEvents);

      if (assignedStatus === 'attending') {
        setBanner({
          type: 'ok',
          message: `Asistencia registrada para ${profile.fullName}${
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
    <AppShell>
      <div className="space-y-6">
        {/* Cabecera */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <Sparkles className="h-3.5 w-3.5" />
            Vida Social del Club · Gestión de Aforo y Lista de Espera
          </span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Eventos Especiales de {club.name}
          </h2>
          <p className="text-sm text-slate-600">
            Confirma tu asistencia (RSVP) a cenas de gala, entregas de trofeos y clínics
            técnicos exclusivos para socios.
          </p>

          {banner && (
            <div
              role="status"
              className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${
                banner.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {banner.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600" />
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
            const myRsvp = ev.rsvps.find((r) => r.userId === profile.id);
            const selectedGuests =
              guestsByEvent[ev.id] ?? myRsvp?.guestsCount ?? 0;

            return (
              <div
                key={ev.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
                      <CalendarHeart className="h-3.5 w-3.5 text-amber-600" />
                      {ev.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                      {ev.priceEuros} € / persona
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-bold text-slate-900">
                    {ev.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {ev.description}
                  </p>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {ev.eventDate} a las {ev.eventTime} h
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{ev.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-emerald-700" />
                      <span className="font-semibold text-slate-800">
                        Asistentes confirmados: {confirmedSeats}/{ev.maxCapacity} (
                        {remainingSeats} plazas libres)
                      </span>
                    </div>
                  </div>

                  {myRsvp && myRsvp.status !== 'cancelled' && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-900">
                      Tu estado actual:{' '}
                      <span className="uppercase">
                        {myRsvp.status === 'attending'
                          ? 'Confirmado'
                          : 'En Lista de Espera'}
                      </span>{' '}
                      ({1 + myRsvp.guestsCount} plaza[s])
                    </div>
                  )}
                </div>

                {/* Controles RSVP */}
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-700">
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
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
                      >
                        <option value={0}>Solo socio (0)</option>
                        <option value={1}>+1 acompañante</option>
                        <option value={2}>+2 acompañantes</option>
                        <option value={3}>+3 acompañantes</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRsvp(ev.id, 'attending')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-club-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirmar RSVP
                      </button>

                      {myRsvp && myRsvp.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleRsvp(ev.id, 'cancelled')}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
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
    </AppShell>
  );
}
