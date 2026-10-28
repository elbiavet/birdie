import type { UserRole } from '@/types/database';

// ============================================================================
// 1. TIPOS Y MOTOR DE RESERVAS DE TEE TIMES (/bookings)
// ============================================================================

export interface TeeTimeBookingRecord {
  id: string;
  slotId: string;
  userId: string;
  userName: string;
  playersCount: 1 | 2 | 3 | 4;
  buggyRequested: boolean;
  notes: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface TeeTimeSlot {
  id: string;
  courseExternalId: string;
  slotDate: string; // YYYY-MM-DD
  slotTime: string; // HH:MM
  maxPlayers: number;
  isBlocked: boolean;
  greenFeeEuros: number;
  bookings: TeeTimeBookingRecord[];
}

export interface CreateTeeTimeBookingInput {
  slotId: string;
  userId: string;
  userName: string;
  playersCount: number;
  buggyRequested?: boolean;
  notes?: string;
}

export function getBookedPlayersInSlot(slot: TeeTimeSlot): number {
  return slot.bookings
    .filter((b) => b.status === 'confirmed')
    .reduce((acc, b) => acc + b.playersCount, 0);
}

export function getAvailableSeatsInSlot(slot: TeeTimeSlot): number {
  if (slot.isBlocked) {
    return 0;
  }
  return Math.max(0, slot.maxPlayers - getBookedPlayersInSlot(slot));
}

/**
 * Crea una reserva de Tee Time validando cupo máximo (1..4 jugadores),
 * estado de bloqueo de la salida y duplicidad por socio.
 */
export function createTeeTimeBooking(
  slots: TeeTimeSlot[],
  input: CreateTeeTimeBookingInput
): { updatedSlots: TeeTimeSlot[]; createdBooking: TeeTimeBookingRecord } {
  if (input.playersCount < 1 || input.playersCount > 4) {
    throw new Error('El número de jugadores por reserva debe estar entre 1 y 4.');
  }

  const targetSlot = slots.find((s) => s.id === input.slotId);
  if (!targetSlot) {
    throw new Error(`No existe la franja de salida con ID "${input.slotId}".`);
  }

  if (targetSlot.isBlocked) {
    throw new Error('Esta franja horaria está bloqueada por mantenimiento o competición.');
  }

  const alreadyBookedByUser = targetSlot.bookings.some(
    (b) => b.userId === input.userId && b.status === 'confirmed'
  );
  if (alreadyBookedByUser) {
    throw new Error('Ya tienes una reserva confirmada en esta misma franja horaria.');
  }

  const available = getAvailableSeatsInSlot(targetSlot);
  if (input.playersCount > available) {
    throw new Error(
      `Cupo insuficiente en la salida de las ${targetSlot.slotTime}: solicitas ${input.playersCount} plaza(s) y quedan ${available}.`
    );
  }

  const createdBooking: TeeTimeBookingRecord = {
    id: `booking-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    slotId: targetSlot.id,
    userId: input.userId,
    userName: input.userName,
    playersCount: input.playersCount as 1 | 2 | 3 | 4,
    buggyRequested: Boolean(input.buggyRequested),
    notes: input.notes?.trim() ?? '',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  const updatedSlots = slots.map((slot) =>
    slot.id === targetSlot.id
      ? { ...slot, bookings: [...slot.bookings, createdBooking] }
      : slot
  );

  return { updatedSlots, createdBooking };
}

/**
 * Cancela una reserva aplicando las mismas reglas que la política RLS de Supabase:
 * - Un socio (`player`) solo puede cancelar sus propias reservas.
 * - Un `club_admin` o `superadmin` puede cancelar cualquier reserva del club.
 */
export function cancelTeeTimeBooking(
  slots: TeeTimeSlot[],
  bookingId: string,
  actorUserId: string,
  actorRole: UserRole
): TeeTimeSlot[] {
  let foundBooking: TeeTimeBookingRecord | null = null;

  for (const slot of slots) {
    const match = slot.bookings.find((b) => b.id === bookingId);
    if (match) {
      foundBooking = match;
      break;
    }
  }

  if (!foundBooking) {
    throw new Error(`No se encontró la reserva "${bookingId}".`);
  }

  const isAdmin = actorRole === 'club_admin' || actorRole === 'superadmin';
  if (foundBooking.userId !== actorUserId && !isAdmin) {
    throw new Error(
      'Permiso denegado (RLS): un jugador solo puede cancelar sus propias reservas.'
    );
  }

  return slots.map((slot) => ({
    ...slot,
    bookings: slot.bookings.map((b) =>
      b.id === bookingId ? { ...b, status: 'cancelled' as const } : b
    ),
  }));
}

// ============================================================================
// 2. CALENDARIO DE PARTIDOS Y PARTIDAS ABIERTAS (/calendar)
// ============================================================================

export interface CalendarMatchPlayer {
  playerId: string;
  playerName: string;
  handicapIndex: number;
}

export interface CalendarMatchItem {
  id: string;
  title: string;
  matchDate: string; // YYYY-MM-DD
  teeTime: string; // HH:MM
  courseName: string;
  formatLabel: 'Fourball' | 'Individual Amistoso' | 'Greensome' | 'Entrenamiento Torneo';
  maxHandicapAllowed: number | null;
  maxPlayers: number;
  organizerName: string;
  enrolledPlayers: CalendarMatchPlayer[];
}

export function filterCalendarMatches(
  matches: CalendarMatchItem[],
  filters: {
    monthPrefix?: string; // ej. '2026-11'
    onlyOpenSpots?: boolean;
    searchQuery?: string;
  }
): CalendarMatchItem[] {
  const q = (filters.searchQuery ?? '').trim().toLowerCase();
  const month = (filters.monthPrefix ?? '').trim();

  return matches.filter((m) => {
    if (month && !m.matchDate.startsWith(month)) {
      return false;
    }
    if (filters.onlyOpenSpots && m.enrolledPlayers.length >= m.maxPlayers) {
      return false;
    }
    if (q) {
      return (
        m.title.toLowerCase().includes(q) ||
        m.courseName.toLowerCase().includes(q) ||
        m.formatLabel.toLowerCase().includes(q) ||
        m.organizerName.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function joinOpenMatch(
  matches: CalendarMatchItem[],
  params: {
    matchId: string;
    playerId: string;
    playerName: string;
    handicapIndex: number;
  }
): CalendarMatchItem[] {
  const target = matches.find((m) => m.id === params.matchId);
  if (!target) {
    throw new Error(`No existe la partida "${params.matchId}".`);
  }

  if (target.enrolledPlayers.some((p) => p.playerId === params.playerId)) {
    throw new Error('Ya estás inscrito en esta partida.');
  }

  if (target.enrolledPlayers.length >= target.maxPlayers) {
    throw new Error('La partida ya tiene las 4 plazas completas.');
  }

  if (
    target.maxHandicapAllowed !== null &&
    params.handicapIndex > target.maxHandicapAllowed
  ) {
    throw new Error(
      `Esta partida requiere un hándicap máximo de ${target.maxHandicapAllowed} (tu hándicap actual es ${params.handicapIndex}).`
    );
  }

  return matches.map((m) =>
    m.id === target.id
      ? {
          ...m,
          enrolledPlayers: [
            ...m.enrolledPlayers,
            {
              playerId: params.playerId,
              playerName: params.playerName,
              handicapIndex: params.handicapIndex,
            },
          ],
        }
      : m
  );
}

// ============================================================================
// 3. TORNEOS Y LEADERBOARD EN VIVO (/tournaments)
// ============================================================================

export type TournamentScoringMode =
  | 'stableford'
  | 'stroke_play_net'
  | 'stroke_play_gross';

export interface TournamentEntryResult {
  playerId: string;
  playerName: string;
  handicapIndex: number;
  playingHandicap: number;
  teeTime: string;
  holesCompleted: number;
  grossStrokes: number;
  netStrokes: number;
  stablefordPoints: number;
  backNineStablefordPoints: number;
}

export interface RankedTournamentEntry extends TournamentEntryResult {
  position: number;
  isTied: boolean;
  scoreToParNet: number;
}

export interface TournamentDefinition {
  id: string;
  name: string;
  tournamentDate: string;
  courseName: string;
  coursePar: number;
  scoringMode: TournamentScoringMode;
  status: 'registration_open' | 'in_progress' | 'completed';
  entryFeeEuros: number;
  maxPlayers: number;
  entries: TournamentEntryResult[];
}

/**
 * Ordena automáticamente la clasificación (Leaderboard) de un torneo según su modalidad:
 * - `stableford`: mayor puntuación Stableford primero; desempate por últimos 9 hoyos (`backNineStablefordPoints`) y menor `playingHandicap`.
 * - `stroke_play_net` (Hándicap Neto): menor `netStrokes` primero; desempate por menor `playingHandicap` y menor `grossStrokes`.
 * - `stroke_play_gross` (Scratch): menor `grossStrokes` primero; desempate por menor `netStrokes`.
 */
export function rankTournamentLeaderboard(
  entries: TournamentEntryResult[],
  scoringMode: TournamentScoringMode,
  coursePar = 72
): RankedTournamentEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (scoringMode === 'stableford') {
      if (b.stablefordPoints !== a.stablefordPoints) {
        return b.stablefordPoints - a.stablefordPoints;
      }
      if (b.backNineStablefordPoints !== a.backNineStablefordPoints) {
        return b.backNineStablefordPoints - a.backNineStablefordPoints;
      }
      return a.playingHandicap - b.playingHandicap;
    }

    if (scoringMode === 'stroke_play_net') {
      if (a.netStrokes !== b.netStrokes) {
        return a.netStrokes - b.netStrokes;
      }
      if (a.playingHandicap !== b.playingHandicap) {
        return a.playingHandicap - b.playingHandicap;
      }
      return a.grossStrokes - b.grossStrokes;
    }

    // stroke_play_gross (Scratch)
    if (a.grossStrokes !== b.grossStrokes) {
      return a.grossStrokes - b.grossStrokes;
    }
    return a.netStrokes - b.netStrokes;
  });

  const primaryScore = (item: TournamentEntryResult): number => {
    if (scoringMode === 'stableford') return item.stablefordPoints;
    if (scoringMode === 'stroke_play_net') return item.netStrokes;
    return item.grossStrokes;
  };

  return sorted.map((entry, idx) => {
    const score = primaryScore(entry);
    const prevSame = idx > 0 && primaryScore(sorted[idx - 1]) === score;
    const nextSame =
      idx < sorted.length - 1 && primaryScore(sorted[idx + 1]) === score;

    return {
      ...entry,
      position: idx + 1,
      isTied: prevSame || nextSame,
      scoreToParNet: entry.netStrokes - coursePar,
    };
  });
}

export function registerPlayerInTournament(
  tournament: TournamentDefinition,
  player: {
    playerId: string;
    playerName: string;
    handicapIndex: number;
  }
): TournamentDefinition {
  if (tournament.status !== 'registration_open') {
    throw new Error('Las inscripciones para este torneo están cerradas.');
  }

  if (tournament.entries.some((e) => e.playerId === player.playerId)) {
    throw new Error('Ya estás inscrito en este torneo.');
  }

  if (tournament.entries.length >= tournament.maxPlayers) {
    throw new Error('El torneo ha alcanzado el cupo máximo de inscritos.');
  }

  const playingHandicap = Math.round(player.handicapIndex);
  const newEntry: TournamentEntryResult = {
    playerId: player.playerId,
    playerName: player.playerName,
    handicapIndex: player.handicapIndex,
    playingHandicap,
    teeTime: '10:20',
    holesCompleted: 0,
    grossStrokes: tournament.coursePar + playingHandicap,
    netStrokes: tournament.coursePar,
    stablefordPoints: 36,
    backNineStablefordPoints: 18,
  };

  return {
    ...tournament,
    entries: [...tournament.entries, newEntry],
  };
}

// ============================================================================
// 4. EVENTOS ESPECIALES Y CONFIRMACIÓN DE ASISTENCIA RSVP (/events)
// ============================================================================

export type EventRsvpStatus = 'attending' | 'waitlist' | 'cancelled';

export interface EventRsvpEntry {
  userId: string;
  userName: string;
  guestsCount: number;
  status: EventRsvpStatus;
  updatedAt: string;
}

export interface SpecialEventItem {
  id: string;
  title: string;
  description: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string; // HH:MM
  location: string;
  category: 'Cena de Gala' | 'Clínic Técnico' | 'Entrega de Premios' | 'Jornada Social';
  priceEuros: number;
  maxCapacity: number;
  rsvps: EventRsvpEntry[];
}

export function getConfirmedEventAttendeesCount(event: SpecialEventItem): number {
  return event.rsvps
    .filter((r) => r.status === 'attending')
    .reduce((acc, r) => acc + 1 + r.guestsCount, 0);
}

/**
 * Registra o actualiza el RSVP de un socio en un evento especial:
 * - Si hay plazas suficientes (`1 + guestsCount <= plazas libres`), asigna `status = 'attending'`.
 * - Si supera el aforo disponible, asigna automáticamente `status = 'waitlist'`.
 */
export function upsertEventRsvp(
  events: SpecialEventItem[],
  params: {
    eventId: string;
    userId: string;
    userName: string;
    guestsCount: number;
    desiredStatus: 'attending' | 'cancelled';
  }
): { updatedEvents: SpecialEventItem[]; assignedStatus: EventRsvpStatus } {
  if (params.guestsCount < 0 || params.guestsCount > 3) {
    throw new Error('El número de acompañantes debe estar entre 0 y 3.');
  }

  const target = events.find((e) => e.id === params.eventId);
  if (!target) {
    throw new Error(`No existe el evento "${params.eventId}".`);
  }

  let assignedStatus: EventRsvpStatus = 'cancelled';

  if (params.desiredStatus === 'attending') {
    const otherAttendingCount = target.rsvps
      .filter((r) => r.userId !== params.userId && r.status === 'attending')
      .reduce((acc, r) => acc + 1 + r.guestsCount, 0);

    const requestedSeats = 1 + params.guestsCount;
    assignedStatus =
      otherAttendingCount + requestedSeats <= target.maxCapacity
        ? 'attending'
        : 'waitlist';
  }

  const nextRsvp: EventRsvpEntry = {
    userId: params.userId,
    userName: params.userName,
    guestsCount: params.guestsCount,
    status: assignedStatus,
    updatedAt: new Date().toISOString(),
  };

  const updatedEvents = events.map((ev) => {
    if (ev.id !== target.id) return ev;
    const exists = ev.rsvps.some((r) => r.userId === params.userId);
    const nextList = exists
      ? ev.rsvps.map((r) => (r.userId === params.userId ? nextRsvp : r))
      : [...ev.rsvps, nextRsvp];
    return { ...ev, rsvps: nextList };
  });

  return { updatedEvents, assignedStatus };
}

// ============================================================================
// 5. CATÁLOGOS SEMILLA PARA RESERVAS, CALENDARIO, TORNEOS Y EVENTOS
// ============================================================================

export const INITIAL_TEE_TIME_SLOTS: TeeTimeSlot[] = [
  {
    id: 'slot-2026-11-01-0830',
    courseExternalId: 'golfapi_course_1024',
    slotDate: '2026-11-01',
    slotTime: '08:30',
    maxPlayers: 4,
    isBlocked: false,
    greenFeeEuros: 45,
    bookings: [
      {
        id: 'bk-seed-1',
        slotId: 'slot-2026-11-01-0830',
        userId: 'aaaa0000-0000-0000-0000-000000000002',
        userName: 'Carlos Mendoza',
        playersCount: 2,
        buggyRequested: true,
        notes: 'Partida matinal rápida',
        status: 'confirmed',
        createdAt: '2026-10-25T10:00:00Z',
      },
    ],
  },
  {
    id: 'slot-2026-11-01-0840',
    courseExternalId: 'golfapi_course_1024',
    slotDate: '2026-11-01',
    slotTime: '08:40',
    maxPlayers: 4,
    isBlocked: false,
    greenFeeEuros: 45,
    bookings: [],
  },
  {
    id: 'slot-2026-11-01-0850',
    courseExternalId: 'golfapi_course_1024',
    slotDate: '2026-11-01',
    slotTime: '08:50',
    maxPlayers: 4,
    isBlocked: false,
    greenFeeEuros: 55,
    bookings: [
      {
        id: 'bk-seed-2',
        slotId: 'slot-2026-11-01-0850',
        userId: 'aaaa0000-0000-0000-0000-000000000001',
        userName: 'Alejandro García',
        playersCount: 3,
        buggyRequested: false,
        notes: '1 plaza libre para socio',
        status: 'confirmed',
        createdAt: '2026-10-26T09:15:00Z',
      },
    ],
  },
  {
    id: 'slot-2026-11-01-0900',
    courseExternalId: 'golfapi_course_1024',
    slotDate: '2026-11-01',
    slotTime: '09:00',
    maxPlayers: 4,
    isBlocked: true,
    greenFeeEuros: 55,
    bookings: [],
  },
  {
    id: 'slot-2026-11-02-0930',
    courseExternalId: 'golfapi_course_1024',
    slotDate: '2026-11-02',
    slotTime: '09:30',
    maxPlayers: 4,
    isBlocked: false,
    greenFeeEuros: 60,
    bookings: [],
  },
];

export const INITIAL_CALENDAR_MATCHES: CalendarMatchItem[] = [
  {
    id: 'match-nov-01',
    title: 'Fourball Dominguero de Socios',
    matchDate: '2026-11-01',
    teeTime: '09:20',
    courseName: 'Recorrido Championship 18 Hoyos',
    formatLabel: 'Fourball',
    maxHandicapAllowed: 24,
    maxPlayers: 4,
    organizerName: 'Carlos Mendoza',
    enrolledPlayers: [
      { playerId: 'p-101', playerName: 'Carlos Mendoza', handicapIndex: 9.4 },
      { playerId: 'p-102', playerName: 'Lucía Fernández', handicapIndex: 14.2 },
    ],
  },
  {
    id: 'match-nov-02',
    title: 'Vuelta de Entrenamiento — Copa de Otoño',
    matchDate: '2026-11-07',
    teeTime: '10:00',
    courseName: 'Recorrido Championship 18 Hoyos',
    formatLabel: 'Entrenamiento Torneo',
    maxHandicapAllowed: 18,
    maxPlayers: 4,
    organizerName: 'Elena Ruiz',
    enrolledPlayers: [
      { playerId: 'p-103', playerName: 'Elena Ruiz', handicapIndex: 6.8 },
      { playerId: 'p-104', playerName: 'Javier Ortega', handicapIndex: 11.1 },
      { playerId: 'p-105', playerName: 'Marta Gómez', handicapIndex: 15.0 },
    ],
  },
  {
    id: 'match-dec-01',
    title: 'Greensome Social pre-Navidad',
    matchDate: '2026-12-05',
    teeTime: '10:30',
    courseName: 'Recorrido Links del Mar',
    formatLabel: 'Greensome',
    maxHandicapAllowed: null,
    maxPlayers: 4,
    organizerName: 'Alejandro García',
    enrolledPlayers: [
      {
        playerId: 'aaaa0000-0000-0000-0000-000000000001',
        playerName: 'Alejandro García',
        handicapIndex: 11.4,
      },
    ],
  },
];

export const INITIAL_TOURNAMENTS: TournamentDefinition[] = [
  {
    id: 'tourn-autumn-2026',
    name: 'Gran Premio de Otoño — Copa Presidente',
    tournamentDate: '2026-11-14',
    courseName: 'Recorrido Championship 18 Hoyos',
    coursePar: 72,
    scoringMode: 'stableford',
    status: 'in_progress',
    entryFeeEuros: 35,
    maxPlayers: 60,
    entries: [
      {
        playerId: 'p-201',
        playerName: 'Elena Ruiz',
        handicapIndex: 6.8,
        playingHandicap: 7,
        teeTime: '09:00',
        holesCompleted: 18,
        grossStrokes: 75,
        netStrokes: 68,
        stablefordPoints: 40,
        backNineStablefordPoints: 21,
      },
      {
        playerId: 'aaaa0000-0000-0000-0000-000000000001',
        playerName: 'Alejandro García',
        handicapIndex: 11.4,
        playingHandicap: 12,
        teeTime: '09:10',
        holesCompleted: 18,
        grossStrokes: 81,
        netStrokes: 69,
        stablefordPoints: 39,
        backNineStablefordPoints: 20,
      },
      {
        playerId: 'p-202',
        playerName: 'Carlos Mendoza',
        handicapIndex: 9.4,
        playingHandicap: 10,
        teeTime: '09:10',
        holesCompleted: 18,
        grossStrokes: 79,
        netStrokes: 69,
        stablefordPoints: 39,
        backNineStablefordPoints: 22,
      },
      {
        playerId: 'p-203',
        playerName: 'Javier Ortega',
        handicapIndex: 3.2,
        playingHandicap: 3,
        teeTime: '09:20',
        holesCompleted: 18,
        grossStrokes: 73,
        netStrokes: 70,
        stablefordPoints: 38,
        backNineStablefordPoints: 19,
      },
    ],
  },
  {
    id: 'tourn-masters-club-2026',
    name: 'Campeonato Absoluto del Club (Medall Play)',
    tournamentDate: '2026-11-28',
    courseName: 'Recorrido Championship 18 Hoyos',
    coursePar: 72,
    scoringMode: 'stroke_play_net',
    status: 'registration_open',
    entryFeeEuros: 40,
    maxPlayers: 48,
    entries: [
      {
        playerId: 'p-201',
        playerName: 'Elena Ruiz',
        handicapIndex: 6.8,
        playingHandicap: 7,
        teeTime: '09:00',
        holesCompleted: 18,
        grossStrokes: 76,
        netStrokes: 69,
        stablefordPoints: 39,
        backNineStablefordPoints: 20,
      },
      {
        playerId: 'p-203',
        playerName: 'Javier Ortega',
        handicapIndex: 3.2,
        playingHandicap: 3,
        teeTime: '09:10',
        holesCompleted: 18,
        grossStrokes: 74,
        netStrokes: 71,
        stablefordPoints: 37,
        backNineStablefordPoints: 18,
      },
    ],
  },
];

export const INITIAL_SPECIAL_EVENTS: SpecialEventItem[] = [
  {
    id: 'ev-gala-2026',
    title: 'Cena Anual de Gala y Entrega de Trofeos',
    description:
      'Velada de clausura de la temporada oficial con entrega de premios a los campeones del ranking anual, cóctel en terraza y música en directo.',
    eventDate: '2026-11-21',
    eventTime: '20:30',
    location: 'Salón Noble de la Casa Club',
    category: 'Cena de Gala',
    priceEuros: 65,
    maxCapacity: 80,
    rsvps: [
      {
        userId: 'p-201',
        userName: 'Elena Ruiz',
        guestsCount: 1,
        status: 'attending',
        updatedAt: '2026-10-20T18:00:00Z',
      },
      {
        userId: 'p-202',
        userName: 'Carlos Mendoza',
        guestsCount: 2,
        status: 'attending',
        updatedAt: '2026-10-21T11:30:00Z',
      },
    ],
  },
  {
    id: 'ev-clinic-shortgame',
    title: 'Masterclass de Juego Corto y Salidas de Bunker',
    description:
      'Clínic intensivo de 2 horas con el Head Pro del club enfocado en control de spin en wedges de 30-70 metros y recuperación desde arena compacta.',
    eventDate: '2026-11-08',
    eventTime: '11:00',
    location: 'Zona de Approach y Putting Green Sur',
    category: 'Clínic Técnico',
    priceEuros: 25,
    maxCapacity: 8,
    rsvps: [
      {
        userId: 'p-201',
        userName: 'Elena Ruiz',
        guestsCount: 0,
        status: 'attending',
        updatedAt: '2026-10-22T09:00:00Z',
      },
      {
        userId: 'p-203',
        userName: 'Javier Ortega',
        guestsCount: 1,
        status: 'attending',
        updatedAt: '2026-10-22T10:00:00Z',
      },
    ],
  },
];
