'use client';

import React, { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useClub } from '@/components/providers/ClubProvider';
import {
  cancelTeeTimeBooking,
  getAvailableSeatsInSlot,
  getBookedPlayersInSlot,
  INITIAL_TEE_TIME_SLOTS,
  resolvePersistenceMetadata,
  submitTeeTimeBooking,
  type TeeTimeSlot,
} from '@/lib/competition';
import {
  AlertCircle,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  Lock,
  Trash2,
  Users,
} from 'lucide-react';

export default function TeeTimeBookingsPage() {
  const { club, profile } = useClub();
  const [slots, setSlots] = useState<TeeTimeSlot[]>(INITIAL_TEE_TIME_SLOTS);
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-01');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('slot-2026-11-01-0840');
  const [playersCount, setPlayersCount] = useState<number>(2);
  const [buggyRequested, setBuggyRequested] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const availableDates = useMemo(
    () => Array.from(new Set(slots.map((s) => s.slotDate))),
    [slots]
  );

  const filteredSlots = useMemo(
    () => slots.filter((s) => !selectedDate || s.slotDate === selectedDate),
    [slots, selectedDate]
  );

  const activeSlot = useMemo(
    () =>
      filteredSlots.find((s) => s.id === selectedSlotId) ??
      filteredSlots[0] ??
      slots[0],
    [filteredSlots, selectedSlotId, slots]
  );

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { updatedSlots, createdBooking, meta } = await submitTeeTimeBooking(
        slots,
        {
          slotId: activeSlot.id,
          userId: profile.id,
          userName: profile.fullName,
          playersCount,
          buggyRequested,
          notes,
        }
      );
      setSlots(updatedSlots);
      setNotes('');
      setFeedback({
        type: 'ok',
        message: `Salida ${activeSlot.slotTime} (${createdBooking.playersCount} jug.): ${meta.notice}`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al procesar la reserva.',
      });
    }
  };

  const handleCancelBooking = (bookingId: string) => {
    try {
      const next = cancelTeeTimeBooking(slots, bookingId, profile.id, profile.role);
      const meta = resolvePersistenceMetadata();
      setSlots(next);
      setFeedback({
        type: 'ok',
        message: `Reserva cancelada y plazas liberadas. ${meta.notice}`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No se pudo cancelar la reserva.',
      });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Cabecera */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <CalendarDays className="h-3.5 w-3.5" />
                Control de Cupo en Vivo · RLS por Socio / Admin
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Reservas de Salidas (Tee Times)
              </h2>
              <p className="text-sm text-slate-600">
                Selecciona tu fecha y franja horaria en {club.name}. Máximo 4 jugadores
                por salida.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {availableDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                    selectedDate === d
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {feedback && (
            <div
              role="status"
              className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${
                feedback.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </section>

        {/* Grid: Parrilla de Salidas + Formulario de Reserva */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Parrilla de Salidas */}
          <section className="space-y-3 lg:col-span-7">
            {filteredSlots.map((slot) => {
              const bookedCount = getBookedPlayersInSlot(slot);
              const availableSeats = getAvailableSeatsInSlot(slot);
              const isSelected = slot.id === activeSlot.id;

              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`cursor-pointer rounded-2xl border p-5 transition ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-16 items-center justify-center rounded-xl bg-slate-900 font-mono text-sm font-black text-white">
                        {slot.slotTime}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            Salida Tee 1 · {slot.slotDate}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            {slot.greenFeeEuros} € / jug.
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Ocupación: {bookedCount}/{slot.maxPlayers} plazas
                        </p>
                      </div>
                    </div>

                    <div>
                      {slot.isBlocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                          <Lock className="h-3.5 w-3.5" />
                          Bloqueada
                        </span>
                      ) : availableSeats === 0 ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                          Completa (4/4)
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
                          {availableSeats} plaza(s) libre(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reservas confirmadas dentro de la franja */}
                  {slot.bookings.filter((b) => b.status === 'confirmed').length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                      {slot.bookings
                        .filter((b) => b.status === 'confirmed')
                        .map((b) => {
                          const canCancel =
                            b.userId === profile.id ||
                            profile.role === 'club_admin' ||
                            profile.role === 'superadmin';

                          return (
                            <div
                              key={b.id}
                              className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-emerald-700" />
                                <span className="font-bold text-slate-900">
                                  {b.userName}
                                </span>
                                <span className="text-slate-600">
                                  ({b.playersCount} jug.)
                                </span>
                                {b.buggyRequested && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                    <Car className="h-3 w-3" />
                                    Buggy
                                  </span>
                                )}
                              </div>

                              {canCancel && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelBooking(b.id);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Cancelar
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* Formulario de Reserva */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <Clock className="h-5 w-5 text-emerald-700" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Confirmar Salida: {activeSlot.slotTime}
                </h3>
                <p className="text-xs text-slate-500">
                  Fecha: {activeSlot.slotDate} · Socio: {profile.fullName}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateBooking} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Número de Jugadores (1 - 4)
                </label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPlayersCount(num)}
                      className={`rounded-xl border py-2.5 text-sm font-bold transition ${
                        playersCount === num
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {num} {num === 1 ? 'Jug.' : 'Jug.'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={buggyRequested}
                    onChange={(e) => setBuggyRequested(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <span>Solicitar Buggy eléctrico para la partida</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Notas / Compañeros de Partida
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Invitado socio RFEG..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={activeSlot.isBlocked}
                className="w-full rounded-xl bg-club-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-40"
              >
                Confirmar Reserva ({playersCount * activeSlot.greenFeeEuros} €)
              </button>
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
