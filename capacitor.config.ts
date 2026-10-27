import type { CapacitorConfig } from '@capacitor/cli';
import { getActiveClubConfig } from './src/lib/club-config';

const activeClub = getActiveClubConfig(process.env);

const config: CapacitorConfig = {
  appId: activeClub.appId,
  appName: activeClub.shortName,
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
