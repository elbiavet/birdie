/**
 * Script reproducible de importación de campos de golf de España desde OpenStreetMap (Overpass API).
 *
 * Uso:
 *   npm run import:osm
 *   npx tsx scripts/import-osm-courses.ts [--instance=<url>] [--timeout=<sec>] [--dry-run]
 *
 * Instancias de Overpass configurables vía variable de entorno o argumento CLI:
 *   - https://overpass-api.de/api/interpreter (por defecto)
 *   - https://maps.mail.ru/osm/tools/overpass/api/interpreter
 *   - https://overpass.kumi.systems/api/interpreter
 *
 * Principio de salvaguarda:
 * Si la petición falla por desconexión, timeout o respuesta vacía, el archivo
 * local existente (src/data/osm-golf-courses.json) se conserva intacto.
 */

import fs from 'node:fs';
import path from 'node:path';
import { processOverpassResponse } from '../src/lib/spain-courses/osm-normalizer';
import type { OsmDatasetFile, OverpassRawResponse } from '../src/lib/spain-courses/osm-types';

const DEFAULT_TARGET_PATH = path.resolve(process.cwd(), 'src/data/osm-golf-courses.json');

const DEFAULT_INSTANCES = [
  process.env.OVERPASS_INSTANCE_URL || 'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const OVERPASS_QUERY = `[out:json][timeout:60];
area["ISO3166-1"="ES"][admin_level=2]->.spain;
(
  node["leisure"="golf_course"](area.spain);
  way["leisure"="golf_course"](area.spain);
  relation["leisure"="golf_course"](area.spain);
);
out center tags;`;

interface CliArgs {
  targetPath: string;
  instanceUrl: string;
  timeoutSec: number;
  dryRun: boolean;
  help: boolean;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let targetPath = DEFAULT_TARGET_PATH;
  let instanceUrl = DEFAULT_INSTANCES[0];
  let timeoutSec = 60;
  let dryRun = false;
  let help = false;

  for (const arg of args) {
    if (arg.startsWith('--instance=')) {
      instanceUrl = arg.slice('--instance='.length).trim();
    } else if (arg.startsWith('--file=')) {
      targetPath = path.resolve(process.cwd(), arg.slice('--file='.length).trim());
    } else if (arg.startsWith('--timeout=')) {
      timeoutSec = Number.parseInt(arg.slice('--timeout='.length), 10) || 60;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    }
  }

  return { targetPath, instanceUrl, timeoutSec, dryRun, help };
}

function showHelp() {
  console.log(`
Birdie — Importador de Campos de Golf de España desde OpenStreetMap (Overpass API)
==================================================================================

Uso:
  npm run import:osm
  npx tsx scripts/import-osm-courses.ts [opciones]

Opciones:
  --instance=<url>    URL del endpoint de Overpass API (por defecto: ${DEFAULT_INSTANCES[0]})
  --timeout=<sec>     Tiempo máximo de espera en segundos (por defecto: 60)
  --file=<ruta>       Ruta de destino del archivo JSON (por defecto: src/data/osm-golf-courses.json)
  --dry-run           Consulta y valida la respuesta sin sobrescribir el archivo en disco
  --help, -h          Muestra este mensaje de ayuda

Instancias públicas alternativas:
  - https://overpass-api.de/api/interpreter
  - https://maps.mail.ru/osm/tools/overpass/api/interpreter
  - https://overpass.kumi.systems/api/interpreter

Comportamiento de salvaguarda:
  Si la consulta a Overpass falla o devuelve una respuesta incompleta/vacía, el archivo
  existente en src/data/osm-golf-courses.json se mantiene sin modificaciones.
`);
}

async function fetchOverpassWithTimeout(
  instanceUrl: string,
  query: string,
  timeoutSec: number
): Promise<OverpassRawResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    const response = await fetch(instanceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Birdie-Golf-App/1.0 (+https://github.com/birdie-app)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} desde ${instanceUrl}`);
    }

    const data = await response.json();
    return data as OverpassRawResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function importOsmCourses(cliArgs?: Partial<CliArgs>): Promise<{
  success: boolean;
  preservedPrevious: boolean;
  coursesCount: number;
  targetPath: string;
  source: 'network' | 'fallback';
  message: string;
}> {
  const options: CliArgs = {
    targetPath: DEFAULT_TARGET_PATH,
    instanceUrl: DEFAULT_INSTANCES[0],
    timeoutSec: 60,
    dryRun: false,
    help: false,
    ...cliArgs,
  };

  const fileExists = fs.existsSync(options.targetPath);
  console.log(`[Birdie OSM] Iniciando importación desde Overpass API...`);
  console.log(`[Birdie OSM] Endpoint primario: ${options.instanceUrl}`);
  console.log(`[Birdie OSM] Destino: ${options.targetPath} (Existe previamente: ${fileExists})`);

  let rawResponse: OverpassRawResponse | null = null;
  let successfulInstance = options.instanceUrl;

  // Probar endpoint primario y alternativos si falla
  const candidateInstances = [
    options.instanceUrl,
    ...DEFAULT_INSTANCES.filter((url) => url !== options.instanceUrl),
  ];

  for (const instance of candidateInstances) {
    try {
      console.log(`[Birdie OSM] Consultando ${instance}...`);
      rawResponse = await fetchOverpassWithTimeout(instance, OVERPASS_QUERY, options.timeoutSec);
      if (rawResponse && Array.isArray(rawResponse.elements) && rawResponse.elements.length > 0) {
        successfulInstance = instance;
        console.log(`[Birdie OSM] ✓ Respuesta recibida con ${rawResponse.elements.length} elementos crudos.`);
        break;
      }
      console.warn(`[Birdie OSM] Advertencia: respuesta de ${instance} no contiene elementos.`);
    } catch (err) {
      console.warn(`[Birdie OSM] Fallo al consultar ${instance}:`, err instanceof Error ? err.message : err);
    }
  }

  // Si falló la consulta a la red
  if (!rawResponse || !Array.isArray(rawResponse.elements) || rawResponse.elements.length === 0) {
    if (fileExists) {
      const existingContent = fs.readFileSync(options.targetPath, 'utf-8');
      const parsed = JSON.parse(existingContent) as OsmDatasetFile;
      const count = parsed.courses?.length ?? 0;
      const message = `No fue posible conectar con Overpass API. Se preserva intacto el archivo previo versionado (${count} campos).`;
      console.warn(`[Birdie OSM] ⚠️ ${message}`);
      return {
        success: true,
        preservedPrevious: true,
        coursesCount: count,
        targetPath: options.targetPath,
        source: 'fallback',
        message,
      };
    }

    throw new Error(
      'Fallo total al conectar con Overpass API y no existe archivo previo de respaldo en ' + options.targetPath
    );
  }

  // Normalizar y validar
  const dataset = processOverpassResponse(rawResponse, {
    importedAt: new Date().toISOString(),
    overpassInstance: successfulInstance,
  });

  console.log(`[Birdie OSM] ✓ Normalizados ${dataset.elementsCount} campos de golf georreferenciados.`);

  if (options.dryRun) {
    console.log(`[Birdie OSM] [Dry-Run] Datos validados. No se sobrescribe el archivo en disco.`);
    return {
      success: true,
      preservedPrevious: fileExists,
      coursesCount: dataset.elementsCount,
      targetPath: options.targetPath,
      source: 'network',
      message: `[Dry-Run] ${dataset.elementsCount} campos validados desde ${successfulInstance}.`,
    };
  }

  // Crear directorio si no existe
  const targetDir = path.dirname(options.targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Escritura atómica
  fs.writeFileSync(options.targetPath, JSON.stringify(dataset, null, 2), 'utf-8');
  console.log(`[Birdie OSM] ✓ Archivo guardado correctamente en: ${options.targetPath}`);

  return {
    success: true,
    preservedPrevious: false,
    coursesCount: dataset.elementsCount,
    targetPath: options.targetPath,
    source: 'network',
    message: `Importados y guardados ${dataset.elementsCount} campos de golf desde ${successfulInstance}.`,
  };
}

// Ejecución como script CLI
if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('import-osm-courses'))) {
  const cliArgs = parseCliArgs();
  if (cliArgs.help) {
    showHelp();
    process.exit(0);
  }

  importOsmCourses(cliArgs)
    .then((result) => {
      console.log(`[Birdie OSM] Proceso finalizado: ${result.message}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[Birdie OSM] Error fatal en la importación:`, err);
      process.exit(1);
    });
}
