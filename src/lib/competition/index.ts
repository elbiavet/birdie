import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';

export type PersistenceStatus = 'persisted_remote' | 'demo_memory_only';

export interface ActionPersistenceMetadata {
  persistence: PersistenceStatus;
  persistedToBackend: boolean;
  notice: string;
}

/**
 * Determina e informa explícitamente si una operación se ha persistido en el backend Supabase
 * o si se está ejecutando únicamente como simulación en memoria local (Modo Demo).
 */
export function resolvePersistenceMetadata(
  backendConnected: boolean = isSupabaseConfigured()
): ActionPersistenceMetadata {
  if (backendConnected) {
    return {
      persistence: 'persisted_remote',
      persistedToBackend: true,
      notice: 'Persistido en servidor Supabase.',
    };
  }
  return {
    persistence: 'demo_memory_only',
    persistedToBackend: false,
    notice:
      'MODO DEMO LOCAL: acción aplicada solo en memoria de sesión (no enviada ni persistida en Supabase).',
  };
}

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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Comprueba si un identificador tiene formato UUID RFC-4122 compatible con las claves primarias/foráneas de PostgreSQL.
 */
export function isValidUuid(value: string): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

/**
 * Carga las franjas de salida (Tee Times) y sus reservas reales desde Supabase cuando está configurado,
 * o devuelve el catálogo semilla con UUIDs válidos en modo demo local.
 */
