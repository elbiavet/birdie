import fs from 'node:fs';
import path from 'node:path';
import {
  buildClubCssRootBlock,
  getClubDomain,
  validateClubConfig,
} from '../src/lib/club-config';
import type { AppEnvironment } from '../src/lib/env';

export interface ConfigureClubOptions {
  clubId: string;
  environment: AppEnvironment;
  projectRoot?: string;
}

export interface ConfigureClubResult {
  clubId: string;
  name: string;
  appId: string;
  environment: AppEnvironment;
  domain: string;
  generatedConfigPath: string;
  publicLogoPath: string;
  androidSynced?: boolean;
  androidPackageName?: string;
  googleServicesSynced?: boolean;
}

export function parseCliArgs(
  argv: string[],
  env: Record<string, string | undefined> = process.env
): {
  clubId: string;
  environment: AppEnvironment;
} {
  let clubId = env.npm_config_club || env.NEXT_PUBLIC_CLUB_ID || 'demo-club';
  const rawEnvFromConfig = env.npm_config_env || env.NEXT_PUBLIC_APP_ENV;
  let environment: AppEnvironment =
    rawEnvFromConfig === 'production' ? 'production' : 'staging';

  if (
    rawEnvFromConfig &&
    rawEnvFromConfig !== 'staging' &&
    rawEnvFromConfig !== 'production'
  ) {
    throw new Error(
      `Entorno inválido "${rawEnvFromConfig}". Usa --env=staging o --env=production.`
    );
  }

  for (const arg of argv) {
    if (arg.startsWith('--club=')) {
      clubId = arg.slice('--club='.length).trim();
    } else if (arg.startsWith('club=')) {
      clubId = arg.slice('club='.length).trim();
    } else if (arg.startsWith('--env=') || arg.startsWith('env=')) {
      const prefix = arg.startsWith('--env=') ? '--env=' : 'env=';
      const val = arg.slice(prefix.length).trim();
      if (val !== 'staging' && val !== 'production') {
        throw new Error(
          `Entorno inválido "${val}". Usa --env=staging o --env=production.`
        );
      }
      environment = val;
    }
  }

  return { clubId, environment };
}

export function configureClub({
  clubId,
  environment,
  projectRoot = process.cwd(),
}: ConfigureClubOptions): ConfigureClubResult {
  const clubConfigPath = path.join(projectRoot, 'clubs', clubId, 'config.json');
  if (!fs.existsSync(clubConfigPath)) {
    throw new Error(`No existe el archivo de configuración: ${clubConfigPath}`);
  }

  const rawJson = JSON.parse(fs.readFileSync(clubConfigPath, 'utf-8'));
  const validated = validateClubConfig(rawJson);
  const activeDomain = getClubDomain(validated, environment);

  // 1. Escribir configuración activa generada
  const generatedConfigPath = path.join(
    projectRoot,
    'src',
    'lib',
    'club-config',
    'active-club.generated.json'
  );
  fs.mkdirSync(path.dirname(generatedConfigPath), { recursive: true });
  fs.writeFileSync(
    generatedConfigPath,
    JSON.stringify(
      {
        ...validated,
        activeEnvironment: environment,
        activeDomain,
      },
      null,
      2
    ) + '\n',
    'utf-8'
  );

  // 2. Copiar logo del club a public/club-logo.svg para exportación estática y Capacitor
  const sourceLogoPath = path.join(
    projectRoot,
    'clubs',
    clubId,
    'assets',
    'logo.svg'
  );
  const sourceLogoPngPath = path.join(
    projectRoot,
    'clubs',
    clubId,
    'assets',
    'logo.png'
  );
  const publicDir = path.join(projectRoot, 'public');
  const publicLogoPath = path.join(publicDir, 'club-logo.svg');
  const publicLogoPngPath = path.join(publicDir, 'club-logo.png');
  fs.mkdirSync(publicDir, { recursive: true });
  if (fs.existsSync(sourceLogoPath)) {
    fs.copyFileSync(sourceLogoPath, publicLogoPath);
  }
  if (fs.existsSync(sourceLogoPngPath)) {
    fs.copyFileSync(sourceLogoPngPath, publicLogoPngPath);
  }

  // Sincronizar catálogo estático de assets por club en public/clubs/<clubId> para multi-club dinámico
  const clubPublicDir = path.join(publicDir, 'clubs', clubId);
  fs.mkdirSync(clubPublicDir, { recursive: true });
  if (fs.existsSync(sourceLogoPath)) {
    fs.copyFileSync(sourceLogoPath, path.join(clubPublicDir, 'logo.svg'));
  }
  if (fs.existsSync(sourceLogoPngPath)) {
    fs.copyFileSync(sourceLogoPngPath, path.join(clubPublicDir, 'logo.png'));
  }

  // 3. Actualizar variables CSS en src/app/globals.css preservando estilos y tokens
  const globalsCssPath = path.join(projectRoot, 'src', 'app', 'globals.css');
  const rootCss = buildClubCssRootBlock(validated);
  let globalsCssContent = '';
  if (fs.existsSync(globalsCssPath)) {
    const existing = fs.readFileSync(globalsCssPath, 'utf-8');
    if (/:root\s*\{[^}]*\}/.test(existing)) {
      globalsCssContent = existing.replace(/:root\s*\{[^}]*\}/, rootCss.trim());
    } else {
      globalsCssContent = `@import "tailwindcss";\n\n${rootCss}\n${existing}`;
    }
  } else {
    globalsCssContent = `@import "tailwindcss";\n\n${rootCss}\nbody {\n  background-color: var(--theme-bg, var(--club-bg));\n  color: var(--theme-text-primary, #0f172a);\n}\n`;
  }
  fs.writeFileSync(globalsCssPath, globalsCssContent, 'utf-8');

  // 4. Sincronizar proyecto Android nativo (applicationId, strings.xml, google-services.json, iconos)
  const androidResult = syncAndroidProject(validated, projectRoot);

  return {
    clubId: validated.clubId,
    name: validated.name,
    appId: validated.appId,
    environment,
    domain: activeDomain,
    generatedConfigPath,
    publicLogoPath,
    ...androidResult,
  };
}

