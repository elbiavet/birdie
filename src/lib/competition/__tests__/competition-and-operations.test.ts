import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  cancelTeeTimeBooking,
  createTeeTimeBooking,
  filterCalendarMatches,
  getAvailableSeatsInSlot,
  getBookedPlayersInSlot,
  getConfirmedEventAttendeesCount,
  INITIAL_CALENDAR_MATCHES,
  INITIAL_SPECIAL_EVENTS,
  INITIAL_TEE_TIME_SLOTS,
  INITIAL_TOURNAMENTS,
  isValidUuid,
  joinOpenMatch,
  loadSpecialEvents,
  loadTeeTimeSlots,
  rankTournamentLeaderboard,
  registerPlayerInTournament,
  resolvePersistenceMetadata,
  submitCancelTeeTimeBooking,
  submitEventRsvp,
  submitTeeTimeBooking,
  upsertEventRsvp,
} from '../index';
import { AppShell } from '@/components/layout/AppShell';
import { ClubProvider } from '@/components/providers/ClubProvider';
import TeeTimeBookingsPage from '@/app/(main)/bookings/page';
import MatchCalendarPage from '@/app/(main)/calendar/page';
import TournamentsAndLeaderboardPage from '@/app/(main)/tournaments/page';
import SpecialEventsPage from '@/app/(main)/events/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/bookings',
}));

