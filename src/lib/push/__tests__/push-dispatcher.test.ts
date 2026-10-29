import { describe, expect, it, vi } from 'vitest';
import {
  buildApnsPayload,
  buildFcmV1Payload,
  canSendClubPushNotifications,
  groupTargetsByPlatform,
  isPushTokenRevokedError,
  normalizePushDataRecord,
  preparePushDispatchItems,
  sendClubPushNotification,
  validatePushNotificationParams,
  type PushNotificationTarget,
  type SendPushNotificationParams,
} from '../index';

describe('Motor de Notificaciones Push y Edge Function (F5.1-T02)', () => {
  const sampleParams: SendPushNotificationParams = {
    clubId: 'demo-club',
    title: 'Torneo Social de Primavera',
    body: 'Abiertas las inscripciones para el torneo medal play del sábado.',
    targetUrl: '/tournaments?id=torneo-primavera',
    badge: 2,
    data: { tournamentId: 'torneo-primavera', category: 'social' },
  };

  const sampleTargets: PushNotificationTarget[] = [
    {
      id: 'target-1',
      userId: 'user-android',
      token: 'fcm_token_android_123',
      platform: 'android',
      deviceName: 'Pixel 8',
      isActive: true,
    },
    {
      id: 'target-2',
      userId: 'user-ios',
      token: 'apns_token_ios_456',
      platform: 'ios',
      deviceName: 'iPhone 15 Pro',
      isActive: true,
    },
    {
      id: 'target-3',
      userId: 'user-web',
      token: 'web_token_789',
      platform: 'web',
      deviceName: 'Chrome Web Push',
      isActive: true,
    },
    {
      id: 'target-4',
      userId: 'user-inactive',
      token: 'inactive_token_000',
      platform: 'android',
      deviceName: 'Old Phone',
      isActive: false,
    },
  ];

  it('valida parámetros obligatorios y estructura de userIds', () => {
    expect(validatePushNotificationParams({ title: '', body: 'Mensaje' }).valid).toBe(false);
    expect(validatePushNotificationParams({ title: 'Aviso', body: '' }).valid).toBe(false);
    expect(
      validatePushNotificationParams({
        title: 'Aviso',
        body: 'Texto',
        userIds: 'not-an-array' as never,
      }).valid
    ).toBe(false);

    expect(
      validatePushNotificationParams({
        title: 'Aviso Válido',
        body: 'Texto descriptivo',
        userIds: ['u1', 'u2'],
      }).valid
    ).toBe(true);
  });

  it('normaliza registros de datos convirtiendo valores a string e inyectando targetUrl y clubId', () => {
    const normalized = normalizePushDataRecord(
      { numericId: 42, booleanFlag: true, text: 'hola' },
      '/news/art-1',
      'pinos-golf'
    );

    expect(normalized.club_id).toBe('pinos-golf');
    expect(normalized.target_url).toBe('/news/art-1');
    expect(normalized.numericId).toBe('42');
    expect(normalized.booleanFlag).toBe('true');
    expect(normalized.text).toBe('hola');
  });

  it('construye payloads formalizados FCM v1 para Android y Web con prioridad alta y deep-linking', () => {
    const androidTarget = sampleTargets[0];
    const androidPayload = buildFcmV1Payload(androidTarget, sampleParams);

    expect(androidPayload.message.token).toBe('fcm_token_android_123');
    expect(androidPayload.message.notification.title).toBe('Torneo Social de Primavera');
    expect(androidPayload.message.android?.priority).toBe('high');
    expect(androidPayload.message.android?.notification?.channel_id).toBe(
      'birdie_club_announcements'
    );
    expect(androidPayload.message.data.target_url).toBe(
      '/tournaments?id=torneo-primavera'
    );

    const webTarget = sampleTargets[2];
    const webPayload = buildFcmV1Payload(webTarget, sampleParams);
    expect(webPayload.message.token).toBe('web_token_789');
    expect(webPayload.message.webpush?.headers?.Urgency).toBe('high');
    expect(webPayload.message.webpush?.fcm_options?.link).toBe(
      '/tournaments?id=torneo-primavera'
    );
  });

  it('construye payload de APNs con aps.alert, badge, sonido y metadatos de aplicación', () => {
    const iosTarget = sampleTargets[1];
    const apnsPayload = buildApnsPayload(iosTarget, sampleParams);

    expect(apnsPayload.token).toBe('apns_token_ios_456');
    expect(apnsPayload.aps.alert.title).toBe('Torneo Social de Primavera');
    expect(apnsPayload.aps.badge).toBe(2);
    expect(apnsPayload.aps.sound).toBe('default');
    expect(apnsPayload.data.target_url).toBe('/tournaments?id=torneo-primavera');
  });

  it('agrupa destinatarios por plataforma activa excluyendo dispositivos inactivos', () => {
    const grouped = groupTargetsByPlatform(sampleTargets);

    expect(grouped.android).toHaveLength(1);
    expect(grouped.android[0].id).toBe('target-1');
    expect(grouped.ios).toHaveLength(1);
    expect(grouped.ios[0].id).toBe('target-2');
    expect(grouped.web).toHaveLength(1);
    expect(grouped.web[0].id).toBe('target-3');
  });

  it('discrimina errores de revocación de tokens frente a fallos transitorios de red', () => {
    expect(isPushTokenRevokedError('Requested entity was not found.', 404)).toBe(true);
    expect(isPushTokenRevokedError('Token is UNREGISTERED on Firebase', 200)).toBe(true);
    expect(isPushTokenRevokedError('BadDeviceToken from Apple', 400)).toBe(true);
    expect(isPushTokenRevokedError('ExpiredToken', 410)).toBe(true);
    expect(isPushTokenRevokedError(undefined, 410)).toBe(true);

    // Errores transitorios que NO deben desactivar el token
    expect(isPushTokenRevokedError('Gateway Timeout', 504)).toBe(false);
    expect(isPushTokenRevokedError('Service Unavailable', 503)).toBe(false);
  });

  it('prepara lista de envíos combinada con payloads específicos por plataforma', () => {
    const items = preparePushDispatchItems(sampleTargets, sampleParams);

    expect(items).toHaveLength(3); // Excluye target-4 inactivo
    const iosItem = items.find((i) => i.platform === 'ios');
    const androidItem = items.find((i) => i.platform === 'android');

    expect(iosItem?.apnsPayload).toBeDefined();
    expect(androidItem?.fcmPayload).toBeDefined();
  });

  it('aplica control de acceso por rol bloqueando a player y autorizando a club_admin y superadmin', async () => {
    expect(canSendClubPushNotifications('player')).toBe(false);
    expect(canSendClubPushNotifications(null)).toBe(false);
    expect(canSendClubPushNotifications('club_admin')).toBe(true);
    expect(canSendClubPushNotifications('superadmin')).toBe(true);

    await expect(
      sendClubPushNotification(sampleParams, 'player')
    ).rejects.toThrow(/Permiso denegado/);

    const result = await sendClubPushNotification(sampleParams, 'club_admin');
    expect(result.success).toBe(true);
    expect(result.sentCount).toBeGreaterThanOrEqual(1);
  });
});