/**
 * Sincroniza los metadatos y artefactos de marca del club activo en el proyecto Android de Capacitor (/android).
 */
export function syncAndroidProject(
  club: {
    clubId: string;
    appId: string;
    name: string;
    shortName: string;
  },
  projectRoot = process.cwd()
): {
  androidSynced: boolean;
  androidPackageName?: string;
  googleServicesSynced?: boolean;
} {
  const androidDir = path.join(projectRoot, 'android');
  if (!fs.existsSync(androidDir)) {
    return { androidSynced: false };
  }

  // 1. Sincronizar applicationId y namespace en android/app/build.gradle
  const buildGradlePath = path.join(androidDir, 'app', 'build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    let buildGradle = fs.readFileSync(buildGradlePath, 'utf-8');
    buildGradle = buildGradle.replace(/namespace\s+["'][^"']+["']/, `namespace "${club.appId}"`);
    buildGradle = buildGradle.replace(
      /applicationId\s+["'][^"']+["']/,
      `applicationId "${club.appId}"`
    );
    fs.writeFileSync(buildGradlePath, buildGradle, 'utf-8');
  }

  // 2. Sincronizar app_name, package_name y scheme en strings.xml
  const stringsXmlPath = path.join(
    androidDir,
    'app',
    'src',
    'main',
    'res',
    'values',
    'strings.xml'
  );
  if (fs.existsSync(stringsXmlPath)) {
    let stringsXml = fs.readFileSync(stringsXmlPath, 'utf-8');
    stringsXml = stringsXml.replace(
      /<string name="app_name">[^<]*<\/string>/,
      `<string name="app_name">${club.shortName}</string>`
    );
    stringsXml = stringsXml.replace(
      /<string name="title_activity_main">[^<]*<\/string>/,
      `<string name="title_activity_main">${club.shortName}</string>`
    );
    stringsXml = stringsXml.replace(
      /<string name="package_name">[^<]*<\/string>/,
      `<string name="package_name">${club.appId}</string>`
    );
    stringsXml = stringsXml.replace(
      /<string name="custom_url_scheme">[^<]*<\/string>/,
      `<string name="custom_url_scheme">${club.appId}</string>`
    );
    fs.writeFileSync(stringsXmlPath, stringsXml, 'utf-8');
  }

  // 3. Sincronizar google-services.json para FCM Push Notifications
  const googleServicesSource = path.join(
    projectRoot,
    'clubs',
    club.clubId,
    'assets',
    'google-services.json'
  );
  const googleServicesDest = path.join(androidDir, 'app', 'google-services.json');
  let googleServicesSynced = false;
  if (fs.existsSync(googleServicesSource)) {
    fs.copyFileSync(googleServicesSource, googleServicesDest);
    googleServicesSynced = true;
  }

  // 4. Sincronizar icono y splash a recursos Android si existen
  const iconSource = path.join(projectRoot, 'clubs', club.clubId, 'assets', 'icon.png');
  const splashSource = path.join(projectRoot, 'clubs', club.clubId, 'assets', 'splash.png');

  if (fs.existsSync(iconSource)) {
    const mipmapDirs = [
      'mipmap-mdpi',
      'mipmap-hdpi',
      'mipmap-xhdpi',
      'mipmap-xxhdpi',
      'mipmap-xxxhdpi',
    ];
    for (const m of mipmapDirs) {
      const targetDir = path.join(androidDir, 'app', 'src', 'main', 'res', m);
      if (fs.existsSync(targetDir)) {
        fs.copyFileSync(iconSource, path.join(targetDir, 'ic_launcher.png'));
        fs.copyFileSync(iconSource, path.join(targetDir, 'ic_launcher_round.png'));
      }
    }
  }

  if (fs.existsSync(splashSource)) {
    const drawableDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'drawable');
    if (fs.existsSync(drawableDir)) {
      fs.copyFileSync(splashSource, path.join(drawableDir, 'splash.png'));
    }
  }

  return {
    androidSynced: true,
    androidPackageName: club.appId,
    googleServicesSynced,
  };
}

// Ejecutar si se invoca directamente desde CLI
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith(path.join('scripts', 'configure-club.ts'));

if (isDirectExecution) {
  const { clubId, environment } = parseCliArgs(process.argv.slice(2));
  const result = configureClub({ clubId, environment });
  console.log(
    `[Birdie White-Label] Club configurado: ${result.name} (${result.clubId}) | appId=${result.appId} | env=${result.environment} | domain=${result.domain}`
  );
}