describe('Competición y Operaciones (Fase 3: Reservas, Calendario, Torneos y Eventos)', () => {
  it('gestiona reservas de Tee Times respetando cupo máximo (1..4), franjas bloqueadas y colisiones', () => {
    const slot0830 = INITIAL_TEE_TIME_SLOTS[0]; // Tiene 2 plazas ocupadas de 4
    expect(getBookedPlayersInSlot(slot0830)).toBe(2);
    expect(getAvailableSeatsInSlot(slot0830)).toBe(2);

    // Rechaza si solicita 3 plazas y solo quedan 2
    expect(() =>
      createTeeTimeBooking(INITIAL_TEE_TIME_SLOTS, {
        slotId: slot0830.id,
        userId: 'user-nuevo',
        userName: 'Socio Nuevo',
        playersCount: 3,
      })
    ).toThrow(/Cupo insuficiente/);

    // Permite reservar las 2 plazas restantes
    const { updatedSlots, createdBooking } = createTeeTimeBooking(
      INITIAL_TEE_TIME_SLOTS,
      {
        slotId: slot0830.id,
        userId: 'user-nuevo',
        userName: 'Socio Nuevo',
        playersCount: 2,
        buggyRequested: true,
      }
    );
    expect(createdBooking.playersCount).toBe(2);
    expect(getAvailableSeatsInSlot(updatedSlots[0])).toBe(0);

    // Rechaza reserva duplicada del mismo usuario en la misma franja
    expect(() =>
      createTeeTimeBooking(updatedSlots, {
        slotId: slot0830.id,
        userId: 'user-nuevo',
        userName: 'Socio Nuevo',
        playersCount: 1,
      })
    ).toThrow(/Ya tienes una reserva confirmada/);

    // Rechaza franja bloqueada (09:00)
    expect(() =>
      createTeeTimeBooking(INITIAL_TEE_TIME_SLOTS, {
        slotId: '33333333-3333-4333-8333-000000000900',
        userId: 'user-nuevo',
        userName: 'Socio Nuevo',
        playersCount: 2,
      })
    ).toThrow(/bloqueada por mantenimiento/);

    // Rechaza número de jugadores fuera de 1..4 y slot inexistente
    expect(() =>
      createTeeTimeBooking(INITIAL_TEE_TIME_SLOTS, {
        slotId: '33333333-3333-4333-8333-000000000840',
        userId: 'user-nuevo',
        userName: 'Socio Nuevo',
        playersCount: 5,
      })
    ).toThrow(/entre 1 y 4/);

    expect(() =>
      createTeeTimeBooking(INITIAL_TEE_TIME_SLOTS, {
        slotId: 'slot-inexistente',
        userId: 'user-nuevo',
        userName: 'Socio Nuevo',
        playersCount: 2,
      })
    ).toThrow(/No existe la franja/);
  });

  it('aplica permisos RLS en cancelación de reservas (solo propietario o club_admin/superadmin) y valida ID inexistente', () => {
    expect(() =>
      cancelTeeTimeBooking(
        INITIAL_TEE_TIME_SLOTS,
        'bk-inexistente',
        'otro-jugador-id',
        'player'
      )
    ).toThrow(/No se encontró la reserva/);
    // Intento de un player ajeno de cancelar la reserva '44444444-4444-4444-8444-000000000001' (de Carlos Mendoza)
    expect(() =>
      cancelTeeTimeBooking(
        INITIAL_TEE_TIME_SLOTS,
        '44444444-4444-4444-8444-000000000001',
        'otro-jugador-id',
        'player'
      )
    ).toThrow(/Permiso denegado \(RLS\)/);

    // El propietario sí puede cancelar su reserva
    const afterOwnerCancel = cancelTeeTimeBooking(
      INITIAL_TEE_TIME_SLOTS,
      '44444444-4444-4444-8444-000000000001',
      'aaaa0000-0000-0000-0000-000000000002',
      'player'
    );
    expect(getAvailableSeatsInSlot(afterOwnerCancel[0])).toBe(4);

    // Un club_admin puede cancelar la reserva de cualquier socio
    const afterAdminCancel = cancelTeeTimeBooking(
      INITIAL_TEE_TIME_SLOTS,
      '44444444-4444-4444-8444-000000000002',
      'admin-id',
      'club_admin'
    );
    expect(getAvailableSeatsInSlot(afterAdminCancel[2])).toBe(4);
  });

  it('filtra partidas del calendario y valida hándicap máximo y cupo al unirse a una partida abierta', () => {
    const novMatches = filterCalendarMatches(INITIAL_CALENDAR_MATCHES, {
      monthPrefix: '2026-11',
      onlyOpenSpots: true,
    });
    expect(novMatches).toHaveLength(2);

    // Rechaza si el hándicap del jugador supera el máximo permitido (match-nov-02 exige <= 18)
    expect(() =>
      joinOpenMatch(INITIAL_CALENDAR_MATCHES, {
        matchId: 'match-nov-02',
        playerId: 'p-alto-hcp',
        playerName: 'Jugador HCP 26',
        handicapIndex: 26.4,
      })
    ).toThrow(/hándicap máximo de 18/);

    // Rechaza inscripción duplicada y partida inexistente
    expect(() =>
      joinOpenMatch(INITIAL_CALENDAR_MATCHES, {
        matchId: 'match-nov-01',
        playerId: 'p-101',
        playerName: 'Carlos Mendoza',
        handicapIndex: 9.4,
      })
    ).toThrow(/Ya estás inscrito en esta partida/);

    expect(() =>
      joinOpenMatch(INITIAL_CALENDAR_MATCHES, {
        matchId: 'match-inexistente',
        playerId: 'p-nuevo',
        playerName: 'Jugador',
        handicapIndex: 10,
      })
    ).toThrow(/No existe la partida/);

    // Permite unirse si cumple el hándicap y queda 1 plaza libre (3/4 -> 4/4)
    const afterJoin = joinOpenMatch(INITIAL_CALENDAR_MATCHES, {
      matchId: 'match-nov-02',
      playerId: 'p-valido',
      playerName: 'Jugador HCP 12',
      handicapIndex: 12.0,
    });
    const updatedMatch = afterJoin.find((m) => m.id === 'match-nov-02')!;
    expect(updatedMatch.enrolledPlayers).toHaveLength(4);

    // Rechaza unirse cuando ya está completa (4/4)
    expect(() =>
      joinOpenMatch(afterJoin, {
        matchId: 'match-nov-02',
        playerId: 'p-quinto',
        playerName: 'Quinto Jugador',
        handicapIndex: 5.0,
      })
    ).toThrow(/4 plazas completas/);
  });

  it('ordena el Leaderboard de torneos en Stableford, Stroke Play Neto y Scratch con desempate por últimos 9 hoyos', () => {
    const autumnTournament = INITIAL_TOURNAMENTS[0];

    // 1. Modalidad Stableford: Elena (40 pts) -> Carlos (39 pts, 2ª vuelta 22) -> Alejandro (39 pts, 2ª vuelta 20) -> Javier (38 pts)
    const stablefordRank = rankTournamentLeaderboard(
      autumnTournament.entries,
      'stableford',
      72
    );
    expect(stablefordRank[0].playerName).toBe('Elena Ruiz');
    expect(stablefordRank[0].position).toBe(1);
    expect(stablefordRank[0].isTied).toBe(false);

    // Carlos y Alejandro empatan a 39 puntos, pero Carlos gana el desempate por 22 vs 20 en los últimos 9 hoyos
    expect(stablefordRank[1].playerName).toBe('Carlos Mendoza');
    expect(stablefordRank[1].isTied).toBe(true);
    expect(stablefordRank[2].playerName).toBe('Alejandro García');
    expect(stablefordRank[2].isTied).toBe(true);

    // 2. Modalidad Scratch (stroke_play_gross): Javier (73 brutos) es 1º
    const grossRank = rankTournamentLeaderboard(
      autumnTournament.entries,
      'stroke_play_gross',
      72
    );
    expect(grossRank[0].playerName).toBe('Javier Ortega');
    expect(grossRank[0].grossStrokes).toBe(73);

    // 3. Modalidad Hándicap Neto (stroke_play_net): Elena (68 netos) 1ª, Carlos (69 netos, HCP 10) 2º, Alejandro (69 netos, HCP 12) 3º
    const netRank = rankTournamentLeaderboard(
      autumnTournament.entries,
      'stroke_play_net',
      72
    );
    expect(netRank[0].playerName).toBe('Elena Ruiz');
    expect(netRank[1].playerName).toBe('Carlos Mendoza');
    expect(netRank[2].playerName).toBe('Alejandro García');

    // Inscripción en torneo abierto vs cerrado
    expect(() =>
      registerPlayerInTournament(autumnTournament, {
        playerId: 'nuevo-p',
        playerName: 'Nuevo Jugador',
        handicapIndex: 10,
      })
    ).toThrow(/inscripciones para este torneo están cerradas/);

    const openTournament = INITIAL_TOURNAMENTS[1];
    const afterReg = registerPlayerInTournament(openTournament, {
      playerId: 'nuevo-p',
      playerName: 'Nuevo Jugador',
      handicapIndex: 10.4,
    });
    expect(afterReg.entries).toHaveLength(openTournament.entries.length + 1);

    // Rechaza inscripción duplicada y cupo lleno
    expect(() =>
      registerPlayerInTournament(afterReg, {
        playerId: 'nuevo-p',
        playerName: 'Nuevo Jugador',
        handicapIndex: 10.4,
      })
    ).toThrow(/Ya estás inscrito/);

    expect(() =>
      registerPlayerInTournament(
        { ...openTournament, maxPlayers: 2 },
        {
          playerId: 'tercer-p',
          playerName: 'Tercer Jugador',
          handicapIndex: 12,
        }
      )
    ).toThrow(/cupo máximo/);
  });

  it('gestiona confirmaciones RSVP de Eventos Especiales y asigna automáticamente Lista de Espera al superar aforo', () => {
    const clinic = INITIAL_SPECIAL_EVENTS[1];
    expect(getConfirmedEventAttendeesCount(clinic)).toBe(3);

    expect(() =>
      upsertEventRsvp(INITIAL_SPECIAL_EVENTS, {
        eventId: clinic.id,
        userId: 'u-err',
        userName: 'Socio',
        guestsCount: 4,
        desiredStatus: 'attending',
      })
    ).toThrow(/entre 0 y 3/);

    expect(() =>
      upsertEventRsvp(INITIAL_SPECIAL_EVENTS, {
        eventId: 'ev-inexistente',
        userId: 'u-err',
        userName: 'Socio',
        guestsCount: 1,
        desiredStatus: 'attending',
      })
    ).toThrow(/No existe el evento/);

    // Socio confirma con 3 acompañantes (4 plazas -> total 7/8 <= 8 -> 'attending')
    const step1 = upsertEventRsvp(INITIAL_SPECIAL_EVENTS, {
      eventId: clinic.id,
      userId: 'u-1',
      userName: 'Socio Uno',
      guestsCount: 3,
      desiredStatus: 'attending',
    });
    expect(step1.assignedStatus).toBe('attending');
    expect(getConfirmedEventAttendeesCount(step1.updatedEvents[1])).toBe(7);

    // Otro socio solicita 2 plazas (1 socio + 1 acompañante -> 7 + 2 = 9 > 8 -> pasa a 'waitlist')
    const step2 = upsertEventRsvp(step1.updatedEvents, {
      eventId: clinic.id,
      userId: 'u-2',
      userName: 'Socio Dos',
      guestsCount: 1,
      desiredStatus: 'attending',
    });
    expect(step2.assignedStatus).toBe('waitlist');
    // El aforo confirmado sigue en 7
    expect(getConfirmedEventAttendeesCount(step2.updatedEvents[1])).toBe(7);

    // Cancelación libera las plazas de 'u-1'
    const step3 = upsertEventRsvp(step2.updatedEvents, {
      eventId: clinic.id,
      userId: 'u-1',
      userName: 'Socio Uno',
      guestsCount: 0,
      desiredStatus: 'cancelled',
    });
    expect(step3.assignedStatus).toBe('cancelled');
    expect(getConfirmedEventAttendeesCount(step3.updatedEvents[1])).toBe(3);
  });

  it('renderiza mediante SSR las 4 pantallas de la Fase 3 (/bookings, /calendar, /tournaments y /events) dentro de ClubProvider + AppShell sin duplicar la barra ni el menú', () => {
    const bookingsHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(TeeTimeBookingsPage),
        }),
      })
    );
    expect(bookingsHtml).toContain('Reservas de Salidas (Tee Times)');
    expect(bookingsHtml).toContain('Confirmar Reserva');
    expect((bookingsHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((bookingsHtml.match(/<aside/g) ?? []).length).toBe(1);

    const calendarHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(MatchCalendarPage),
        }),
      })
    );
    expect(calendarHtml).toContain('Calendario de Partidos');
    expect(calendarHtml).toContain('Fourball Dominguero de Socios');
    expect((calendarHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((calendarHtml.match(/<aside/g) ?? []).length).toBe(1);

    const tournamentsHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(TournamentsAndLeaderboardPage),
        }),
      })
    );
    expect(tournamentsHtml).toContain('Torneos y Resultados (Leaderboard)');
    expect(tournamentsHtml).toContain('Gran Premio de Otoño');
    expect((tournamentsHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((tournamentsHtml.match(/<aside/g) ?? []).length).toBe(1);

    const eventsHtml = renderToStaticMarkup(
      React.createElement(ClubProvider, {
        initialClubId: 'demo-club',
        children: React.createElement(AppShell, {
          children: React.createElement(SpecialEventsPage),
        }),
      })
    );
    expect(eventsHtml).toContain('Eventos Especiales de');
    expect(eventsHtml).toContain('Cena Anual de Gala y Entrega de Trofeos');
    expect((eventsHtml.match(/<header/g) ?? []).length).toBe(1);
    expect((eventsHtml.match(/<aside/g) ?? []).length).toBe(1);
  });

  it('diferencia explícitamente entre modo demo en memoria y persistencia confirmada en Supabase, validando UUIDs reales y cargando filas desde Supabase (Hallazgo 10 y Hallazgo Pendiente 1)', async () => {
    // Todas las semillas tienen UUIDs RFC-4122 válidos compatibles con PostgreSQL
    for (const slot of INITIAL_TEE_TIME_SLOTS) {
      expect(isValidUuid(slot.id)).toBe(true);
      for (const bk of slot.bookings) {
        expect(isValidUuid(bk.id)).toBe(true);
        expect(isValidUuid(bk.slotId)).toBe(true);
        expect(isValidUuid(bk.userId)).toBe(true);
      }
    }
    for (const ev of INITIAL_SPECIAL_EVENTS) {
      expect(isValidUuid(ev.id)).toBe(true);
      for (const r of ev.rsvps) {
        expect(isValidUuid(r.userId)).toBe(true);
      }
    }

    const demoMeta = resolvePersistenceMetadata(false);
    expect(demoMeta.persistence).toBe('demo_memory_only');
    expect(demoMeta.persistedToBackend).toBe(false);
    expect(demoMeta.notice).toContain('MODO DEMO LOCAL');

    const prodMeta = resolvePersistenceMetadata(true);
    expect(prodMeta.persistence).toBe('persisted_remote');
    expect(prodMeta.persistedToBackend).toBe(true);

    // En entorno de test sin credenciales Supabase, submitTeeTimeBooking y submitEventRsvp informan modo demo y persistedToBackend=false
    const bookingRes = await submitTeeTimeBooking(INITIAL_TEE_TIME_SLOTS, {
      slotId: '33333333-3333-4333-8333-000000000840',
      userId: 'aaaa0000-0000-0000-0000-000000000001',
      userName: 'Socio Demo',
      playersCount: 2,
    });
    expect(bookingRes.meta.persistence).toBe('demo_memory_only');
    expect(bookingRes.meta.persistedToBackend).toBe(false);

    const rsvpRes = await submitEventRsvp(INITIAL_SPECIAL_EVENTS, {
      eventId: INITIAL_SPECIAL_EVENTS[0].id,
      userId: 'aaaa0000-0000-0000-0000-000000000001',
      userName: 'Socio Demo',
      guestsCount: 2,
      desiredStatus: 'attending',
    });
    expect(rsvpRes.meta.persistence).toBe('demo_memory_only');
    expect(rsvpRes.meta.persistedToBackend).toBe(false);

    // Con cliente Supabase activo: carga filas reales con UUIDs de BD, persiste reservas/RSVPs y rechaza IDs no-UUID
    const mockDbSlotId = '77777777-7777-4777-8777-000000000001';
    const mockDbEventId = '88888888-8888-4888-8888-000000000001';
    const mockDbBookingId = '99999999-9999-4999-8999-000000000099';
    const validUserUuid = 'aaaa0000-0000-0000-0000-000000000001';

    const mockSupabaseClient = {
      from: (table: string) => {
        if (table === 'tee_time_slots') {
          return {
            select: () => ({
              order: () => ({
                order: async () => ({
                  data: [
                    {
                      id: mockDbSlotId,
                      course_id: '11111111-1111-1111-1111-111111111101',
                      slot_date: '2026-11-15',
                      slot_time: '09:10:00',
                      max_players: 4,
                      is_blocked: false,
                      price_eur: 50,
                      bookings: [],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'special_events') {
          return {
            select: () => ({
              order: async () => ({
                data: [
                  {
                    id: mockDbEventId,
                    title: 'Torneo Social BD',
                    description: 'Evento cargado desde Supabase con UUID real',
                    event_date: '2026-11-20T19:00:00Z',
                    location: 'Casa Club',
                    capacity: 40,
                    price_eur: 30,
                    event_rsvps: [],
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'bookings') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: mockDbBookingId,
                    created_at: '2026-10-28T10:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'event_rsvps') {
          return {
            upsert: () => ({
              select: () => ({
                single: async () => ({
                  data: { status: 'waitlist' },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`Tabla no esperada: ${table}`);
      },
    } as unknown as ReturnType<typeof import('@/lib/supabase/client').getSupabaseClient>;

    const loadedSlots = await loadTeeTimeSlots(mockSupabaseClient);
    expect(loadedSlots.meta.persistedToBackend).toBe(true);
    expect(loadedSlots.slots).toHaveLength(1);
    expect(loadedSlots.slots[0].id).toBe(mockDbSlotId);

    const remoteBooking = await submitTeeTimeBooking(
      loadedSlots.slots,
      {
        slotId: mockDbSlotId,
        userId: validUserUuid,
        userName: 'Socio Real',
        playersCount: 2,
      },
      mockSupabaseClient
    );
    expect(remoteBooking.meta.persistedToBackend).toBe(true);
    expect(remoteBooking.createdBooking.id).toBe(mockDbBookingId);

    const remoteCancel = await submitCancelTeeTimeBooking(
      remoteBooking.updatedSlots,
      mockDbBookingId,
      validUserUuid,
      'player',
      mockSupabaseClient
    );
    expect(remoteCancel.meta.persistedToBackend).toBe(true);

    const loadedEvents = await loadSpecialEvents(mockSupabaseClient);
    expect(loadedEvents.meta.persistedToBackend).toBe(true);
    expect(loadedEvents.events[0].id).toBe(mockDbEventId);

    const remoteRsvp = await submitEventRsvp(
      loadedEvents.events,
      {
        eventId: mockDbEventId,
        userId: validUserUuid,
        userName: 'Socio Real',
        guestsCount: 1,
        desiredStatus: 'attending',
      },
      mockSupabaseClient
    );
    expect(remoteRsvp.meta.persistedToBackend).toBe(true);
    expect(remoteRsvp.assignedStatus).toBe('waitlist');

    // Rechaza identificadores de demostración no-UUID cuando Supabase está configurado
    await expect(
      submitTeeTimeBooking(
        loadedSlots.slots,
        {
          slotId: mockDbSlotId,
          userId: 'id-no-uuid-demo',
          userName: 'Socio',
          playersCount: 1,
        },
        mockSupabaseClient
      )
    ).rejects.toThrow(/UUID válidos/);

    await expect(
      submitEventRsvp(
        loadedEvents.events,
        {
          eventId: mockDbEventId,
          userId: 'id-no-uuid-demo',
          userName: 'Socio',
          guestsCount: 0,
          desiredStatus: 'attending',
        },
        mockSupabaseClient
      )
    ).rejects.toThrow(/UUID válidos/);
  });
});
