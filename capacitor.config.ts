import type { CapacitorConfig } from '@capacitor/cli';
import fs from 'node:fs';
import path from 'node:path';

// Determinar el club activo según variables de entorno o archivo generado
const envClubId = process.env.NEXT_PUBLIC_CLUB_ID || process.env.npm_config_club;
const generatedConfigPath = path.join(
  __dirname,
  'src',
  'lib',
  'club-config',
  'active-club.generated.json'
);

let activeAppId = 'com.birdie.democlub';
let activeAppName = 'Real Club de Golf';

try {
  if (envClubId) {
    const specificClubPath = path.join(__dirname, 'clubs', envClubId, 'config.json');
    if (fs.existsSync(specificClubPath)) {
      const parsed = JSON.parse(fs.readFileSync(specificClubPath, 'utf-8'));
      activeAppId = parsed.appId || activeAppId;
      activeAppName = parsed.shortName || parsed.name || activeAppName;
    }
  } else if (fs.existsSync(generatedConfigPath)) {
    const parsed = JSON.parse(fs.readFileSync(generatedConfigPath, 'utf-8'));
    activeAppId = parsed.appId || activeAppId;
    activeAppName = parsed.shortName || parsed.name || activeAppName;
  }
} catch {
  // Mantener valores de reserva
}

const config: CapacitorConfig = {
  appId: activeAppId,
  appName: activeAppName,
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
  },
};

export default config;