export async function loadTeeTimeSlots(
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  slots: TeeTimeSlot[];
  meta: ActionPersistenceMetadata;
}> {
  const supabase = customClient !== undefined ? customClient : getSupabaseClient();
  if (!supabase) {
    return {
      slots: INITIAL_TEE_TIME_SLOTS,
      meta: resolvePersistenceMetadata(false),
    };
  }

  const { data, error } = await supabase
    .from('tee_time_slots')
    .select(
      'id, course_id, slot_date, slot_time, max_players, is_blocked, price_eur, bookings(id, slot_id, booked_by, players_count, buggy_requested, notes, status, created_at, profiles:booked_by(full_name))'
    )
    .order('slot_date', { ascending: true })
    .order('slot_time', { ascending: true });

  if (error) {
    throw new Error(`Error al cargar franjas de salida desde Supabase: ${error.message}`);
  }

  const mappedSlots: TeeTimeSlot[] = (data ?? []).map((row: Record<string, unknown>) => {
    const rawBookings = Array.isArray(row.bookings) ? row.bookings : [];
    const rawTime = String(row.slot_time ?? '09:00');
    return {
      id: String(row.id),
      courseExternalId: String(row.course_id ?? ''),
      slotDate: String(row.slot_date ?? ''),
      slotTime: rawTime.slice(0, 5),
      maxPlayers: Number(row.max_players ?? 4),
      isBlocked: Boolean(row.is_blocked),
      greenFeeEuros: Number(row.price_eur ?? 0),
      bookings: rawBookings.map((b: Record<string, unknown>) => {
        const profileObj = b.profiles as { full_name?: string } | null | undefined;
        return {
          id: String(b.id),
          slotId: String(b.slot_id ?? row.id),
          userId: String(b.booked_by),
          userName: profileObj?.full_name ?? 'Socio del Club',
          playersCount: (Number(b.players_count ?? 1) as 1 | 2 | 3 | 4),
          buggyRequested: Boolean(b.buggy_requested),
          notes: String(b.notes ?? ''),
          status: b.status === 'cancelled' ? 'cancelled' : 'confirmed',
          createdAt: String(b.created_at ?? new Date().toISOString()),
        };
      }),
    };
  });

  return {
    slots: mappedSlots,
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Carga los eventos especiales y sus confirmaciones RSVP reales desde Supabase cuando está configurado,
 * o devuelve el catálogo semilla con UUIDs válidos en modo demo local.
 */
export async function loadSpecialEvents(
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  events: SpecialEventItem[];
  meta: ActionPersistenceMetadata;
}> {
  const supabase = customClient !== undefined ? customClient : getSupabaseClient();
  if (!supabase) {
    return {
      events: INITIAL_SPECIAL_EVENTS,
      meta: resolvePersistenceMetadata(false),
    };
  }

  const { data, error } = await supabase
    .from('special_events')
    .select(
      'id, title, description, event_date, location, capacity, price_eur, event_rsvps(user_id, guests_count, status, created_at, profiles:user_id(full_name))'
    )
    .order('event_date', { ascending: true });

  if (error) {
    throw new Error(`Error al cargar eventos especiales desde Supabase: ${error.message}`);
  }

  const mappedEvents: SpecialEventItem[] = (data ?? []).map((row: Record<string, unknown>) => {
    const rawIso = String(row.event_date ?? new Date().toISOString());
    const [datePart, timePartRaw] = rawIso.split('T');
    const timePart = (timePartRaw ?? '12:00').slice(0, 5);
    const rawRsvps = Array.isArray(row.event_rsvps) ? row.event_rsvps : [];

    return {
      id: String(row.id),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      eventDate: datePart || rawIso.slice(0, 10),
      eventTime: timePart,
      location: String(row.location ?? ''),
      category: 'Jornada Social',
      priceEuros: Number(row.price_eur ?? 0),
      maxCapacity: Number(row.capacity ?? 100),
      rsvps: rawRsvps.map((r: Record<string, unknown>) => {
        const profileObj = r.profiles as { full_name?: string } | null | undefined;
        return {
          userId: String(r.user_id),
          userName: profileObj?.full_name ?? 'Socio del Club',
          guestsCount: Number(r.guests_count ?? 0),
          status: (r.status as EventRsvpStatus) ?? 'attending',
          updatedAt: String(r.created_at ?? new Date().toISOString()),
        };
      }),
    };
  });

  return {
    events: mappedEvents,
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Ejecuta una reserva de Tee Time contra el servidor Supabase si está configurado
 * (donde el trigger `trg_bookings_enforce_slot_capacity` valida el aforo de forma atómica con `FOR UPDATE`),
 * o en memoria local marcando explícitamente `persistence = 'demo_memory_only'`.
 */
export async function submitTeeTimeBooking(
  slots: TeeTimeSlot[],
  input: CreateTeeTimeBookingInput,
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  updatedSlots: TeeTimeSlot[];
  createdBooking: TeeTimeBookingRecord;
  meta: ActionPersistenceMetadata;
}> {
  const localResult = createTeeTimeBooking(slots, input);
  const supabase = customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      ...localResult,
      meta: resolvePersistenceMetadata(false),
    };
  }

  if (!isValidUuid(input.slotId) || !isValidUuid(input.userId)) {
    throw new Error(
      'Identificador inválido para Supabase: slot_id y booked_by deben ser UUID válidos de base de datos.'
    );
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      slot_id: input.slotId,
      booked_by: input.userId,
      players_count: input.playersCount,
      buggy_requested: Boolean(input.buggyRequested),
      notes: input.notes ?? null,
      status: 'confirmed',
    })
    .select('id, created_at')
    .single();

  if (error) {
    throw new Error(`Error del servidor al confirmar reserva: ${error.message}`);
  }

  const persistedBooking: TeeTimeBookingRecord = {
    ...localResult.createdBooking,
    id: data?.id ? String(data.id) : localResult.createdBooking.id,
    createdAt: data?.created_at
      ? String(data.created_at)
      : localResult.createdBooking.createdAt,
  };

  const updatedSlots = localResult.updatedSlots.map((slot) =>
    slot.id === input.slotId
      ? {
          ...slot,
          bookings: slot.bookings.map((b) =>
            b.id === localResult.createdBooking.id ? persistedBooking : b
          ),
        }
      : slot
  );

  return {
    updatedSlots,
    createdBooking: persistedBooking,
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Cancela una reserva de Tee Time aplicando validación de permisos RLS y sincronizando con Supabase cuando está configurado.
 */
export async function submitCancelTeeTimeBooking(
  slots: TeeTimeSlot[],
  bookingId: string,
  actorUserId: string,
  actorRole: UserRole,
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  updatedSlots: TeeTimeSlot[];
  meta: ActionPersistenceMetadata;
}> {
  const updatedSlots = cancelTeeTimeBooking(slots, bookingId, actorUserId, actorRole);
  const supabase = customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      updatedSlots,
      meta: resolvePersistenceMetadata(false),
    };
  }

  if (!isValidUuid(bookingId)) {
    throw new Error(
      'Identificador inválido para Supabase: el ID de la reserva a cancelar debe ser un UUID válido.'
    );
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId);

  if (error) {
    throw new Error(`Error del servidor al cancelar reserva: ${error.message}`);
  }

  return {
    updatedSlots,
    meta: resolvePersistenceMetadata(true),
  };
}

/**
 * Ejecuta una confirmación o cancelación de RSVP contra Supabase si está configurado
 * (donde el trigger `trg_event_rsvps_enforce_capacity` aplica el aforo atómico en servidor),
 * o en memoria local indicando explícitamente `persistence = 'demo_memory_only'`.
 */
export async function submitEventRsvp(
  events: SpecialEventItem[],
  params: {
    eventId: string;
    userId: string;
    userName: string;
    guestsCount: number;
    desiredStatus: 'attending' | 'cancelled';
  },
  customClient?: ReturnType<typeof getSupabaseClient>
): Promise<{
  updatedEvents: SpecialEventItem[];
  assignedStatus: EventRsvpStatus;
  meta: ActionPersistenceMetadata;
}> {
  const localResult = upsertEventRsvp(events, params);
  const supabase = customClient !== undefined ? customClient : getSupabaseClient();

  if (!supabase) {
    return {
      ...localResult,
      meta: resolvePersistenceMetadata(false),
    };
  }

  if (!isValidUuid(params.eventId) || !isValidUuid(params.userId)) {
    throw new Error(
      'Identificador inválido para Supabase: event_id y user_id deben ser UUID válidos de base de datos.'
    );
  }

  const { data, error } = await supabase
    .from('event_rsvps')
    .upsert(
      {
        event_id: params.eventId,
        user_id: params.userId,
        guests_count: params.guestsCount,
        status: params.desiredStatus,
      },
      { onConflict: 'event_id,user_id' }
    )
    .select('status')
    .single();

  if (error) {
    throw new Error(`Error del servidor al registrar RSVP: ${error.message}`);
  }

  const serverAssignedStatus =
    (data?.status as EventRsvpStatus | undefined) ?? localResult.assignedStatus;

  const reconciledEvents = localResult.updatedEvents.map((ev) =>
    ev.id === params.eventId
      ? {
          ...ev,
          rsvps: ev.rsvps.map((r) =>
            r.userId === params.userId ? { ...r, status: serverAssignedStatus } : r
          ),
        }
      : ev
  );

  return {
    updatedEvents: reconciledEvents,
    assignedStatus: serverAssignedStatus,
    meta: resolvePersistenceMetadata(true),
  };
}

// ============================================================================
// 5. CATÁLOGOS SEMILLA CON UUIDs RFC-4122 VÁLIDOS
// ============================================================================

export const INITIAL_TEE_TIME_SLOTS: TeeTimeSlot[] = [
  {
    id: '33333333-3333-4333-8333-000000000830',
    courseExternalId: 'golfapi_course_1024',
    slotDate: '2026-11-01',
    slotTime: '08:30',
    maxPlayers: 4,
    isBlocked: false,
    greenFeeEuros: 45,
    bookings: [
      {
        id: '44444444-4444-4444-8444-000000000001',
        slotId: '33333333-3333-4333-8333-000000000830',
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
    id: '33333333-3333-4333-8333-000000000840',
    courseExternalId: 'golfapi_course_1024',
    slotDate: '2026-11-01',
    slotTime: '08:40',
    maxPlayers: 4,
    isBlocked: false,
    greenFeeEuros: 45,
    bookings: [],
  },
  {
    id: '33333333-3333-4333-8333-000000000850',
    courseExternalId: 'golfapi_course_1024',
    slotDate: '2026-11-01',
    slotTime: '08:50',
    maxPlayers: 4,
    isBlocked: false,
    greenFeeEuros: 55,
    bookings: [
      {
        id: '44444444-4444-4444-8444-000000000002',
        slotId: '33333333-3333-4333-8333-000000000850',
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
    id: '33333333-3333-4333-8333-000000000900',
    courseExternalId: 'golfapi_course_1024',
    slotDate: '2026-11-01',
    slotTime: '09:00',
    maxPlayers: 4,
    isBlocked: true,
    greenFeeEuros: 55,
    bookings: [],
  },
  {
    id: '33333333-3333-4333-8333-000000000930',
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
    id: '55555555-5555-4555-8555-000000000001',
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
        userId: 'aaaa0000-0000-0000-0000-000000000201',
        userName: 'Elena Ruiz',
        guestsCount: 1,
        status: 'attending',
        updatedAt: '2026-10-20T18:00:00Z',
      },
      {
        userId: 'aaaa0000-0000-0000-0000-000000000002',
        userName: 'Carlos Mendoza',
        guestsCount: 2,
        status: 'attending',
        updatedAt: '2026-10-21T11:30:00Z',
      },
    ],
  },
  {
    id: '55555555-5555-4555-8555-000000000002',
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
        userId: 'aaaa0000-0000-0000-0000-000000000201',
        userName: 'Elena Ruiz',
        guestsCount: 0,
        status: 'attending',
        updatedAt: '2026-10-22T09:00:00Z',
      },
      {
        userId: 'aaaa0000-0000-0000-0000-000000000203',
        userName: 'Javier Ortega',
        guestsCount: 1,
        status: 'attending',
        updatedAt: '2026-10-22T10:00:00Z',
      },
    ],
  },
];
