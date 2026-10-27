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
  it('registra los clubes demo-club y pinos-golf en el catálogo', () => {
    const ids = listRegisteredClubIds();
    expect(ids).toContain('demo-club');
    expect(ids).toContain('pinos-golf');
  });

  it('carga demo-club con sus 13 módulos habilitados y su appId de Android', () => {
    const club = getClubConfig('demo-club');
    expect(club.name).toBe('Real Club de Golf Valle Verde');
    expect(club.appId).toBe('com.birdie.valleverde');
    expect(getEnabledFeatures(club)).toHaveLength(13);
    expect(getClubDomain(club, 'staging')).toBe('staging.valleverde.birdie.app');
    expect(getClubDomain(club, 'production')).toBe('app.rcgvalleverde.es');
  });

  it('carga pinos-golf con branding, dominio y features diferenciados', () => {
    const club = getActiveClubConfig({ NEXT_PUBLIC_CLUB_ID: 'pinos-golf' });
    expect(club.name).toBe('Club de Golf Los Pinos del Mar');
    expect(club.appId).toBe('com.birdie.pinosgolf');
    expect(club.theme.primary).toBe('#0C2D48');

    const enabled = getEnabledFeatures(club);
    expect(enabled).toHaveLength(11);
    expect(enabled).not.toContain('forum');
    expect(enabled).not.toContain('specialEvents');
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
    expect(parseCliArgs(['--club=pinos-golf', '--env=production'], {})).toEqual({
      clubId: 'pinos-golf',
      environment: 'production',
    });

    expect(parseCliArgs(['club=demo-club', 'env=staging'], {})).toEqual({
      clubId: 'demo-club',
      environment: 'staging',
    });

    expect(
      parseCliArgs([], {
        npm_config_club: 'pinos-golf',
        npm_config_env: 'production',
      })
    ).toEqual({
      clubId: 'pinos-golf',
      environment: 'production',
    });
  });

  it('ejecuta configureClub generando artefactos para pinos-golf y restaurando demo-club', () => {
    const pinosResult = configureClub({
      clubId: 'pinos-golf',
      environment: 'production',
    });
    expect(pinosResult.appId).toBe('com.birdie.pinosgolf');
    expect(pinosResult.domain).toBe('app.lospinosgolf.com');
    expect(fs.existsSync(pinosResult.generatedConfigPath)).toBe(true);

    // Restaurar demo-club en staging por defecto
    const demoResult = configureClub({
      clubId: 'demo-club',
      environment: 'staging',
    });
    expect(demoResult.appId).toBe('com.birdie.valleverde');
    expect(demoResult.domain).toBe('staging.valleverde.birdie.app');
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
});
