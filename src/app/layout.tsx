import type { Metadata } from 'next';
import './globals.css';
import { ClubProvider } from '@/components/providers/ClubProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
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
    <html lang="es" data-theme="dark" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-[var(--theme-bg)] text-[var(--theme-text-primary)]">
        <ThemeProvider>
          <ClubProvider>
            <AppShell>{children}</AppShell>
          </ClubProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
