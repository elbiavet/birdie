import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export type PushPlatform = 'android' | 'ios' | 'web';

export interface PushTokenRegistration {
  token: string;
  platform: PushPlatform;
  deviceName: string;
  registeredAt: string;
}

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
 * Solicita permisos de notificaciones push y devuelve el token FCM / APNs (o un token simulado en modo desarrollo web).
 */
export async function registerForPushNotifications(
  clubId = 'demo-club'
): Promise<PushTokenRegistration> {
  const platform = detectPushPlatform();

  if (Capacitor.isNativePlatform()) {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      throw new Error('Permiso de notificaciones push denegado por el usuario.');
    }

    const tokenPromise = new Promise<string>((resolve, reject) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value);
      });
      PushNotifications.addListener('registrationError', (err) => {
        reject(new Error(err.error || 'Error registrando notificaciones push'));
      });
    });

    await PushNotifications.register();
    const token = await tokenPromise;

    return {
      token,
      platform,
      deviceName: `Capacitor ${platform.toUpperCase()} (${clubId})`,
      registeredAt: new Date().toISOString(),
    };
  }

  // Fallback web seguro para previsualización y pruebas en navegador
  return {
    token: `web_fcm_preview_${clubId}_token`,
    platform: 'web',
    deviceName: 'Web Browser Preview',
    registeredAt: new Date().toISOString(),
  };
}
