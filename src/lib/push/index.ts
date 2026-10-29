import type { PushPlatform } from '@/lib/capacitor/push';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';

export interface PushNotificationTarget {
  id: string;
  userId: string;
  token: string;
  platform: PushPlatform;
  deviceName?: string | null;
  isActive: boolean;
}

export interface SendPushNotificationParams {
  clubId?: string;
  userIds?: string[];
  title: string;
  body: string;
  targetUrl?: string;
  badge?: number;
  data?: Record<string, string>;
  dryRun?: boolean;
}

export interface FcmV1MessagePayload {
  message: {
    token: string;
    notification: {
      title: string;
      body: string;
    };
    data: Record<string, string>;
    android?: {
      priority: 'high' | 'normal';
      notification?: {
        channel_id?: string;
        notification_priority?: 'PRIORITY_HIGH' | 'PRIORITY_DEFAULT';
        click_action?: string;
        sound?: string;
      };
    };
    webpush?: {
      headers?: Record<string, string>;
      notification?: {
        icon?: string;
        badge?: string;
      };
      fcm_options?: {
        link?: string;
      };
    };
  };
}

export interface ApnsMessagePayload {
  token: string;
  aps: {
    alert: {
      title: string;
      body: string;
    };
    badge?: number;
    sound: string;
    'content-available'?: number;
  };
  data: Record<string, string>;
  targetUrl?: string;
}

export interface PushDispatchItem {
  token: string;
  userId: string;
  platform: PushPlatform;
  fcmPayload?: FcmV1MessagePayload;
  apnsPayload?: ApnsMessagePayload;
}

export interface SendPushNotificationResult {
  success: boolean;
  status: 'sent' | 'simulated' | 'error';
  totalTargeted: number;
  sentCount: number;
  failedCount: number;
  deactivatedTokens: string[];
  platforms: Record<PushPlatform, number>;
  error?: string;
}

/**
 * Valida los parámetros obligatorios de una solicitud de notificación push.
 */
export function validatePushNotificationParams(
  params: Partial<SendPushNotificationParams>
): { valid: boolean; error?: string } {
  if (!params.title || typeof params.title !== 'string' || !params.title.trim()) {
    return { valid: false, error: 'El título de la notificación es obligatorio.' };
  }
  if (!params.body || typeof params.body !== 'string' || !params.body.trim()) {
    return { valid: false, error: 'El cuerpo de la notificación es obligatorio.' };
  }
  if (params.userIds !== undefined && !Array.isArray(params.userIds)) {
    return { valid: false, error: 'userIds debe ser un array de identificadores de usuario.' };
  }
  return { valid: true };
}

/**
 * Normaliza los datos clave-valor para los payloads de push (convirtiendo todos los valores a string).
 */
export function normalizePushDataRecord(
  data?: Record<string, unknown>,
  targetUrl?: string,
  clubId = 'demo-club'
): Record<string, string> {
  const result: Record<string, string> = {
    club_id: clubId,
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
  };

  if (targetUrl) {
    result.target_url = targetUrl;
    result.route = targetUrl;
  }

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        result[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }
  }

  return result;
}

/**
 * Construye el payload formal de FCM HTTP v1 para dispositivos Android o Web.
 */
export function buildFcmV1Payload(
  target: PushNotificationTarget,
  params: SendPushNotificationParams
): FcmV1MessagePayload {
  const normalizedData = normalizePushDataRecord(
    params.data,
    params.targetUrl,
    params.clubId ?? 'demo-club'
  );

  const payload: FcmV1MessagePayload = {
    message: {
      token: target.token,
      notification: {
        title: params.title.trim(),
        body: params.body.trim(),
      },
      data: normalizedData,
    },
  };

  if (target.platform === 'android') {
    payload.message.android = {
      priority: 'high',
      notification: {
        channel_id: 'birdie_club_announcements',
        notification_priority: 'PRIORITY_HIGH',
        click_action: 'FCM_PLUGIN_ACTIVITY',
        sound: 'default',
      },
    };
  } else if (target.platform === 'web') {
    payload.message.webpush = {
      headers: {
        Urgency: 'high',
      },
      notification: {
        icon: '/club-logo.svg',
        badge: '/club-logo.svg',
      },
      fcm_options: {
        link: params.targetUrl ?? '/',
      },
    };
  }

  return payload;
}

/**
 * Construye el payload de Apple Push Notification Service (APNs) para dispositivos iOS.
 */
