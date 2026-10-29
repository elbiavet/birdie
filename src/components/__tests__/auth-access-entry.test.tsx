import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ClubProvider,
  useClub,
} from '@/components/providers/ClubProvider';
import { AppShell } from '@/components/layout/AppShell';
import { AuthAccessView } from '@/components/auth/AuthAccessView';
import DashboardPage from '@/app/page';
import LoginPage from '@/app/(auth)/login/page';
import { DEMO_PROFILES_BY_ROLE } from '@/lib/supabase/client';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

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
  return <div data-testid="auth-probe" data-authenticated={ctx.isAuthenticated} />;
}

describe('Fase 9: Página de Acceso White-Label como Punto de Entrada, Autenticación y Registro', () => {
  let originalWindow: any;
  const sessionStorageMap = new Map<string, string>();
  const localStorageMap = new Map<string, string>();
  const assignSpy = vi.fn();

  beforeEach(() => {
    sessionStorageMap.clear();
    localStorageMap.clear();
    assignSpy.mockClear();
    mockPush.mockClear();
    mockReplace.mockClear();

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
        pathname: '/',
        assign: assignSpy,
        href: '/',
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

  describe('1. No restauración automática de usuario estándar ni simulación de sesión', () => {
    it('en una carga limpia sin sesión activa, inicia en null y no autoasigna el rol player ni demo', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club">
          <ConsumerProbe onCapture={(ctx) => (capturedCtx = ctx)} />
        </ClubProvider>
      );

      // No debe auto-asignar Carlos Mendoza ni rol player
      expect(capturedCtx.isAuthenticated).toBe(false);
      expect(capturedCtx.authenticatedProfile).toBeNull();
      expect(capturedCtx.profile).toBeNull();
      expect(capturedCtx.canSimulateRoles).toBe(false);
      expect(capturedCtx.simulatedRole).toBeNull();
    });

    it('no considera localStorage como prueba de autenticación', () => {
      window.localStorage.setItem('birdie_active_role_v1', 'superadmin');
      window.localStorage.setItem('birdie_demo_auth_session_v1', 'ops@birdie.app');

      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club">
          <ConsumerProbe onCapture={(ctx) => (capturedCtx = ctx)} />
        </ClubProvider>
      );

      // localStorage ignorado por seguridad
      expect(capturedCtx.isAuthenticated).toBe(false);
      expect(capturedCtx.authenticatedProfile).toBeNull();
    });
  });

  describe('2. Contenido White-Label de la Página de Acceso (Logo, Nombre y Fallback)', () => {
    it('muestra el nombre y el logo del club activo según la configuración white-label (demo-club)', () => {
      const html = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club">
          <AuthAccessView />
        </ClubProvider>
      );

      expect(html).toContain('Real Club de Golf Valle Verde');
      expect(html).toContain('Tradición y deporte desde 1968');
      expect(html).toContain('src="/club-logo.svg"');
      expect(html).toContain('alt="Logo oficial de Real Club de Golf Valle Verde"');
      expect(html).toContain('Portal de Acceso · demo-club');
    });

    it('refleja la configuración del segundo club white-label (pinos-golf)', () => {
      const html = renderToStaticMarkup(
        <ClubProvider initialClubId="pinos-golf">
          <AuthAccessView />
        </ClubProvider>
      );

      expect(html).toContain('Club de Golf Los Pinos del Mar');
      expect(html).toContain('Portal de Acceso · pinos-golf');
      expect(html).toContain('alt="Logo oficial de Club de Golf Los Pinos del Mar"');
    });

    it('renderiza la estructura de tabs para alternar entre Iniciar Sesión y Registrarse', () => {
      const html = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club">
          <AuthAccessView />
        </ClubProvider>
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('id="tab-login"');
      expect(html).toContain('id="tab-register"');
      expect(html).toContain('Iniciar Sesión');
      expect(html).toContain('Registrarse');
      expect(html).toContain('data-testid="login-form"');
    });

    it('renderiza el formulario de registro cuando defaultMode es register', () => {
      const html = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club">
          <AuthAccessView defaultMode="register" />
        </ClubProvider>
      );

      expect(html).toContain('data-testid="register-form"');
      expect(html).toContain('Nombre y Apellidos');
      expect(html).toContain('Correo Electrónico');
      expect(html).toContain('Licencia Federativa (opcional)');
      expect(html).toContain('Crear Cuenta');
    });
  });

  describe('3. Comportamiento de Rutas: Entrada sin Sesión vs Acceso con Sesión', () => {
    it('al navegar a la página de acceso (/login) teniendo ya una sesión válida, muestra aviso y enlace de redirección a la principal', () => {
      const html = renderToStaticMarkup(
        <ClubProvider
          initialClubId="demo-club"
          initialProfile={DEMO_PROFILES_BY_ROLE.player}
        >
          <LoginPage />
        </ClubProvider>
      );

      expect(html).toContain('Ya has iniciado sesión en Real Club de Golf Valle Verde');
      expect(html).toContain('Redirigiendo al panel principal');
      expect(html).toContain('Carlos Mendoza');
      expect(html).toContain('Ir al Panel');
    });

    it('en LoginPage sin sesión activa, renderiza el portal de acceso completo', () => {
      const html = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={null}>
          <LoginPage />
        </ClubProvider>
      );

      expect(html).toContain('Real Club de Golf Valle Verde');
      expect(html).toContain('data-testid="auth-access-container"');
      expect(html).toContain('Sin sesión activa');
      expect(html).toContain('Inicia sesión con tus credenciales o mediante un perfil demo autorizado');
      expect(html).toContain('ops@birdie.app');
      expect(html).toContain('comite@rcgvalleverde.es');
      expect(html).toContain('carlos.mendoza@socio.es');
    });
  });

  describe('4. Cierre de sesión, invalidación y redirección', () => {
    it('después de logout(), purga la sesión y redirige a la página de acceso /login', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider
          initialClubId="demo-club"
          initialProfile={DEMO_PROFILES_BY_ROLE.superadmin}
        >
          <ConsumerProbe onCapture={(ctx) => (capturedCtx = ctx)} />
        </ClubProvider>
      );

      expect(capturedCtx.isAuthenticated).toBe(true);

      // Invocar logout
      capturedCtx.logout();

      // Redirige a la página de acceso
      expect(assignSpy).toHaveBeenCalledWith('/login');

      // Claves de sesión eliminadas y marcado de logout explícito
      expect(window.sessionStorage.getItem('birdie_session_logged_out_v1')).toBe('true');
      expect(window.sessionStorage.getItem('birdie_demo_auth_session_v1')).toBeNull();

      // En recarga posterior, la sesión inicia en null
      let reloadedCtx!: ReturnType<typeof useClub>;
      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club">
          <ConsumerProbe onCapture={(ctx) => (reloadedCtx = ctx)} />
        </ClubProvider>
      );
      expect(reloadedCtx.isAuthenticated).toBe(false);
      expect(reloadedCtx.authenticatedProfile).toBeNull();
      expect(reloadedCtx.profile).toBeNull();
    });
  });

  describe('5. Autenticación exitosa y carga de perfil', () => {
    it('loginWithDemo autentica al socio, carga el perfil autorizado y limpia la bandera de logout', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      // Inicia desautenticado tras logout
      window.sessionStorage.setItem('birdie_session_logged_out_v1', 'true');

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={null}>
          <ConsumerProbe onCapture={(ctx) => (capturedCtx = ctx)} />
        </ClubProvider>
      );

      expect(capturedCtx.isAuthenticated).toBe(false);

      const res = capturedCtx.loginWithDemo('carlos.mendoza@socio.es');
      expect(res.success).toBe(true);
      expect(res.profile?.fullName).toBe('Carlos Mendoza');
      expect(res.profile?.role).toBe('player');
      expect(res.profile?.email).toBe('carlos.mendoza@socio.es');

      // Limpia la bandera de logout y registra la sesión
      expect(window.sessionStorage.getItem('birdie_session_logged_out_v1')).toBeNull();
      expect(window.sessionStorage.getItem('birdie_demo_auth_session_v1')).toBe('carlos.mendoza@socio.es');
    });
  });
});
