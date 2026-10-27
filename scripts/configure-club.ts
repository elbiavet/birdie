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
  const publicDir = path.join(projectRoot, 'public');
  const publicLogoPath = path.join(publicDir, 'club-logo.svg');
  fs.mkdirSync(publicDir, { recursive: true });
  if (fs.existsSync(sourceLogoPath)) {
    fs.copyFileSync(sourceLogoPath, publicLogoPath);
  }

  // 3. Actualizar variables CSS en src/app/globals.css
  const globalsCssPath = path.join(projectRoot, 'src', 'app', 'globals.css');
  const rootCss = buildClubCssRootBlock(validated);
  const globalsCssContent = `@import "tailwindcss";\n\n${rootCss}\nbody {\n  background-color: var(--club-bg);\n  color: #0f172a;\n}\n`;
  fs.writeFileSync(globalsCssPath, globalsCssContent, 'utf-8');

  return {
    clubId: validated.clubId,
    name: validated.name,
    appId: validated.appId,
    environment,
    domain: activeDomain,
    generatedConfigPath,
    publicLogoPath,
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
