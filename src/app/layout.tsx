import type { Metadata } from 'next';
import './globals.css';
import { ClubProvider } from '@/components/providers/ClubProvider';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Birdie — Plataforma White-Label de Golf',
  description: 'Marcador offline, GPS, reservas, torneos y comunidad para clubes de golf',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <ClubProvider>
          <AppShell>{children}</AppShell>
        </ClubProvider>
      </body>
    </html>
  );
}
