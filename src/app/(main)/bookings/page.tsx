'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  getAvailableSeatsInSlot,
  getBookedPlayersInSlot,
  INITIAL_TEE_TIME_SLOTS,
  loadTeeTimeSlots,
  submitCancelTeeTimeBooking,
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
import { useTheme } from '@/components/providers/ThemeProvider';

export default function TeeTimeBookingsPage() {
  const { club, profile } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [slots, setSlots] = useState<TeeTimeSlot[]>(INITIAL_TEE_TIME_SLOTS);
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-01');
  const [selectedSlotId, setSelectedSlotId] = useState<string>(
    INITIAL_TEE_TIME_SLOTS[1].id
  );
  const [playersCount, setPlayersCount] = useState<number>(2);
  const [buggyRequested, setBuggyRequested] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    loadTeeTimeSlots()
      .then(({ slots: remoteSlots }) => {
        if (!active || remoteSlots.length === 0) return;
        setSlots(remoteSlots);
        setSelectedDate(remoteSlots[0].slotDate);
        setSelectedSlotId(remoteSlots[0].id);
      })
      .catch((err) => {
        if (!active) return;
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'No se pudieron sincronizar las franjas desde Supabase.',
        });
      });
    return () => {
      active = false;
    };
  }, []);

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

  const handleCancelBooking = async (bookingId: string) => {
    try {
      const { updatedSlots, meta } = await submitCancelTeeTimeBooking(
        slots,
        bookingId,
        profile.id,
        profile.role
      );
      setSlots(updatedSlots);
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
    <div className="space-y-6">
        {/* Cabecera */}
        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-xs transition-colors">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
                <CalendarDays className="h-3.5 w-3.5" />
                Control de Cupo en Vivo · RLS por Socio / Admin
              </span>
              <h2 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)]">
                Reservas de Salidas (Tee Times)
              </h2>
              <p className="text-sm text-[var(--theme-text-secondary)] font-normal">
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
                  style={
                    selectedDate === d
                      ? {
                          backgroundColor: isDark ? '#D4AF37' : '#0A3A2A',
                          color: isDark ? '#08130E' : '#FFFFFF',
                          borderColor: isDark ? '#D4AF37' : '#0A3A2A',
                        }
                      : undefined
                  }
                  className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    selectedDate === d
                      ? 'shadow-xs'
                      : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-surface)]'
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
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              }`}
            >
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-500" />
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
                  style={
                    isSelected
                      ? {
                          backgroundColor: isDark ? '#16382A' : '#E8ECE9',
                          borderColor: isDark ? '#D4AF37' : '#A38332',
                        }
                      : undefined
                  }
                  className={`cursor-pointer rounded-2xl border p-5 transition ${
                    isSelected
                      ? 'border-2 shadow-xs'
                      : 'border-[var(--theme-border)] bg-[var(--theme-surface)] hover:border-[var(--theme-accent)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          backgroundColor: isDark ? '#08130E' : '#0A3A2A',
                          color: isDark ? '#D4AF37' : '#FFFFFF',
                          borderColor: isDark ? '#255440' : '#1A4D3A',
                        }}
                        className="flex h-12 w-16 items-center justify-center rounded-xl border font-mono text-sm font-bold shadow-xs"
                      >
                        {slot.slotTime}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[var(--theme-text-primary)]">
                            Salida Tee 1 · {slot.slotDate}
                          </span>
                          <span className="rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-text-secondary)]">
                            {slot.greenFeeEuros} € / jug.
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--theme-text-secondary)] font-normal">
                          Ocupación: {bookedCount}/{slot.maxPlayers} plazas
                        </p>
                      </div>
                    </div>

                    <div>
                      {slot.isBlocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/30 px-3 py-1 text-xs font-bold text-rose-400">
                          <Lock className="h-3.5 w-3.5" />
                          Bloqueada
                        </span>
                      ) : availableSeats === 0 ? (
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400">
                          Completa (4/4)
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-accent)] px-3 py-1 text-xs font-bold text-[var(--theme-accent)]">
                          {availableSeats} plaza(s) libre(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reservas confirmadas dentro de la franja */}
                  {slot.bookings.filter((b) => b.status === 'confirmed').length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-[var(--theme-border)] pt-3">
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
                              className="flex items-center justify-between rounded-xl bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3.5 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                                <span className="font-bold text-[var(--theme-text-primary)]">
                                  {b.userName}
                                </span>
                                <span className="text-[var(--theme-text-secondary)]">
                                  ({b.playersCount} jug.)
                                </span>
                                {b.buggyRequested && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">
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
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 cursor-pointer"
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
          <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-xs lg:col-span-5 transition-colors">
            <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-4">
              <Clock className="h-5 w-5 text-[var(--theme-accent)]" />
              <div>
                <h3 className="text-lg font-bold text-[var(--theme-text-primary)]">
                  Confirmar Salida: {activeSlot.slotTime}
                </h3>
                <p className="text-xs text-[var(--theme-text-secondary)] font-normal">
                  Fecha: {activeSlot.slotDate} · Socio: {profile.fullName}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateBooking} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  Número de Jugadores (1 - 4)
                </label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPlayersCount(num)}
                      style={
                        playersCount === num
                          ? {
                              backgroundColor: isDark ? '#D4AF37' : '#0A3A2A',
                              color: isDark ? '#08130E' : '#FFFFFF',
                              borderColor: isDark ? '#D4AF37' : '#0A3A2A',
                            }
                          : undefined
                      }
                      className={`rounded-xl border py-2.5 text-sm font-bold transition cursor-pointer ${
                        playersCount === num
                          ? 'shadow-xs'
                          : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)]'
                      }`}
                    >
                      {num} {num === 1 ? 'Jug.' : 'Jug.'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3 text-xs font-semibold text-[var(--theme-text-primary)]">
                  <input
                    type="checkbox"
                    checked={buggyRequested}
                    onChange={(e) => setBuggyRequested(e.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--theme-accent)]"
                  />
                  <span>Solicitar Buggy eléctrico para la partida</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  Notas / Compañeros de Partida
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Invitado socio RFEG..."
                  className="mt-1.5 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] px-3.5 py-2.5 text-sm focus:border-[var(--theme-accent)] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={activeSlot.isBlocked}
                style={{
                  backgroundColor: isDark ? '#D4AF37' : '#0A3A2A',
                  color: isDark ? '#08130E' : '#FFFFFF',
                }}
                className="w-full rounded-xl px-5 py-3 text-sm font-bold shadow-xs transition hover:opacity-95 disabled:opacity-40 cursor-pointer"
              >
                Confirmar Reserva ({playersCount * activeSlot.greenFeeEuros} €)
              </button>
            </form>
          </section>
        </div>
      </div>
  );
}
