import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Birdie Golf Platform',
  description: 'Aplicación white-label para clubes de golf',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
