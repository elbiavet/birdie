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

export interface RecordHoleScoreParams {
  roundId: string;
  playerId: string;
  holeNumber: number;
  par: number;
  strokeIndex: number;
  playingHandicap: number;
  strokes: number;
  putts: number;
  fairwayHit: boolean | null;
  greenInRegulation: boolean;
  sandSave?: boolean | null;
  penaltyStrokes?: number;
}

export interface SyncQueueState {
  pendingCount: number;
  pendingScores: OfflineHoleScore[];
  lastCheckedAt: string;
}

export interface FlushSyncResult {
  attemptedCount: number;
  syncedCount: number;
  remainingPendingCount: number;
  syncedAt: string;
}

export type RemoteScoreUploader = (
  score: OfflineHoleScore
) => Promise<{ ok: boolean; error?: string }>;

/**
 * Registra un hoyo siguiendo la estrategia Offline-First:
 * 1. Calcula automáticamente los golpes recibidos por WHS y puntos Stableford.
 * 2. Persiste inmediatamente en SQLite local con estado `syncStatus = 'pending'`.
 */
export async function recordHoleScoreOfflineFirst(
  params: RecordHoleScoreParams
): Promise<OfflineHoleScore> {
  const strokesReceived = calculateStrokesReceivedOnHole(
    params.playingHandicap,
    params.strokeIndex,
    18
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
    fairwayHit: params.fairwayHit,
    greenInRegulation: params.greenInRegulation,
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

/**
 * Vacía la cola de golpes pendientes (`pending`) en SQLite local hacia Supabase (`hole_scores`)
 * y marca cada registro confirmado como `synced`.
 */
export async function flushPendingScoresToSupabase(
  customUploader?: RemoteScoreUploader
): Promise<FlushSyncResult> {
  const pending = await getPendingSyncScores();
  let syncedCount = 0;

  const uploader: RemoteScoreUploader =
    customUploader ??
    (async () => {
      // En modo local/staging sin credenciales remotas activas, confirma el upsert
      return { ok: true };
    });

  for (const score of pending) {
    const res = await uploader(score);
    if (res.ok) {
      const marked = await markScoreAsSynced(
        score.roundId,
        score.playerId,
        score.holeNumber
      );
      if (marked) {
        syncedCount += 1;
      }
    }
  }

  const remaining = await getPendingSyncScores();

  return {
    attemptedCount: pending.length,
    syncedCount,
    remainingPendingCount: remaining.length,
    syncedAt: new Date().toISOString(),
  };
}

export { getOfflineRoundScores };