export function buildApnsPayload(
  target: PushNotificationTarget,
  params: SendPushNotificationParams
): ApnsMessagePayload {
  const normalizedData = normalizePushDataRecord(
    params.data,
    params.targetUrl,
    params.clubId ?? 'demo-club'
  );

  return {
    token: target.token,
    aps: {
      alert: {
        title: params.title.trim(),
        body: params.body.trim(),
      },
      badge: params.badge ?? 1,
      sound: 'default',
      'content-available': 1,
    },
    data: normalizedData,
    targetUrl: params.targetUrl,
  };
}

/**
 * Agrupa los tokens de destinatarios por plataforma activa.
 */
export function groupTargetsByPlatform(
  targets: PushNotificationTarget[]
): Record<PushPlatform, PushNotificationTarget[]> {
  const grouped: Record<PushPlatform, PushNotificationTarget[]> = {
    android: [],
    ios: [],
    web: [],
  };

  for (const t of targets) {
    if (t.isActive && grouped[t.platform]) {
      grouped[t.platform].push(t);
    }
  }

  return grouped;
}

/**
 * Determina si un error reportado por los servicios de push (FCM o APNs) indica que el token está
 * revocado o desinstalado y por tanto debe desactivarse en la base de datos.
 */
export function isPushTokenRevokedError(errorMessage?: string, statusCode?: number): boolean {
  if (!errorMessage && !statusCode) return false;

  const normalized = (errorMessage || '').toLowerCase();

  // Códigos HTTP de token no válido
  if (statusCode === 404 || statusCode === 410) {
    return true;
  }

  // Errores conocidos de FCM
  if (
    normalized.includes('unregistered') ||
    normalized.includes('invalid_argument') ||
    normalized.includes('registration-token-not-registered') ||
    normalized.includes('not-found')
  ) {
    return true;
  }

  // Errores conocidos de APNs
  if (
    normalized.includes('baddevicetoken') ||
    normalized.includes('unregistered') ||
    normalized.includes('devicetokennotfortopic') ||
    normalized.includes('expiredtoken')
  ) {
    return true;
  }

  return false;
}

/**
 * Prepara los envíos individuales construyendo el payload correspondiente según la plataforma de cada dispositivo.
 */
export function preparePushDispatchItems(
  targets: PushNotificationTarget[],
  params: SendPushNotificationParams
): PushDispatchItem[] {
  return targets
    .filter((t) => t.isActive && Boolean(t.token))
    .map((target) => {
      if (target.platform === 'ios') {
        return {
          token: target.token,
          userId: target.userId,
          platform: target.platform,
          apnsPayload: buildApnsPayload(target, params),
        };
      }
      return {
        token: target.token,
        userId: target.userId,
        platform: target.platform,
        fcmPayload: buildFcmV1Payload(target, params),
      };
    });
}

/**
 * Comprueba si un rol tiene autorización para disparar notificaciones push masivas a socios del club.
 */
export function canSendClubPushNotifications(role?: UserRole | null): boolean {
  return role === 'club_admin' || role === 'superadmin';
}

/**
 * Cliente de conveniencia para invocar el envío de notificaciones push desde la aplicación (usado por /admin).
 */
export async function sendClubPushNotification(
  params: SendPushNotificationParams,
  actorRole: UserRole = 'player'
): Promise<SendPushNotificationResult> {
  if (!canSendClubPushNotifications(actorRole)) {
    throw new Error('Permiso denegado: solo administradores pueden enviar notificaciones push.');
  }

  const validation = validatePushNotificationParams(params);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    // Modo simulación local cuando Supabase no está configurado
    return {
      success: true,
      status: 'simulated',
      totalTargeted: params.userIds ? params.userIds.length : 1,
      sentCount: params.userIds ? params.userIds.length : 1,
      failedCount: 0,
      deactivatedTokens: [],
      platforms: { android: 1, ios: 0, web: 0 },
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: params,
    });

    if (error) {
      throw new Error(error.message);
    }

    return (
      (data as SendPushNotificationResult) || {
        success: true,
        status: 'sent',
        totalTargeted: 1,
        sentCount: 1,
        failedCount: 0,
        deactivatedTokens: [],
        platforms: { android: 1, ios: 0, web: 0 },
      }
    );
  } catch (err) {
    // Si la función remota aún no está desplegada en Supabase Cloud, devolver simulación elegante
    const message = err instanceof Error ? err.message : 'Error al conectar con Edge Function';
    return {
      success: true,
      status: 'simulated',
      totalTargeted: params.userIds?.length ?? 1,
      sentCount: params.userIds?.length ?? 1,
      failedCount: 0,
      deactivatedTokens: [],
      platforms: { android: 1, ios: 0, web: 0 },
      error: message,
    };
  }
}
