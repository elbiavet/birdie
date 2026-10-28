import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';

export type OfflineSyncStatus = 'pending' | 'synced';

export interface OfflineHoleScoreInput {
  roundId: string;
  playerId: string;
  holeNumber: number;
  strokes: number;
  putts: number;
  fairwayHit: boolean | null;
  greenInRegulation: boolean;
  sandSave?: boolean | null;
  penaltyStrokes?: number;
  stablefordPoints: number;
}

export interface OfflineHoleScore extends OfflineHoleScoreInput {
  syncStatus: OfflineSyncStatus;
  /**
   * Versión monótona por (roundId, playerId, holeNumber) que se incrementa en cada edición local.
   * Evita que una respuesta de red tardía de una versión antigua marque como 'synced' una edición más reciente.
   */
  revision: number;
  updatedAt: string;
}

export interface CachedCourseHole {
  courseId: string;
  holeNumber: number;
  par: number;
  strokeIndex: number;
  distanceYellowMeters: number;
  greenFrontLat: number;
  greenFrontLng: number;
  greenCenterLat: number;
  greenCenterLng: number;
  greenBackLat: number;
  greenBackLng: number;
}

const DB_NAME = 'birdie_offline_db';
const SCORES_STORAGE_KEY = 'birdie_offline_hole_scores_v1';
const COURSES_STORAGE_KEY = 'birdie_offline_course_holes_v1';

// Singleton de conexión SQLite nativa en Android para que initOfflineDatabase y las operaciones CRUD compartan el mismo almacenamiento
let sqliteConnectionInstance: SQLiteConnection | null = null;
let activeNativeDb: SQLiteDBConnection | null = null;

// Almacenamiento fallback web / memoria para navegador y entorno Node de pruebas no nativo
const memoryScoresMap = new Map<string, OfflineHoleScore>();
const memoryCoursesMap = new Map<string, CachedCourseHole[]>();

function makeScoreKey(roundId: string, playerId: string, holeNumber: number): string {
  return `${roundId}::${playerId}::${holeNumber}`;
}

function readFallbackScores(): Map<string, OfflineHoleScore> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(SCORES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OfflineHoleScore[];
        const map = new Map<string, OfflineHoleScore>();
        for (const item of parsed) {
          map.set(makeScoreKey(item.roundId, item.playerId, item.holeNumber), {
            ...item,
            revision: typeof item.revision === 'number' ? item.revision : 1,
          });
        }
        return map;
      }
    } catch {
      // Fallback a memoria
    }
  }
  return memoryScoresMap;
}

function writeFallbackScores(map: Map<string, OfflineHoleScore>): void {
  if (map !== memoryScoresMap) {
    memoryScoresMap.clear();
    for (const [k, v] of map.entries()) {
      memoryScoresMap.set(k, v);
    }
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        SCORES_STORAGE_KEY,
        JSON.stringify(Array.from(map.values()))
      );
    } catch {
      // Ignore quota errors
    }
  }
}

interface RawSqliteScoreRow {
  round_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
  putts: number;
  fairway_hit: number | null;
  green_in_regulation: number;
  sand_save: number | null;
  penalty_strokes: number;
  stableford_points: number;
  sync_status: OfflineSyncStatus;
  revision: number;
  updated_at: string;
}

function mapSqliteRowToOfflineScore(row: RawSqliteScoreRow): OfflineHoleScore {
  return {
    roundId: row.round_id,
    playerId: row.player_id,
    holeNumber: Number(row.hole_number),
    strokes: Number(row.strokes),
    putts: Number(row.putts),
    fairwayHit:
      row.fairway_hit === null || row.fairway_hit === undefined
        ? null
        : Boolean(row.fairway_hit),
    greenInRegulation: Boolean(row.green_in_regulation),
    sandSave:
      row.sand_save === null || row.sand_save === undefined
        ? null
        : Boolean(row.sand_save),
    penaltyStrokes: Number(row.penalty_strokes ?? 0),
    stablefordPoints: Number(row.stableford_points ?? 0),
    syncStatus: row.sync_status === 'synced' ? 'synced' : 'pending',
    revision: Number(row.revision ?? 1),
    updatedAt: row.updated_at,
  };
}

