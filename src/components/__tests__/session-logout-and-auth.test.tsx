import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ClubProvider,
  useClub,
} from '@/components/providers/ClubProvider';
import { AppShell } from '@/components/layout/AppShell';
import LoginPage from '@/app/(auth)/login/page';
import ProfilePage from '@/app/(main)/profile/page';
import { DEMO_PROFILES_BY_ROLE } from '@/lib/supabase/client';

// Mock de navegación para Next.js
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock de ThemeProvider
vi.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({
    themeMode: 'dark',
    resolvedTheme: 'dark',
    toggleTheme: vi.fn(),
    setThemeMode: vi.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function ConsumerProbe({
  onCapture,
}: {
  onCapture: (ctx: ReturnType<typeof useClub>) => void;
}) {
  const ctx = useClub();
  onCapture(ctx);
  return <div data-testid="probe" data-authenticated={ctx.isAuthenticated} />;
}

describe('Subfase 8.1: Cierre de Sesión Estricto, Invalidez de Estado y Redirección a Login', () => {
  let originalWindow: any;
  const sessionStorageMap = new Map<string, string>();
  const localStorageMap = new Map<string, string>();
  const assignSpy = vi.fn();

  beforeEach(() => {
    sessionStorageMap.clear();
    localStorageMap.clear();
    assignSpy.mockClear();

    originalWindow = (globalThis as any).window;

    const mockSessionStorage = {
      getItem: (key: string) => sessionStorageMap.get(key) ?? null,
      setItem: (key: string, val: string) => sessionStorageMap.set(key, String(val)),
      removeItem: (key: string) => sessionStorageMap.delete(key),
      clear: () => sessionStorageMap.clear(),
    };

    const mockLocalStorage = {
      getItem: (key: string) => localStorageMap.get(key) ?? null,
      setItem: (key: string, val: string) => localStorageMap.set(key, String(val)),
      removeItem: (key: string) => localStorageMap.delete(key),
      clear: () => localStorageMap.clear(),
    };

    (globalThis as any).window = {
      location: {
        pathname: '/profile',
        assign: assignSpy,
        href: '/profile',
      },
      sessionStorage: mockSessionStorage,
      localStorage: mockLocalStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      navigator: { onLine: true },
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  describe('1. Invalidez de sesión en logout(), purga de datos y no restauración de player', () => {
    it('al llamar a logout(), purga el almacenamiento local y marca la sesión como cerrada', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      // Simulamos que el usuario tenía credenciales y roles en storage
      window.sessionStorage.setItem('birdie_demo_auth_session_v1', 'ops@birdie.app');
      window.sessionStorage.setItem('birdie_simulated_role_v1', 'club_admin');
      window.localStorage.setItem('birdie_active_role_v1', 'superadmin');

      renderToStaticMarkup(
        <ClubProvider
          initialClubId="demo-club"
          initialProfile={DEMO_PROFILES_BY_ROLE.superadmin}
        >
          <ConsumerProbe onCapture={(ctx) => (capturedCtx = ctx)} />
        </ClubProvider>
      );

      // Ejecutar logout
      capturedCtx.logout();

      // Verifica que las claves de sesión fueron eliminadas y se registró el logout explícito
      expect(window.sessionStorage.getItem('birdie_demo_auth_session_v1')).toBeNull();
      expect(window.sessionStorage.getItem('birdie_simulated_role_v1')).toBeNull();
      expect(window.sessionStorage.getItem('birdie_session_logged_out_v1')).toBe('true');
      expect(window.localStorage.getItem('birdie_active_role_v1')).toBeNull();
    });

    it('tras cerrar sesión, una nueva carga sin sesión previa inicia con profile y authenticatedProfile en null (no restaura player)', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider
          initialClubId="demo-club"
          initialProfile={DEMO_PROFILES_BY_ROLE.player}
        >
          <ConsumerProbe onCapture={(ctx) => (capturedCtx = ctx)} />
        </ClubProvider>
      );

      capturedCtx.logout();
      expect(window.sessionStorage.getItem('birdie_session_logged_out_v1')).toBe('true');

      // Nueva instancia de ClubProvider (simulando recarga tras logout)
      let postLogoutCtx!: ReturnType<typeof useClub>;
      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club">
          <ConsumerProbe onCapture={(ctx) => (postLogoutCtx = ctx)} />
        </ClubProvider>
      );

      // Debe estar desautenticado y NO restaurar automáticamente el perfil 'player'
      expect(postLogoutCtx.isAuthenticated).toBe(false);
      expect(postLogoutCtx.profile).toBeNull();
      expect(postLogoutCtx.authenticatedProfile).toBeNull();
      expect(postLogoutCtx.canSimulateRoles).toBe(false);
      expect(postLogoutCtx.simulatedRole).toBeNull();
    });

    it('ejecuta redirección a /login al cerrar sesión', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider
          initialClubId="demo-club"
          initialProfile={DEMO_PROFILES_BY_ROLE.player}
        >
          <ConsumerProbe onCapture={(ctx) => (capturedCtx = ctx)} />
        </ClubProvider>
      );

      capturedCtx.logout();

      expect(assignSpy).toHaveBeenCalledWith('/login');
    });
  });

  describe('2. Carga del perfil correspondiente al iniciar sesión', () => {
    it('loginWithDemo carga exactamente el perfil autorizado según las credenciales y limpia el flag de logout', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      // Inicia en estado desautenticado
      window.sessionStorage.setItem('birdie_session_logged_out_v1', 'true');

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={null}>
          <ConsumerProbe onCapture={(ctx) => (capturedCtx = ctx)} />
        </ClubProvider>
      );

      expect(capturedCtx.isAuthenticated).toBe(false);

      // 1. Login como admin club
      const adminRes = capturedCtx.loginWithDemo('comite@rcgvalleverde.es');
      expect(adminRes.success).toBe(true);
      expect(adminRes.profile?.role).toBe('club_admin');
      expect(adminRes.profile?.email).toBe('comite@rcgvalleverde.es');
      expect(window.sessionStorage.getItem('birdie_session_logged_out_v1')).toBeNull();
      expect(window.sessionStorage.getItem('birdie_demo_auth_session_v1')).toBe('comite@rcgvalleverde.es');

      // 2. Login como superadmin
      const superRes = capturedCtx.loginWithDemo('ops@birdie.app');
      expect(superRes.success).toBe(true);
      expect(superRes.profile?.role).toBe('superadmin');
      expect(superRes.profile?.email).toBe('ops@birdie.app');
      expect(window.sessionStorage.getItem('birdie_demo_auth_session_v1')).toBe('ops@birdie.app');

      // 3. Login como jugador
      const playerRes = capturedCtx.loginWithDemo('carlos.mendoza@socio.es');
      expect(playerRes.success).toBe(true);
      expect(playerRes.profile?.role).toBe('player');
      expect(playerRes.profile?.email).toBe('carlos.mendoza@socio.es');
      expect(window.sessionStorage.getItem('birdie_demo_auth_session_v1')).toBe('carlos.mendoza@socio.es');

      // 4. Intento con credencial no autorizada
      const failRes = capturedCtx.loginWithDemo('intruso@noexiste.com');
      expect(failRes.success).toBe(false);
      expect(failRes.error).toContain('Credenciales no autorizadas');
    });
  });

  describe('3. Renderizado de interfaz en estado no autenticado (profile === null)', () => {
    it('AppShell oculta el badge de hándicap, el selector de simulación y el botón logout si no hay sesión', () => {
      const shellHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={null}>
          <AppShell>
            <div>Vista Pública</div>
          </AppShell>
        </ClubProvider>
      );

      // No debe mostrar HCP numérico
      expect(shellHtml).not.toContain('HCP 11.4');
      // No debe mostrar el selector de simulación
      expect(shellHtml).not.toContain('aria-label="Selector de rol RLS"');
      // No debe mostrar el botón de cerrar sesión
      expect(shellHtml).not.toContain('aria-label="Cerrar sesión"');
      // Debe mostrar el botón Iniciar Sesión hacia /login
      expect(shellHtml).toContain('Iniciar Sesión');
      expect(shellHtml).toContain('href="/login"');
    });

    it('LoginPage muestra el estado "Sin sesión activa" cuando el usuario no está autenticado', () => {
      const loginHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={null}>
          <LoginPage />
        </ClubProvider>
      );

      expect(loginHtml).toContain('Sin sesión activa');
      expect(loginHtml).toContain('Inicia sesión con tus credenciales o mediante un perfil demo autorizado');
      // Permite acceder en 1-clic con los perfiles autorizados
      expect(loginHtml).toContain('ops@birdie.app');
      expect(loginHtml).toContain('comite@rcgvalleverde.es');
      expect(loginHtml).toContain('carlos.mendoza@socio.es');
    });

    it('ProfilePage muestra aviso informativo y enlace a login si el usuario no tiene sesión', () => {
      const profileHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={null}>
          <ProfilePage />
        </ClubProvider>
      );

      expect(profileHtml).toContain('Debes iniciar sesión para consultar tu índice de hándicap');
      expect(profileHtml).toContain('Iniciar Sesión');
      expect(profileHtml).toContain('href="/login"');
      // No debe mostrar formularios de edición de perfil si no hay sesión
      expect(profileHtml).not.toContain('Guardar Cambios en Perfil');
    });
  });
});
