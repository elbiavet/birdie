import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  PushNotifications,
  type ActionPerformed,
  type PushNotificationSchema,
  type Token,
} from '@capacitor/push-notifications';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client';

export type PushPlatform = 'android' | 'ios' | 'web';

export interface PushTokenRegistration {
  token: string;
  platform: PushPlatform;
  deviceName: string;
  registeredAt: string;
  userId?: string;
  isActive?: boolean;
}

export interface PushListenerOptions {
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onActionPerformed?: (action: ActionPerformed) => void;
  onRouteNavigate?: (route: string) => void;
}

export interface SavePushTokenResult {
  success: boolean;
  persisted: boolean;
  token: string;
  error?: string;
  reason?: 'saved' | 'demo_fallback' | 'supabase_unconfigured' | 'error';
}

export interface DeactivatePushTokenResult {
  success: boolean;
  token: string;
  error?: string;
}

// Registro en memoria para entornos de desarrollo web, pruebas y fallback offline
const inMemoryPushTokens = new Map<string, PushTokenRegistration>();

/**
 * Detecta la plataforma de notificaciones push activa (FCM en Android, APNs en iOS, o Web).
 */
export function detectPushPlatform(): PushPlatform {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'android';
  if (platform === 'ios') return 'ios';
  return 'web';
}

/**
 * Extrae la ruta de navegación interna a partir del payload de datos de la notificación push.
 */
export function extractNotificationRoute(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const payload = data as Record<string, unknown>;
  const rawTarget =
    payload.target_url ||
    payload.route ||
    payload.url ||
    payload.path ||
    payload.link;

  if (typeof rawTarget !== 'string' || !rawTarget.trim()) {
    return null;
  }

  const trimmed = rawTarget.trim();
  // Si es una URL absoluta hacia la misma app o relativa
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.pathname + parsed.search;
  } catch {
    return trimmed.startsWith('#') ? trimmed : `/${trimmed}`;
  }
}

/**
 * Solicita permisos de notificaciones push, registra el dispositivo ante FCM/APNs
 * y opcionalmente persiste el token en la base de datos de Supabase del club.
 */
export async function registerForPushNotifications(
  clubId = 'demo-club',
  userId?: string,
  client?: SupabaseClient | null
): Promise<PushTokenRegistration> {
  const platform = detectPushPlatform();
  let registration: PushTokenRegistration;

  if (Capacitor.isNativePlatform()) {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      throw new Error('Permiso de notificaciones push denegado por el usuario.');
    }

    const tokenPromise = new Promise<string>((resolve, reject) => {
      let regHandle: PluginListenerHandle | null = null;
      let errHandle: PluginListenerHandle | null = null;

      const cleanup = () => {
        regHandle?.remove();
        errHandle?.remove();
      };

      PushNotifications.addListener('registration', (token: Token) => {
        cleanup();
        resolve(token.value);
      }).then((handle) => {
        regHandle = handle;
      });

      PushNotifications.addListener('registrationError', (err) => {
        cleanup();
        reject(new Error(err.error || 'Error registrando notificaciones push'));
      }).then((handle) => {
        errHandle = handle;
      });
    });

    await PushNotifications.register();
    const token = await tokenPromise;

    registration = {
      token,
      platform,
      deviceName: `Capacitor ${platform.toUpperCase()} (${clubId})`,
      registeredAt: new Date().toISOString(),
      userId,
      isActive: true,
    };
  } else {
    // Fallback web seguro para previsualización, SSR y pruebas sin entorno nativo
    registration = {
      token: `web_fcm_preview_${clubId}_token`,
      platform: 'web',
      deviceName: `Web Browser Preview (${clubId})`,
      registeredAt: new Date().toISOString(),
      userId,
      isActive: true,
    };
  }

  // Guardar en memoria local
  const key = `${userId || 'anonymous'}:${registration.token}`;
  inMemoryPushTokens.set(key, registration);

  // Si se facilitó userId, sincronizar con Supabase
  if (userId) {
    await savePushTokenToSupabase(registration, userId, client);
  }

  return registration;
}

/**
 * Persiste o actualiza (upsert) el token del dispositivo del socio en public.device_push_tokens.
 */
export async function savePushTokenToSupabase(
  registration: PushTokenRegistration,
  userId: string,
  client?: SupabaseClient | null
): Promise<SavePushTokenResult> {
  const supabase = client ?? getSupabaseClient();

  if (!supabase) {
    return {
      success: true,
      persisted: false,
      token: registration.token,
      reason: 'supabase_unconfigured',
    };
  }

  try {
    const { error } = await supabase.from('device_push_tokens').upsert(
      {
        user_id: userId,
        token: registration.token,
        platform: registration.platform,
        device_name: registration.deviceName,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,token',
      }
    );

    if (error) {
      return {
        success: false,
        persisted: false,
        token: registration.token,
        error: error.message,
        reason: 'error',
      };
    }

    return {
      success: true,
      persisted: true,
      token: registration.token,
      reason: 'saved',
    };
  } catch (err) {
    return {
      success: false,
      persisted: false,
      token: registration.token,
      error: err instanceof Error ? err.message : 'Error desconocido al persistir token',
      reason: 'error',
    };
  }
}

/**
 * Configura los escuchadores de eventos para notificaciones recibidas en primer plano
 * y pulsaciones de notificación con navegación interna (deep-linking).
 */
export async function setupPushNotificationListeners(
  options: PushListenerOptions = {}
): Promise<() => Promise<void>> {
  if (!Capacitor.isNativePlatform()) {
    return async () => {
      // No-op en entornos web o servidor
    };
  }

  const handles: PluginListenerHandle[] = [];

  if (options.onNotificationReceived) {
    const hReceived = await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        options.onNotificationReceived?.(notification);
      }
    );
    handles.push(hReceived);
  }

  if (options.onActionPerformed || options.onRouteNavigate) {
    const hAction = await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        options.onActionPerformed?.(action);

        const route = extractNotificationRoute(action.notification.data);
        if (route && options.onRouteNavigate) {
          options.onRouteNavigate(route);
        }
      }
    );
    handles.push(hAction);
  }

  return async () => {
    for (const h of handles) {
      await h.remove();
    }
  };
}

/**
 * Desactiva un push token en Supabase (ej. al cerrar sesión o revocar permisos)
 * marcando is_active = false para evitar envíos huérfanos.
 */
export async function deactivatePushToken(
  token: string,
  userId: string,
  client?: SupabaseClient | null
): Promise<DeactivatePushTokenResult> {
  const key = `${userId}:${token}`;
  const local = inMemoryPushTokens.get(key);
  if (local) {
    local.isActive = false;
  }

  const supabase = client ?? getSupabaseClient();
  if (!supabase) {
    return { success: true, token };
  }

  try {
    const { error } = await supabase
      .from('device_push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      return { success: false, token, error: error.message };
    }

    return { success: true, token };
  } catch (err) {
    return {
      success: false,
      token,
      error: err instanceof Error ? err.message : 'Error desactivando push token',
    };
  }
}

/**
 * Función auxiliar para consultar el registro en memoria durante pruebas.
 */
export function getInMemoryPushTokens(): PushTokenRegistration[] {
  return Array.from(inMemoryPushTokens.values());
}

/**
 * Limpia el almacén en memoria (útil en beforeEach de tests).
 */
export function clearInMemoryPushTokens(): void {
  inMemoryPushTokens.clear();
}
