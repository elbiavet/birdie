import {
  getOfflineRoundScores,
  getPendingSyncScores,
  markScoreAsSynced,
  saveOfflineHoleScore,
  type OfflineHoleScore,
  type OfflineHoleScoreInput,
} from '@/lib/capacitor/sqlite';
import {
  calculateHoleStablefordPoints,
  calculateStrokesReceivedOnHole,
} from '@/lib/scoring/engine';
import { getSupabaseClient } from '@/lib/supabase/client';

export interface RecordHoleScoreParams {
  roundId: string;
  playerId: string;
  holeNumber: number;
  par: number;
  strokeIndex: number;
  playingHandicap: number;
  /**
   * Número de hoyos de la vuelta (9 o 18). Por defecto 18.
   * Garantiza el cálculo correcto de golpes recibidos WHS y puntos Stableford en vueltas de 9 hoyos.
   */
  holesCount?: 9 | 18;
  strokes: number;
  putts: number;
  fairwayHit?: boolean | null;
  greenInRegulation?: boolean;
  sandSave?: boolean | null;
  penaltyStrokes?: number;
}

export interface SyncQueueState {
  pendingCount: number;
  pendingScores: OfflineHoleScore[];
  lastCheckedAt: string;
}

export type FlushSyncStatus =
  | 'synced'
  | 'partial_or_failed'
  | 'skipped_offline'
  | 'skipped_unconfigured';

export interface FlushSyncResult {
  status: FlushSyncStatus;
  reason?: string;
  attemptedCount: number;
  syncedCount: number;
  remainingPendingCount: number;
  syncedAt: string;
}

export type RemoteScoreUploader = (
  score: OfflineHoleScore
) => Promise<{ ok: boolean; error?: string }>;

// Mutex en memoria para evitar que dos llamadas simultáneas a flushPendingScoresToSupabase dupliquen envíos
let activeFlushPromise: Promise<FlushSyncResult> | null = null;

/**
 * Registra un hoyo siguiendo la estrategia Offline-First:
 * 1. Calcula automáticamente los golpes recibidos por WHS (para 9 o 18 hoyos) y puntos Stableford.
 * 2. Persiste inmediatamente en SQLite local con estado `syncStatus = 'pending'` e incrementa `revision`.
 */
export async function recordHoleScoreOfflineFirst(
  params: RecordHoleScoreParams
): Promise<OfflineHoleScore> {
  const holesCount: 9 | 18 = params.holesCount === 9 ? 9 : 18;
  const strokesReceived = calculateStrokesReceivedOnHole(
    params.playingHandicap,
    params.strokeIndex,
    holesCount
  );
  const stablefordPoints = calculateHoleStablefordPoints(
    params.strokes,
    params.par,
    strokesReceived
  );

  const payload: OfflineHoleScoreInput = {
    roundId: params.roundId,
    playerId: params.playerId,
    holeNumber: params.holeNumber,
    strokes: params.strokes,
    putts: params.putts,
    fairwayHit: params.fairwayHit ?? null,
    greenInRegulation: params.greenInRegulation ?? false,
    sandSave: params.sandSave ?? null,
    penaltyStrokes: params.penaltyStrokes ?? 0,
    stablefordPoints,
  };

  return saveOfflineHoleScore(payload);
}

/**
 * Obtiene el estado actual de la cola de sincronización SQLite local.
 */
export async function getSyncQueueState(): Promise<SyncQueueState> {
  const pendingScores = await getPendingSyncScores();
  return {
    pendingCount: pendingScores.length,
    pendingScores,
    lastCheckedAt: new Date().toISOString(),
  };
}

async function executeFlushPendingScores(
  customUploader?: RemoteScoreUploader
): Promise<FlushSyncResult> {
  const pending = await getPendingSyncScores();
  const nowIso = new Date().toISOString();

  if (pending.length === 0) {
    return {
      status: 'synced',
      attemptedCount: 0,
      syncedCount: 0,
      remainingPendingCount: 0,
      syncedAt: nowIso,
    };
  }

  let uploader: RemoteScoreUploader;

  if (customUploader) {
    uploader = customUploader;
  } else {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        status: 'skipped_offline',
        reason:
          'Dispositivo sin conexión a internet: los golpes se mantienen pendientes en SQLite local.',
        attemptedCount: pending.length,
        syncedCount: 0,
        remainingPendingCount: pending.length,
        syncedAt: nowIso,
      };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        status: 'skipped_unconfigured',
        reason:
          'Credenciales de Supabase no configuradas: los golpes permanecen pendientes en SQLite local sin marcarse como sincronizados.',
        attemptedCount: pending.length,
        syncedCount: 0,
        remainingPendingCount: pending.length,
        syncedAt: nowIso,
      };
    }

    uploader = async (score: OfflineHoleScore) => {
      const { error } = await supabase.from('hole_scores').upsert(
        {
          round_id: score.roundId,
          player_id: score.playerId,
          hole_number: score.holeNumber,
          strokes: score.strokes,
          putts: score.putts,
          fairway_hit: score.fairwayHit,
          green_in_regulation: score.greenInRegulation,
          sand_save: score.sandSave ?? null,
          penalty_strokes: score.penaltyStrokes ?? 0,
          stableford_points: score.stablefordPoints,
          client_updated_at: score.updatedAt,
        },
        { onConflict: 'round_id,player_id,hole_number' }
      );

      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    };
  }

  let syncedCount = 0;
  let lastError: string | undefined;

  for (const scoreSnapshot of pending) {
    const res = await uploader(scoreSnapshot);
    if (res.ok) {
      // Verifica expectedRevision (scoreSnapshot.revision) para no marcar como 'synced' si hubo una edición más reciente en vuelo
      const marked = await markScoreAsSynced(
        scoreSnapshot.roundId,
        scoreSnapshot.playerId,
        scoreSnapshot.holeNumber,
        scoreSnapshot.revision
      );
      if (marked) {
        syncedCount += 1;
      }
    } else if (res.error) {
      lastError = res.error;
    }
  }

  const remaining = await getPendingSyncScores();
  const allSynced = remaining.length === 0 && syncedCount === pending.length;

  return {
    status: allSynced ? 'synced' : 'partial_or_failed',
    reason: allSynced
      ? undefined
      : lastError ??
        'Algunos golpes no pudieron confirmarse o fueron editados durante el envío y siguen pendientes.',
    attemptedCount: pending.length,
    syncedCount,
    remainingPendingCount: remaining.length,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Vacía la cola de golpes pendientes (`pending`) en SQLite local hacia Supabase (`hole_scores`):
 * - Protegido por mutex en vuelo: llamadas concurrentes comparten la misma ejecución sin duplicar trabajo.
 * - Control de versiones (`revision`): si un golpe se vuelve a editar mientras se sube, no se marca como `synced`.
 * - Sin sincronización ficticia: si faltan credenciales o conexión, mantiene los registros `pending`.
 */
export async function flushPendingScoresToSupabase(
  customUploader?: RemoteScoreUploader
): Promise<FlushSyncResult> {
  if (activeFlushPromise) {
    return activeFlushPromise;
  }

  activeFlushPromise = executeFlushPendingScores(customUploader).finally(() => {
    activeFlushPromise = null;
  });

  return activeFlushPromise;
}

export { getOfflineRoundScores };
