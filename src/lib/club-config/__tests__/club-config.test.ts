import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildClubCssRootBlock,
  buildClubCssVariables,
  getActiveClubConfig,
  getClubConfig,
  getClubDomain,
  getEnabledFeatures,
  listRegisteredClubIds,
  validateClubConfig,
} from '../index';
import { configureClub, parseCliArgs } from '../../../../scripts/configure-club';

describe('Motor White-Label Multi-Club (club-config)', () => {
  it('registra los clubes demo-club y senorio-illescas en el catálogo', () => {
    const ids = listRegisteredClubIds();
    expect(ids).toContain('demo-club');
    expect(ids).toContain('senorio-illescas');
  });

  it('carga demo-club con sus 13 módulos habilitados y su appId de Android', () => {
    const club = getClubConfig('demo-club');
    expect(club.name).toBe('Real Club de Golf Valle Verde');
    expect(club.appId).toBe('com.birdie.valleverde');
    expect(getEnabledFeatures(club)).toHaveLength(13);
    expect(getClubDomain(club, 'staging')).toBe('staging.valleverde.birdie.app');
    expect(getClubDomain(club, 'production')).toBe('app.rcgvalleverde.es');
  });

  it('carga senorio-illescas con branding, dominio y features oficiales', () => {
    const club = getActiveClubConfig({ NEXT_PUBLIC_CLUB_ID: 'senorio-illescas' });
    expect(club.name).toBe('Señorío de Illescas Club de Golf & Padel');
    expect(club.shortName).toBe('Señorío de Illescas');
    expect(club.appId).toBe('com.birdie.senorioillescas');
    expect(club.theme.primary).toBe('#163A2B');
    expect(club.theme.secondary).toBe('#C5A059');

    const enabled = getEnabledFeatures(club);
    expect(enabled).toHaveLength(13);
    expect(enabled).toContain('forum');
    expect(enabled).toContain('specialEvents');
    expect(getClubDomain(club, 'staging')).toBe('staging.illescas.birdie.app');
    expect(getClubDomain(club, 'production')).toBe('app.senoriodeillescasgolf.com');
  });

  it('genera variables CSS y bloque :root a partir del tema del club', () => {
    const club = getClubConfig('demo-club');
    const vars = buildClubCssVariables(club);
    expect(vars).toEqual({
      '--club-primary': '#0F4C3A',
      '--club-primary-fg': '#FFFFFF',
      '--club-secondary': '#D4AF37',
      '--club-accent': '#1B7A58',
      '--club-bg': '#F8FAF9',
    });

    const cssBlock = buildClubCssRootBlock(club);
    expect(cssBlock).toContain(':root {');
    expect(cssBlock).toContain('--club-primary: #0F4C3A;');
  });

  it('rechaza configuraciones inválidas (colores, appId, coordenadas o features faltantes)', () => {
    const base = structuredClone(getClubConfig('demo-club'));

    expect(() =>
      validateClubConfig({ ...base, clubId: 'Invalid_ID!' })
    ).toThrow(/clubId inválido/);

    expect(() =>
      validateClubConfig({ ...base, appId: 'invalid_package_name' })
    ).toThrow(/appId inválido/);

    expect(() =>
      validateClubConfig({
        ...base,
        theme: { ...base.theme, primary: 'green' },
      })
    ).toThrow(/theme\.primary inválido/);

    expect(() =>
      validateClubConfig({
        ...base,
        coordinates: { lat: 120, lng: 0 },
      })
    ).toThrow(/coordinates inválido/);
  });

  it('parsea argumentos de CLI en formatos --club=, club= y variables npm_config_*', () => {
    expect(parseCliArgs(['--club=senorio-illescas', '--env=production'], {})).toEqual({
      clubId: 'senorio-illescas',
      environment: 'production',
    });

    expect(parseCliArgs(['club=demo-club', 'env=staging'], {})).toEqual({
      clubId: 'demo-club',
      environment: 'staging',
    });

    expect(
      parseCliArgs([], {
        npm_config_club: 'senorio-illescas',
        npm_config_env: 'production',
      })
    ).toEqual({
      clubId: 'senorio-illescas',
      environment: 'production',
    });
  });

  it('ejecuta configureClub generando artefactos para senorio-illescas y restaurando demo-club', () => {
    const illescasResult = configureClub({
      clubId: 'senorio-illescas',
      environment: 'production',
    });
    expect(illescasResult.appId).toBe('com.birdie.senorioillescas');
    expect(illescasResult.domain).toBe('app.senoriodeillescasgolf.com');
    expect(fs.existsSync(illescasResult.generatedConfigPath)).toBe(true);
    expect(illescasResult.androidSynced).toBe(true);
    expect(illescasResult.androidPackageName).toBe('com.birdie.senorioillescas');
    expect(illescasResult.googleServicesSynced).toBe(true);

    // Restaurar demo-club en staging por defecto
    const demoResult = configureClub({
      clubId: 'demo-club',
      environment: 'staging',
    });
    expect(demoResult.appId).toBe('com.birdie.valleverde');
    expect(demoResult.domain).toBe('staging.valleverde.birdie.app');
    expect(demoResult.androidSynced).toBe(true);
    expect(demoResult.androidPackageName).toBe('com.birdie.valleverde');
    expect(demoResult.googleServicesSynced).toBe(true);
  });

  it('verifica que los workflows de GitHub Actions incluyan todos los clubes registrados y los tests pgTAP', () => {
    const ciYml = fs.readFileSync(
      path.resolve(process.cwd(), '.github/workflows/ci.yml'),
      'utf-8'
    );
    expect(ciYml).toContain('npm run typecheck');
    expect(ciYml).toContain('npm run test');
    expect(ciYml).toContain('npm run build');
    expect(ciYml).toContain('supabase test db');

    const apkYml = fs.readFileSync(
      path.resolve(process.cwd(), '.github/workflows/build-club-apk.yml'),
      'utf-8'
    );
    for (const clubId of listRegisteredClubIds()) {
      expect(apkYml).toContain(`- ${clubId}`);
    }
    expect(apkYml).toContain('./gradlew assembleDebug');
  });

  it('verifica la configuración y automatización para despliegue en Vercel (vercel.json, prebuild y guía)', () => {
    // 1. Validar vercel.json
    const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
    expect(fs.existsSync(vercelJsonPath)).toBe(true);
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
    expect(vercelConfig.framework).toBe('nextjs');
    expect(vercelConfig.buildCommand).toBe('npm run build');
    expect(vercelConfig.cleanUrls).toBe(true);
    expect(Array.isArray(vercelConfig.headers)).toBe(true);
    expect(vercelConfig.headers.length).toBeGreaterThan(0);

    // 2. Validar hook prebuild en package.json
    const pkgJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
    );
    expect(pkgJson.scripts.prebuild).toBe('tsx scripts/configure-club.ts');
    expect(pkgJson.scripts.build).toBe('next build');

    // 3. Validar resolución de variables de entorno típicas de Vercel
    const vercelEnvResult = parseCliArgs([], {
      NEXT_PUBLIC_CLUB_ID: 'senorio-illescas',
      NEXT_PUBLIC_APP_ENV: 'production',
    });
    expect(vercelEnvResult.clubId).toBe('senorio-illescas');
    expect(vercelEnvResult.environment).toBe('production');

    // 4. Validar existencia de la documentación de despliegue en Vercel
    const vercelDocPath = path.resolve(process.cwd(), 'docs/deployment/vercel.md');
    expect(fs.existsSync(vercelDocPath)).toBe(true);
    const vercelDocContent = fs.readFileSync(vercelDocPath, 'utf-8');
    expect(vercelDocContent).toContain('NEXT_PUBLIC_CLUB_ID');
    expect(vercelDocContent).toContain('vercel.com');
  });
});