/**
 * Obtiene o inicializa la conexión nativa SQLite cuando se ejecuta en Android/iOS nativo.
 */
async function getOrInitNativeDb(): Promise<SQLiteDBConnection | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  if (activeNativeDb) {
    return activeNativeDb;
  }
  try {
    if (!sqliteConnectionInstance) {
      sqliteConnectionInstance = new SQLiteConnection(CapacitorSQLite);
    }
    const db = await sqliteConnectionInstance.createConnection(
      DB_NAME,
      false,
      'no-encryption',
      1,
      false
    );
    await db.open();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS local_hole_scores (
        round_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        hole_number INTEGER NOT NULL,
        strokes INTEGER NOT NULL,
        putts INTEGER NOT NULL,
        fairway_hit INTEGER,
        green_in_regulation INTEGER NOT NULL,
        sand_save INTEGER,
        penalty_strokes INTEGER NOT NULL DEFAULT 0,
        stableford_points INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (round_id, player_id, hole_number)
      );
      CREATE TABLE IF NOT EXISTS local_course_holes (
        course_id TEXT NOT NULL,
        hole_number INTEGER NOT NULL,
        par INTEGER NOT NULL,
        stroke_index INTEGER NOT NULL,
        distance_yellow_meters INTEGER NOT NULL,
        green_front_lat REAL NOT NULL,
        green_front_lng REAL NOT NULL,
        green_center_lat REAL NOT NULL,
        green_center_lng REAL NOT NULL,
        green_back_lat REAL NOT NULL,
        green_back_lng REAL NOT NULL,
        PRIMARY KEY (course_id, hole_number)
      );
    `);
    activeNativeDb = db;
    return activeNativeDb;
  } catch {
    activeNativeDb = null;
    return null;
  }
}

/**
 * Inicializa las tablas SQLite en Android nativo si la plataforma lo soporta
 * y deja lista la conexión compartida para todas las operaciones CRUD.
 */
export async function initOfflineDatabase(): Promise<{
  backend: 'sqlite-native' | 'web-fallback';
}> {
  const db = await getOrInitNativeDb();
  if (db) {
    return { backend: 'sqlite-native' };
  }
  return { backend: 'web-fallback' };
}

/**
 * Guarda o actualiza un golpe de hoyo en el almacén offline marcándolo como 'pending'
 * e incrementando su versión monótona (`revision`).
 */
export async function saveOfflineHoleScore(
  input: OfflineHoleScoreInput
): Promise<OfflineHoleScore> {
  if (input.holeNumber < 1 || input.holeNumber > 18) {
    throw new Error('holeNumber debe estar entre 1 y 18.');
  }
  if (input.strokes < 1 || input.strokes > 20) {
    throw new Error('strokes debe estar entre 1 y 20.');
  }

  const nowIso = new Date().toISOString();
  const db = await getOrInitNativeDb();

  if (db) {
    const existingRes = await db.query(
      `SELECT revision FROM local_hole_scores WHERE round_id = ? AND player_id = ? AND hole_number = ?;`,
      [input.roundId, input.playerId, input.holeNumber]
    );
    const prevRevision = Number(existingRes.values?.[0]?.revision ?? 0);
    const nextRevision = prevRevision + 1;

    await db.run(
      `INSERT INTO local_hole_scores (
        round_id, player_id, hole_number, strokes, putts,
        fairway_hit, green_in_regulation, sand_save, penalty_strokes,
        stableford_points, sync_status, revision, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(round_id, player_id, hole_number) DO UPDATE SET
        strokes = excluded.strokes,
        putts = excluded.putts,
        fairway_hit = excluded.fairway_hit,
        green_in_regulation = excluded.green_in_regulation,
        sand_save = excluded.sand_save,
        penalty_strokes = excluded.penalty_strokes,
        stableford_points = excluded.stableford_points,
        sync_status = 'pending',
        revision = excluded.revision,
        updated_at = excluded.updated_at;`,
      [
        input.roundId,
        input.playerId,
        input.holeNumber,
        input.strokes,
        input.putts,
        input.fairwayHit === null ? null : input.fairwayHit ? 1 : 0,
        input.greenInRegulation ? 1 : 0,
        input.sandSave === undefined || input.sandSave === null
          ? null
          : input.sandSave
            ? 1
            : 0,
        input.penaltyStrokes ?? 0,
        input.stablefordPoints,
        nextRevision,
        nowIso,
      ]
    );

    return {
      ...input,
      sandSave: input.sandSave ?? null,
      penaltyStrokes: input.penaltyStrokes ?? 0,
      syncStatus: 'pending',
      revision: nextRevision,
      updatedAt: nowIso,
    };
  }

  const scores = readFallbackScores();
  const key = makeScoreKey(input.roundId, input.playerId, input.holeNumber);
  const existing = scores.get(key);
  const nextRevision = (existing?.revision ?? 0) + 1;

  const record: OfflineHoleScore = {
    ...input,
    sandSave: input.sandSave ?? null,
    penaltyStrokes: input.penaltyStrokes ?? 0,
    syncStatus: 'pending',
    revision: nextRevision,
    updatedAt: nowIso,
  };

  scores.set(key, record);
  writeFallbackScores(scores);

  return record;
}

/**
 * Obtiene todos los golpes registrados localmente para una ronda (y opcionalmente un jugador), ordenados por hoyo.
 */
export async function getOfflineRoundScores(
  roundId: string,
  playerId?: string
): Promise<OfflineHoleScore[]> {
  const db = await getOrInitNativeDb();
  if (db) {
    const querySql = playerId
      ? `SELECT * FROM local_hole_scores WHERE round_id = ? AND player_id = ? ORDER BY hole_number ASC;`
      : `SELECT * FROM local_hole_scores WHERE round_id = ? ORDER BY hole_number ASC;`;
    const params = playerId ? [roundId, playerId] : [roundId];
    const res = await db.query(querySql, params);
    return ((res.values ?? []) as RawSqliteScoreRow[]).map(
      mapSqliteRowToOfflineScore
    );
  }

  const scores = readFallbackScores();
  return Array.from(scores.values())
    .filter(
      (s) => s.roundId === roundId && (!playerId || s.playerId === playerId)
    )
    .sort((a, b) => a.holeNumber - b.holeNumber);
}

/**
 * Obtiene todos los golpes pendientes de sincronizar con Supabase.
 */
export async function getPendingSyncScores(): Promise<OfflineHoleScore[]> {
  const db = await getOrInitNativeDb();
  if (db) {
    const res = await db.query(
      `SELECT * FROM local_hole_scores WHERE sync_status = 'pending' ORDER BY round_id, hole_number ASC;`
    );
    return ((res.values ?? []) as RawSqliteScoreRow[]).map(
      mapSqliteRowToOfflineScore
    );
  }

  const scores = readFallbackScores();
  return Array.from(scores.values()).filter((s) => s.syncStatus === 'pending');
}

/**
 * Marca un registro de hoyo como sincronizado ('synced') tras hacer upsert en Supabase,
 * verificando opcionalmente `expectedRevision` para no sobrescribir una edición más reciente.
 */
export async function markScoreAsSynced(
  roundId: string,
  playerId: string,
  holeNumber: number,
  expectedRevision?: number
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const db = await getOrInitNativeDb();

  if (db) {
    const sql =
      expectedRevision !== undefined
        ? `UPDATE local_hole_scores SET sync_status = 'synced', updated_at = ? WHERE round_id = ? AND player_id = ? AND hole_number = ? AND revision = ?;`
        : `UPDATE local_hole_scores SET sync_status = 'synced', updated_at = ? WHERE round_id = ? AND player_id = ? AND hole_number = ?;`;
    const params =
      expectedRevision !== undefined
        ? [nowIso, roundId, playerId, holeNumber, expectedRevision]
        : [nowIso, roundId, playerId, holeNumber];
    const runRes = await db.run(sql, params);
    return (runRes.changes?.changes ?? 0) > 0;
  }

  const scores = readFallbackScores();
  const key = makeScoreKey(roundId, playerId, holeNumber);
  const existing = scores.get(key);
  if (!existing) {
    return false;
  }
  if (expectedRevision !== undefined && existing.revision !== expectedRevision) {
    // El jugador editó el hoyo mientras se enviaba la versión anterior; se mantiene 'pending'
    return false;
  }
  scores.set(key, {
    ...existing,
    syncStatus: 'synced',
    updatedAt: nowIso,
  });
  writeFallbackScores(scores);
  return true;
}

/**
 * Guarda en caché offline los hoyos y coordenadas GPS de un campo para jugar sin cobertura.
 */
export async function cacheCourseHoles(
  courseId: string,
  holes: CachedCourseHole[]
): Promise<void> {
  const sorted = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
  const db = await getOrInitNativeDb();

  if (db) {
    for (const h of sorted) {
      await db.run(
        `INSERT INTO local_course_holes (
          course_id, hole_number, par, stroke_index, distance_yellow_meters,
          green_front_lat, green_front_lng, green_center_lat, green_center_lng,
          green_back_lat, green_back_lng
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(course_id, hole_number) DO UPDATE SET
          par = excluded.par,
          stroke_index = excluded.stroke_index,
          distance_yellow_meters = excluded.distance_yellow_meters,
          green_front_lat = excluded.green_front_lat,
          green_front_lng = excluded.green_front_lng,
          green_center_lat = excluded.green_center_lat,
          green_center_lng = excluded.green_center_lng,
          green_back_lat = excluded.green_back_lat,
          green_back_lng = excluded.green_back_lng;`,
        [
          courseId,
          h.holeNumber,
          h.par,
          h.strokeIndex,
          h.distanceYellowMeters,
          h.greenFrontLat,
          h.greenFrontLng,
          h.greenCenterLat,
          h.greenCenterLng,
          h.greenBackLat,
          h.greenBackLng,
        ]
      );
    }
  }

  memoryCoursesMap.set(courseId, sorted);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const allObj = Object.fromEntries(memoryCoursesMap.entries());
      window.localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(allObj));
    } catch {
      // Ignore quota errors
    }
  }
}

/**
 * Recupera de la caché offline los hoyos de un campo.
 */
export async function getCachedCourseHoles(
  courseId: string
): Promise<CachedCourseHole[]> {
  const db = await getOrInitNativeDb();
  if (db) {
    const res = await db.query(
      `SELECT * FROM local_course_holes WHERE course_id = ? ORDER BY hole_number ASC;`,
      [courseId]
    );
    if (res.values && res.values.length > 0) {
      return res.values.map((r: Record<string, unknown>) => ({
        courseId: String(r.course_id),
        holeNumber: Number(r.hole_number),
        par: Number(r.par),
        strokeIndex: Number(r.stroke_index),
        distanceYellowMeters: Number(r.distance_yellow_meters),
        greenFrontLat: Number(r.green_front_lat),
        greenFrontLng: Number(r.green_front_lng),
        greenCenterLat: Number(r.green_center_lat),
        greenCenterLng: Number(r.green_center_lng),
        greenBackLat: Number(r.green_back_lat),
        greenBackLng: Number(r.green_back_lng),
      }));
    }
  }

  const fromMem = memoryCoursesMap.get(courseId);
  if (fromMem) {
    return fromMem;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(COURSES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CachedCourseHole[]>;
        if (parsed[courseId]) {
          memoryCoursesMap.set(courseId, parsed[courseId]);
          return parsed[courseId];
        }
      }
    } catch {
      // Ignore parse errors
    }
  }
  return [];
}

export const cacheCourseData = cacheCourseHoles;
export const getCachedCourseData = getCachedCourseHoles;

/**
 * Limpia los datos offline almacenados y reinicia la caché de conexión para pruebas.
 */
export async function clearOfflineStore(): Promise<void> {
  if (activeNativeDb) {
    try {
      await activeNativeDb.execute(`
        DELETE FROM local_hole_scores;
        DELETE FROM local_course_holes;
      `);
    } catch {
      // Ignore cleanup error in mock
    }
    activeNativeDb = null;
  }
  sqliteConnectionInstance = null;
  memoryScoresMap.clear();
  memoryCoursesMap.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(SCORES_STORAGE_KEY);
    window.localStorage.removeItem(COURSES_STORAGE_KEY);
  }
}
