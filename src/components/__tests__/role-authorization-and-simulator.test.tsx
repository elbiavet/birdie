import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ClubProvider,
  resolveAuthorizedDemoProfile,
  useClub,
} from '@/components/providers/ClubProvider';
import { AppShell } from '@/components/layout/AppShell';
import LoginPage from '@/app/(auth)/login/page';
import AdminDashboardPage from '@/app/(main)/admin/page';
import DashboardPage from '@/app/page';
import ProfilePage from '@/app/(main)/profile/page';
import { DEMO_PROFILES_BY_ROLE } from '@/lib/supabase/client';
import { getClubConfig } from '@/lib/club-config';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

// Componente auxiliar para probar la lógica de useClub directamente en un entorno React
function RoleTestConsumer({
  onMount,
}: {
  onMount: (ctx: ReturnType<typeof useClub>) => void;
}) {
  const ctx = useClub();
  onMount(ctx);
  return <div data-testid="consumer-ready" data-role={ctx.profile?.role ?? 'none'} />;
}

describe('Fase 7: Control de Acceso por Rol y Restricción Estricta del Simulador a Superadmin', () => {
  const demoClub = getClubConfig('demo-club');

  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
  });

  describe('1. Controles de simulación de roles (visibilidad y accesibilidad)', () => {
    it('oculta totalmente el selector de simulación en AppShell para player y club_admin', () => {
      // 1.1 Para player
      const playerHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <AppShell>
            <div>Contenido</div>
          </AppShell>
        </ClubProvider>
      );
      expect(playerHtml).not.toContain('Selector de rol RLS');
      expect(playerHtml).not.toContain('Simular:');
      expect(playerHtml).toContain('Rol: Jugador');

      // 1.2 Para club_admin
      const adminHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.club_admin}>
          <AppShell>
            <div>Contenido</div>
          </AppShell>
        </ClubProvider>
      );
      expect(adminHtml).not.toContain('Selector de rol RLS');
      expect(adminHtml).not.toContain('Simular:');
      expect(adminHtml).toContain('Rol: Admin Club');
    });

    it('muestra el selector de simulación en AppShell únicamente cuando el rol autenticado es superadmin', () => {
      const superAdminHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.superadmin}>
          <AppShell>
            <div>Contenido</div>
          </AppShell>
        </ClubProvider>
      );
      expect(superAdminHtml).toContain('aria-label="Selector de rol RLS"');
      expect(superAdminHtml).toContain('Simular: jugador (player)');
      expect(superAdminHtml).toContain('Simular: admin club (club_admin)');
      expect(superAdminHtml).toContain('Simular: superadmin');
    });

    it('oculta el panel simulador de roles en la pantalla de login (/login) para usuarios no autenticados como superadmin', () => {
      // Player
      const playerLoginHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <LoginPage />
        </ClubProvider>
      );
      expect(playerLoginHtml).not.toContain('Simulador de Roles RLS (Exclusivo Superadmin)');
      expect(playerLoginHtml).not.toContain('handleSimulateRole');

      // Club Admin
      const adminLoginHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.club_admin}>
          <LoginPage />
        </ClubProvider>
      );
      expect(adminLoginHtml).not.toContain('Simulador de Roles RLS (Exclusivo Superadmin)');
    });

    it('muestra el simulador de roles en la pantalla de login únicamente cuando el usuario autenticado es superadmin', () => {
      const superadminLoginHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.superadmin}>
          <LoginPage />
        </ClubProvider>
      );
      expect(superadminLoginHtml).toContain('Simulador de Roles RLS (Exclusivo Superadmin)');
      expect(superadminLoginHtml).toContain('Jugador (Player)');
      expect(superadminLoginHtml).toContain('Admin Club');
      expect(superadminLoginHtml).toContain('Superadmin');
    });

    it('no ofrece el botón de conmutar/probar como Club Admin en la vista 403 de /admin a un player', () => {
      const playerAdminHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <AdminDashboardPage />
        </ClubProvider>
      );
      expect(playerAdminHtml).toContain('Error 403 · Permiso Denegado');
      expect(playerAdminHtml).not.toContain('Probar como Club Admin (Demo)');
      expect(playerAdminHtml).not.toContain('Simular como Club Admin');
      expect(playerAdminHtml).toContain('Volver al Inicio');
    });
  });

  describe('2. Visibilidad estricta de App ID (club.appId)', () => {
    it('oculta por completo club.appId a player y club_admin en AppShell', () => {
      // 2.1 Player
      const playerHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <AppShell>
            <div>Test</div>
          </AppShell>
        </ClubProvider>
      );
      expect(playerHtml).not.toContain('App ID:');
      expect(playerHtml).not.toContain(demoClub.appId);

      // 2.2 Club Admin
      const adminHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.club_admin}>
          <AppShell>
            <div>Test</div>
          </AppShell>
        </ClubProvider>
      );
      expect(adminHtml).not.toContain('App ID:');
      expect(adminHtml).not.toContain(demoClub.appId);
    });

    it('muestra club.appId únicamente cuando el usuario activo es superadmin', () => {
      const superHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.superadmin}>
          <AppShell>
            <div>Test</div>
          </AppShell>
        </ClubProvider>
      );
      expect(superHtml).toContain('App ID:');
      expect(superHtml).toContain(demoClub.appId);
      expect(superHtml).toContain(`<code class="font-mono">${demoClub.appId}</code>`);
    });
  });

  describe('3. Protección en la lógica (rechazo de setRole no autorizado y resistencia a localStorage)', () => {
    it('rechaza en la lógica las llamadas a setRole() cuando el rol autenticado es player', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <RoleTestConsumer
            onMount={(ctx) => {
              capturedCtx = ctx;
            }}
          />
        </ClubProvider>
      );

      expect(capturedCtx.authenticatedProfile?.role).toBe('player');
      expect(capturedCtx.canSimulateRoles).toBe(false);

      // Intento no autorizado 1: escalar a superadmin
      const resSuper = capturedCtx.setRole('superadmin');
      expect(resSuper).toBe(false);
      expect(capturedCtx.profile?.role).toBe('player');

      // Intento no autorizado 2: escalar a club_admin
      const resAdmin = capturedCtx.setRole('club_admin');
      expect(resAdmin).toBe(false);
      expect(capturedCtx.profile?.role).toBe('player');
    });

    it('rechaza en la lógica las llamadas a setRole() cuando el rol autenticado es club_admin', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.club_admin}>
          <RoleTestConsumer
            onMount={(ctx) => {
              capturedCtx = ctx;
            }}
          />
        </ClubProvider>
      );

      expect(capturedCtx.authenticatedProfile?.role).toBe('club_admin');
      expect(capturedCtx.canSimulateRoles).toBe(false);

      // Intento no autorizado: simular superadmin
      const res = capturedCtx.setRole('superadmin');
      expect(res).toBe(false);
      expect(capturedCtx.profile?.role).toBe('club_admin');
    });

    it('permite a un superadmin autenticado simular player y club_admin, y luego restablecer', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.superadmin}>
          <RoleTestConsumer
            onMount={(ctx) => {
              capturedCtx = ctx;
            }}
          />
        </ClubProvider>
      );

      expect(capturedCtx.authenticatedProfile?.role).toBe('superadmin');
      expect(capturedCtx.canSimulateRoles).toBe(true);

      // Simular player: la función setRole autoriza la operación y devuelve true
      const simPlayer = capturedCtx.setRole('player');
      expect(simPlayer).toBe(true);

      // Simular club_admin: también autorizada
      const simAdmin = capturedCtx.setRole('club_admin');
      expect(simAdmin).toBe(true);

      // Restablecer simulación
      expect(() => capturedCtx.resetSimulatedRole()).not.toThrow();
    });

    it('no confía en localStorage para conceder privilegios de superadmin o administrador', () => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('birdie_active_role_v1', 'superadmin');
      }

      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <RoleTestConsumer
            onMount={(ctx) => {
              capturedCtx = ctx;
            }}
          />
        </ClubProvider>
      );

      // Con perfil de socio estándar, no se escala a superadmin por localStorage
      expect(capturedCtx.profile?.role).toBe('player');
      expect(capturedCtx.authenticatedProfile?.role).toBe('player');
      expect(capturedCtx.canSimulateRoles).toBe(false);
    });
  });

  describe('4. Autenticación explícita en modo demo (loginWithDemo)', () => {
    it('asigna rol superadmin únicamente con el correo oficial ops@birdie.app', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <RoleTestConsumer
            onMount={(ctx) => {
              capturedCtx = ctx;
            }}
          />
        </ClubProvider>
      );

      const loginRes = capturedCtx.loginWithDemo('ops@birdie.app');
      expect(loginRes.success).toBe(true);
      expect(loginRes.profile?.role).toBe('superadmin');
    });

    it('asigna rol club_admin con el correo comite@rcgvalleverde.es sin conceder simulador', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <RoleTestConsumer
            onMount={(ctx) => {
              capturedCtx = ctx;
            }}
          />
        </ClubProvider>
      );

      const loginRes = capturedCtx.loginWithDemo('comite@rcgvalleverde.es');
      expect(loginRes.success).toBe(true);
      expect(loginRes.profile?.role).toBe('club_admin');
    });

    it('rechaza correos arbitrarios no autorizados en modo demo', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <RoleTestConsumer
            onMount={(ctx) => {
              capturedCtx = ctx;
            }}
          />
        </ClubProvider>
      );

      const loginRes = capturedCtx.loginWithDemo('intruso@desconocido.com');
      expect(loginRes.success).toBe(false);
      expect(loginRes.error).toContain('Credenciales no autorizadas');
      expect(capturedCtx.authenticatedProfile?.role).toBe('player');
    });

    it('verifica la resolución determinista de perfiles con resolveAuthorizedDemoProfile', () => {
      expect(resolveAuthorizedDemoProfile('ops@birdie.app')?.role).toBe('superadmin');
      expect(resolveAuthorizedDemoProfile('OPS@BIRDIE.APP')?.role).toBe('superadmin');
      expect(resolveAuthorizedDemoProfile('comite@rcgvalleverde.es')?.role).toBe('club_admin');
      expect(resolveAuthorizedDemoProfile('carlos.mendoza@socio.es')?.role).toBe('player');
      expect(resolveAuthorizedDemoProfile('hacker@intruso.es')).toBeNull();
    });
  });

  describe('5. Renderizado correcto de pantallas para los tres roles', () => {
    const roles = ['player', 'club_admin', 'superadmin'] as const;

    roles.forEach((r) => {
      it(`renderiza correctamente DashboardPage, LoginPage y ProfilePage para el rol ${r}`, () => {
        const profile = DEMO_PROFILES_BY_ROLE[r];

        const dashHtml = renderToStaticMarkup(
          <ClubProvider initialClubId="demo-club" initialProfile={profile}>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </ClubProvider>
        );
        expect(dashHtml).toContain('Bienvenido,');
        expect(dashHtml).toContain(profile.fullName);

        const loginHtml = renderToStaticMarkup(
          <ClubProvider initialClubId="demo-club" initialProfile={profile}>
            <AppShell>
              <LoginPage />
            </AppShell>
          </ClubProvider>
        );
        expect(loginHtml).toContain('Acceso de Socios');

        const profileHtml = renderToStaticMarkup(
          <ClubProvider initialClubId="demo-club" initialProfile={profile}>
            <AppShell>
              <ProfilePage />
            </AppShell>
          </ClubProvider>
        );
        expect(profileHtml).toContain('Licencia Federativa:');
        expect(profileHtml).toContain(profile.federationLicense);
      });
    });

    it('conserva el acceso y funcionalidades administrativas para club_admin y superadmin sin exclusividad artificial', () => {
      // 1. club_admin accede sin 403
      const adminHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.club_admin}>
          <AppShell>
            <AdminDashboardPage />
          </AppShell>
        </ClubProvider>
      );
      expect(adminHtml).not.toContain('Error 403');
      expect(adminHtml).toContain('Panel de Administración del Club');
      expect(adminHtml).toContain('Emisión de Notificaciones Push');

      // 2. superadmin accede sin 403
      const superHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.superadmin}>
          <AppShell>
            <AdminDashboardPage />
          </AppShell>
        </ClubProvider>
      );
      expect(superHtml).not.toContain('Error 403');
      expect(superHtml).toContain('Panel de Administración del Club');
      expect(superHtml).toContain('Emisión de Notificaciones Push');
    });
  });

  describe('6. Cierre de sesión universal y accesibilidad de credenciales demo', () => {
    it('muestra el botón de Cerrar Sesión universal en AppShell, ProfilePage y LoginPage para todos los roles', () => {
      // 1. AppShell
      const shellHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <AppShell>
            <div>Test</div>
          </AppShell>
        </ClubProvider>
      );
      expect(shellHtml).toContain('aria-label="Cerrar sesión"');

      // 2. ProfilePage
      const profileHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <ProfilePage />
        </ClubProvider>
      );
      expect(profileHtml).toContain('Cerrar Sesión');

      // 3. LoginPage con rol player
      const loginPlayerHtml = renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <LoginPage />
        </ClubProvider>
      );
      expect(loginPlayerHtml).toContain('Cerrar Sesión');
      expect(loginPlayerHtml).toContain('ops@birdie.app');
      expect(loginPlayerHtml).toContain('Acceso Rápido con Perfiles Demo Autorizados');
    });

    it('permite autenticar como superadmin y restablecer sesión limpiamente', () => {
      let capturedCtx!: ReturnType<typeof useClub>;

      renderToStaticMarkup(
        <ClubProvider initialClubId="demo-club" initialProfile={DEMO_PROFILES_BY_ROLE.player}>
          <RoleTestConsumer
            onMount={(ctx) => {
              capturedCtx = ctx;
            }}
          />
        </ClubProvider>
      );

      // Autenticar como superadmin
      const loginRes = capturedCtx.loginWithDemo('ops@birdie.app');
      expect(loginRes.success).toBe(true);
      expect(loginRes.profile?.role).toBe('superadmin');

      // Cerrar sesión
      expect(() => capturedCtx.logout()).not.toThrow();
    });
  });
});
