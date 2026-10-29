import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboardPage from '@/app/(main)/admin/page';
import ProfilePage from '@/app/(main)/profile/page';
import { AppShell } from '@/components/layout/AppShell';
import { ClubProvider } from '@/components/providers/ClubProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import {
  clearInMemoryPushTokens,
  deactivatePushToken,
  detectPushPlatform,
  extractNotificationRoute,
  getInMemoryPushTokens,
  registerForPushNotifications,
  savePushTokenToSupabase,
} from '@/lib/capacitor/push';
import {
  buildApnsPayload,
  buildFcmV1Payload,
  canSendClubPushNotifications,
  groupTargetsByPlatform,
  isPushTokenRevokedError,
  preparePushDispatchItems,
  sendClubPushNotification,
  validatePushNotificationParams,
  type PushNotificationTarget,
  type SendPushNotificationParams,
} from '@/lib/push';
import { DEMO_PROFILES_BY_ROLE } from '@/lib/supabase/client';

vi.mock('next/navigation', () => ({
  usePathname: () => '/profile',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('Suite Integral de Notificaciones Push (FCM / APNs / Web) - Subfase 5.1 (F5.1-T04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearInMemoryPushTokens();
  });

  // ============================================================================
  // BLOQUE 1: Ciclo de Vida y Persistencia de Tokens (Cliente Capacitor)
  // ============================================================================
  it('registra tokens con fallback web seguro, detecta plataforma y almacena en memoria y Supabase', async () => {
    expect(detectPushPlatform()).toBe('web');

    const reg = await registerForPushNotifications(
      'demo-club',
      'aaaa0000-0000-0000-0000-000000000001'
    );
    expect(reg.platform).toBe('web');
    expect(reg.token).toContain('demo-club');
    expect(reg.userId).toBe('aaaa0000-0000-0000-0000-000000000001');
    expect(reg.isActive).toBe(true);

    const stored = getInMemoryPushTokens();
    expect(stored).toHaveLength(1);
    expect(stored[0].token).toBe(reg.token);
  });

  it('realiza upsert en public.device_push_tokens y gestiona revocación con deactivatePushToken', async () => {
    let capturedUpsert: Record<string, unknown> | null = null;
    let capturedUpdate: Record<string, unknown> | null = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'device_push_tokens') {
          return {
            upsert: vi.fn((payload) => {
              capturedUpsert = payload;
              return Promise.resolve({ error: null });
            }),
            update: vi.fn((payload) => {
              capturedUpdate = payload;
              return {
                eq: vi.fn().mockReturnThis(),
                then: (resolve: (val: unknown) => void) => resolve({ error: null }),
              };
            }),
          };
        }
        return {} as never;
      }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const tokenData = {
      token: 'fcm_android_prod_token_999',
      platform: 'android' as const,
      deviceName: 'Samsung Galaxy S24',
      registeredAt: new Date().toISOString(),
    };

    const saveRes = await savePushTokenToSupabase(
      tokenData,
      'aaaa0000-0000-0000-0000-000000000001',
      mockSupabase
    );
    expect(saveRes.success).toBe(true);
    expect(saveRes.persisted).toBe(true);
    expect(capturedUpsert).toMatchObject({
      user_id: 'aaaa0000-0000-0000-0000-000000000001',
      token: 'fcm_android_prod_token_999',
      platform: 'android',
      is_active: true,
    });

    // Desactivar token
    const deactRes = await deactivatePushToken(
      'fcm_android_prod_token_999',
      'aaaa0000-0000-0000-0000-000000000001',
      mockSupabase
    );
    expect(deactRes.success).toBe(true);
    expect(capturedUpdate).toEqual({ is_active: false });
  });

  it('normaliza URLs relativas y absolutas para deep-linking con extractNotificationRoute', () => {
    expect(extractNotificationRoute({ target_url: '/tournaments' })).toBe('/tournaments');
    expect(extractNotificationRoute({ route: 'forum?cat=rules' })).toBe('/forum?cat=rules');
    expect(extractNotificationRoute({ link: 'https://birdie.golf/news' })).toBe('/news');
    expect(extractNotificationRoute({ url: '/bookings' })).toBe('/bookings');
    expect(extractNotificationRoute(undefined)).toBeNull();
  });

  // ============================================================================
  // BLOQUE 2: Despacho Multi-Plataforma y Lógica de Edge Function
  // ============================================================================
  const sampleParams: SendPushNotificationParams = {
    clubId: 'pinos-golf',
    title: 'Aviso Importante de Mantenimiento',
    body: 'El green del hoyo 7 permanecerá cerrado por pinchado hasta las 14:00.',
    targetUrl: '/info',
    badge: 1,
    data: { category: 'maintenance', hole: '7' },
  };

  const sampleTargets: PushNotificationTarget[] = [
    {
      id: 'target-android',
      userId: 'user-1',
      token: 'fcm_token_android',
      platform: 'android',
      deviceName: 'Pixel 8',
      isActive: true,
    },
    {
      id: 'target-ios',
      userId: 'user-2',
      token: 'apns_token_ios',
      platform: 'ios',
      deviceName: 'iPhone 15 Pro',
      isActive: true,
    },
    {
      id: 'target-web',
      userId: 'user-3',
      token: 'web_token_browser',
      platform: 'web',
      deviceName: 'Safari Web',
      isActive: true,
    },
    {
      id: 'target-inactive',
      userId: 'user-4',
      token: 'revoked_token',
      platform: 'android',
      deviceName: 'Old Tablet',
      isActive: false,
    },
  ];

  it('valida parámetros de notificación rechazando campos vacíos o tipos erróneos', () => {
    expect(validatePushNotificationParams({ title: '', body: 'Msg' }).valid).toBe(false);
    expect(validatePushNotificationParams({ title: 'Aviso', body: '' }).valid).toBe(false);
    expect(
      validatePushNotificationParams({ title: 'Ok', body: 'Ok', userIds: {} as never }).valid
    ).toBe(false);
    expect(
      validatePushNotificationParams({ title: 'Ok', body: 'Ok', userIds: ['u1'] }).valid
    ).toBe(true);
  });

  it('genera payloads compatibles con FCM HTTP v1 (Android y Web) con metadatos de club y canal de alta prioridad', () => {
    const androidTarget = sampleTargets[0];
    const androidPayload = buildFcmV1Payload(androidTarget, sampleParams);

    expect(androidPayload.message.token).toBe('fcm_token_android');
    expect(androidPayload.message.notification.title).toBe('Aviso Importante de Mantenimiento');
    expect(androidPayload.message.android?.priority).toBe('high');
    expect(androidPayload.message.android?.notification?.channel_id).toBe(
      'birdie_club_announcements'
    );
    expect(androidPayload.message.data.club_id).toBe('pinos-golf');
    expect(androidPayload.message.data.target_url).toBe('/info');
    expect(androidPayload.message.data.hole).toBe('7');

    const webTarget = sampleTargets[2];
    const webPayload = buildFcmV1Payload(webTarget, sampleParams);
    expect(webPayload.message.token).toBe('web_token_browser');
    expect(webPayload.message.webpush?.headers?.Urgency).toBe('high');
    expect(webPayload.message.webpush?.fcm_options?.link).toBe('/info');
  });

  it('genera payload para APNs (iOS) con aps.alert, badge, sonido y content-available', () => {
    const iosTarget = sampleTargets[1];
    const apnsPayload = buildApnsPayload(iosTarget, sampleParams);

    expect(apnsPayload.token).toBe('apns_token_ios');
    expect(apnsPayload.aps.alert.title).toBe('Aviso Importante de Mantenimiento');
    expect(apnsPayload.aps.badge).toBe(1);
    expect(apnsPayload.aps.sound).toBe('default');
    expect(apnsPayload.aps['content-available']).toBe(1);
    expect(apnsPayload.data.target_url).toBe('/info');
  });

  it('agrupa por plataforma y prepara items de despacho excluyendo tokens inactivos', () => {
    const grouped = groupTargetsByPlatform(sampleTargets);
    expect(grouped.android).toHaveLength(1);
    expect(grouped.ios).toHaveLength(1);
    expect(grouped.web).toHaveLength(1);

    const items = preparePushDispatchItems(sampleTargets, sampleParams);
    expect(items).toHaveLength(3); // target-inactive excluido
  });

  it('identifica correctamente códigos de error de tokens revocados frente a incidencias transitorias', () => {
    expect(isPushTokenRevokedError('Token is UNREGISTERED', 200)).toBe(true);
    expect(isPushTokenRevokedError('BadDeviceToken', 400)).toBe(true);
    expect(isPushTokenRevokedError('DeviceTokenNotForTopic', 400)).toBe(true);
    expect(isPushTokenRevokedError(undefined, 404)).toBe(true);
    expect(isPushTokenRevokedError(undefined, 410)).toBe(true);

    expect(isPushTokenRevokedError('Internal Server Error', 500)).toBe(false);
    expect(isPushTokenRevokedError('Network timeout', 504)).toBe(false);
  });

  it('restringe la emisión masiva de notificaciones a roles administrativos', async () => {
    expect(canSendClubPushNotifications('player')).toBe(false);
    expect(canSendClubPushNotifications('club_admin')).toBe(true);
    expect(canSendClubPushNotifications('superadmin')).toBe(true);

    await expect(sendClubPushNotification(sampleParams, 'player')).rejects.toThrow(
      /Permiso denegado/
    );

    const adminResult = await sendClubPushNotification(sampleParams, 'club_admin');
    expect(adminResult.success).toBe(true);
    expect(adminResult.status).toBe('simulated');
    expect(adminResult.sentCount).toBeGreaterThanOrEqual(1);
  });

  // ============================================================================
  // BLOQUE 3: Renderizado SSR de Interfaz (Perfil y Admin) sin Duplicidades
  // ============================================================================
  it('renderiza la sección de Notificaciones Push en /profile dentro de ClubProvider + AppShell', () => {
    const html = renderToStaticMarkup(
      <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
        <ThemeProvider>
          <AppShell>
            <ProfilePage />
          </AppShell>
        </ThemeProvider>
      </ClubProvider>
    );

    expect(html).toContain('Activar Notificaciones Push (FCM / APNs)');
    expect(html).toContain('Carlos Mendoza');

    // Comprobar unicidad estructural de AppShell (1 solo header y 1 solo aside)
    const headerCount = (html.match(/<header\b/g) || []).length;
    const asideCount = (html.match(/<aside\b/g) || []).length;
    expect(headerCount).toBe(1);
    expect(asideCount).toBe(1);
  });

  it('renderiza la Consola de Emisión de Notificaciones Push en /admin con rol club_admin dentro de AppShell', () => {
    const html = renderToStaticMarkup(
      <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.club_admin}>
        <ThemeProvider>
          <AppShell>
            <AdminDashboardPage />
          </AppShell>
        </ThemeProvider>
      </ClubProvider>
    );

    expect(html).toContain('Emisión de Notificaciones Push (FCM / APNs)');
    expect(html).toContain('Título del Aviso');
    expect(html).toContain('Ruta de Destino (Deep-link)');
    expect(html).toContain('Transmitir Notificación Push');

    // Comprobar unicidad estructural
    const headerCount = (html.match(/<header\b/g) || []).length;
    const asideCount = (html.match(/<aside\b/g) || []).length;
    expect(headerCount).toBe(1);
    expect(asideCount).toBe(1);
  });
});
