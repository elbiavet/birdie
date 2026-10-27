import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

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

// Almacenamiento en memoria para tests o entornos sin window.localStorage
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
          map.set(makeScoreKey(item.roundId, item.playerId, item.holeNumber), item);
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

/**
 * Inicializa las tablas SQLite en Android nativo si la plataforma lo soporta.
 */
export async function initOfflineDatabase(): Promise<{ backend: 'sqlite-native' | 'web-fallback' }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      const db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
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
          updated_at TEXT NOT NULL,
          PRIMARY KEY (round_id, player_id, hole_number)
        );
      `);
      return { backend: 'sqlite-native' };
    } catch {
      return { backend: 'web-fallback' };
    }
  }
  return { backend: 'web-fallback' };
}

/**
 * Guarda o actualiza un golpe de hoyo en el almacén offline marcándolo como 'pending' de sincronizar.
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

  const record: OfflineHoleScore = {
    ...input,
    sandSave: input.sandSave ?? null,
    penaltyStrokes: input.penaltyStrokes ?? 0,
    syncStatus: 'pending',
    updatedAt: new Date().toISOString(),
  };

  const scores = readFallbackScores();
  scores.set(makeScoreKey(record.roundId, record.playerId, record.holeNumber), record);
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
  const scores = readFallbackScores();
  return Array.from(scores.values()).filter((s) => s.syncStatus === 'pending');
}

/**
 * Marca un registro de hoyo como sincronizado ('synced') tras hacer upsert en Supabase.
 */
export async function markScoreAsSynced(
  roundId: string,
  playerId: string,
  holeNumber: number
): Promise<boolean> {
  const scores = readFallbackScores();
  const key = makeScoreKey(roundId, playerId, holeNumber);
  const existing = scores.get(key);
  if (!existing) {
    return false;
  }
  scores.set(key, {
    ...existing,
    syncStatus: 'synced',
    updatedAt: new Date().toISOString(),
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
 * Limpia los datos offline almacenados (útil para tests y cierre de sesión).
 */
export async function clearOfflineStore(): Promise<void> {
  memoryScoresMap.clear();
  memoryCoursesMap.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(SCORES_STORAGE_KEY);
    window.localStorage.removeItem(COURSES_STORAGE_KEY);
  }
}
