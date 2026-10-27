import type { NextConfig } from 'next';

/**
 * En modo APK de Capacitor (o por defecto para garantizar 100% compatibilidad offline
 * con SQLite en el campo y despliegue estático/híbrido en Vercel), exportamos en 'out/'.
 */
const isStaticExport = process.env.NEXT_OUTPUT_MODE !== 'server';

const nextConfig: NextConfig = {
  output: isStaticExport ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_CLUB_ID: process.env.NEXT_PUBLIC_CLUB_ID || 'demo-club',
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || 'staging',
  },
};

export default nextConfig;
